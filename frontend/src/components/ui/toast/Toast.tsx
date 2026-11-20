import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { FONTS, UI_COLORS } from "../../../constants/theme";

/** Screen edge a toast enters from, rests against, and dismisses toward. */
export type ToastPosition = "top" | "bottom";

export interface ToastConfig {
  id: number;
  title?: string;
  message: string;
  position: ToastPosition;
  type?: "success" | "error" | "info" | "warning";
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number;
  actionText?: string;
  onActionPress?: () => void;
}

/** Travel distance of the entrance, far enough to clear the screen edge. */
const ENTER_OFFSET = 200;
const HIDDEN_SCALE = 0.7;
const AUTO_DISMISS_MS = 5000;
const FADE_IN_MS = 200;
const EXIT_MS = 160;
/** How far the front toast slides toward its edge while fading out on close/timeout. */
const EXIT_DROP = 40;
/** Extra travel a swipe-dismissed toast keeps after the finger lets go. */
const SWIPE_EXIT_DROP = 80;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** A drag toward the edge past this distance, or a flick past this velocity, commits. */
const DISMISS_DISTANCE = 56;
const DISMISS_VELOCITY = 800;

/**
 * Stack layout: each toast behind the front peeks out and shrinks a step. The
 * peek is measured from the front toast's far edge (top edge for a bottom
 * stack, bottom edge for a top stack), so one- to three-line toasts still
 * step out evenly.
 */
const STACK_PEEK = 14;
const STACK_SCALE_STEP = 0.05;
const MAX_VISIBLE = 3;

const TOAST_BACKGROUND = UI_COLORS.surfaceSubtle;
const TOAST_BORDER = "rgba(255, 255, 255, 0.09)";
const TOAST_TEXT = UI_COLORS.textPrimary;
const TOAST_SUBTEXT = UI_COLORS.textSecondary;
const TOAST_MUTED = UI_COLORS.textMuted;

const TOAST_SUCCESS = UI_COLORS.mint;
const TOAST_SUCCESS_BG = "rgba(52, 211, 153, 0.16)";
const TOAST_ERROR = UI_COLORS.coral;
const TOAST_ERROR_BG = "rgba(232, 93, 117, 0.16)";
const TOAST_WARNING = UI_COLORS.amber;
const TOAST_WARNING_BG = "rgba(251, 191, 36, 0.16)";
const TOAST_INFO = "#A78BFA";
const TOAST_INFO_BG = "rgba(108, 92, 231, 0.18)";

/** Dragging away from the edge resists toward an asymptote instead of following the finger. */
function rubberBand(distance: number) {
  "worklet";
  return (40 * distance) / (distance + 120);
}

/**
 * Vertical offset that puts a toast's far edge STACK_PEEK per slot beyond the
 * front toast's far edge, for a stack anchored to the bottom of the screen.
 * Every toast is anchored to the same edge and scales about its own center, so
 * the offset depends on both heights. A top stack is the mirror image, so it
 * uses the negated value.
 */
function stackOffset(index: number, height: number, frontHeight: number) {
  const scale = 1 - index * STACK_SCALE_STEP;
  return -frontHeight + (height * (1 + scale)) / 2 - index * STACK_PEEK;
}

export function Toast({
  toast,
  index,
  height,
  frontHeight,
  onHeightChange,
  onDismissStart,
  onDismissed,
}: {
  toast: ToastConfig;
  /** Position from the front of the stack: 0 = newest, on top. */
  index: number;
  /** Measured layout height of this toast; undefined until the first layout. */
  height?: number;
  /** Measured height of the front toast, the baseline the stack peeks beyond. */
  frontHeight?: number;
  onHeightChange: (id: number, height: number) => void;
  onDismissStart: (id: number) => void;
  onDismissed: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Every vertical motion (entrance, stack peek, drag, exit drop) points
  // toward the anchored edge: +1 is down for a bottom toast, -1 is up for a
  // top toast. Flipping this one sign mirrors the whole animation.
  const dir = toast.position === "top" ? -1 : 1;

  // 0 = hidden past the edge, 1 = resting. Entrance only. The exit is a
  // slide-out fade, not this spring in reverse.
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Where the stack wants this toast: springs when the index or the heights
  // shift. New toasts always enter at the front, where the offset is 0.
  const stackY = useSharedValue(0);
  const stackScale = useSharedValue(1 - index * STACK_SCALE_STEP);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);
  // The auto-dismiss timer closes over an old render; read the index live.
  const indexRef = useRef(index);
  indexRef.current = index;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishDismiss = useCallback(
    () => onDismissed(toast.id),
    [onDismissed, toast.id],
  );

  const dismiss = useCallback(
    (kind: "timeout" | "close" | "swipe") => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      clearTimer();
      // Promote the toasts behind right away, not after the fade.
      onDismissStart(toast.id);

      opacity.set(
        withTiming(0, { duration: EXIT_MS }, (finished) => {
          if (finished) scheduleOnRN(finishDismiss);
        }),
      );
      if (reduced) return;
      if (kind === "swipe") {
        dragY.set(
          withTiming(dragY.get() + dir * SWIPE_EXIT_DROP, {
            duration: EXIT_MS,
            easing: EASE_OUT,
          }),
        );
      } else if (indexRef.current === 0) {
        dragY.set(
          withTiming(dir * EXIT_DROP, { duration: EXIT_MS, easing: EASE_OUT }),
        );
      }
      // A toast expiring behind the front just fades where it sits.
    },
    [
      clearTimer,
      dir,
      dragY,
      finishDismiss,
      onDismissStart,
      opacity,
      reduced,
      toast.id,
    ],
  );

  const dismissMs =
    typeof toast.duration === "number" && toast.duration > 0
      ? toast.duration
      : AUTO_DISMISS_MS;

  const restartTimer = useCallback(() => {
    if (exitingRef.current) return;
    clearTimer();
    timerRef.current = setTimeout(() => dismiss("timeout"), dismissMs);
  }, [clearTimer, dismiss, dismissMs]);

  const commitSwipeDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dismiss("swipe");
  }, [dismiss]);

  // Animate in once on mount; each toast is its own entry in the stack.
  useEffect(() => {
    progress.set(reduced ? 1 : withSpring(1));
    opacity.set(withTiming(1, { duration: FADE_IN_MS }));
    restartTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the stack as newer toasts arrive or front ones leave.
  useEffect(() => {
    if (exitingRef.current) return;
    const scale = 1 - index * STACK_SCALE_STEP;
    stackScale.set(reduced ? scale : withSpring(scale));
    if (height !== undefined && frontHeight !== undefined) {
      const y = dir * stackOffset(index, height, frontHeight);
      stackY.set(reduced ? y : withSpring(y));
    }
    if (index >= MAX_VISIBLE) {
      opacity.set(withTiming(0, { duration: FADE_IN_MS }));
    }
  }, [dir, frontHeight, height, index, opacity, reduced, stackScale, stackY]);

  const pan = Gesture.Pan()
    // Only the front toast is under the finger; the rest are decoration.
    .enabled(index === 0)
    .onBegin(() => {
      scheduleOnRN(clearTimer);
    })
    .onUpdate((e) => {
      const toward = e.translationY * dir;
      dragY.set(dir * (toward >= 0 ? toward : -rubberBand(-toward)));
    })
    .onEnd((e) => {
      if (
        e.translationY * dir > DISMISS_DISTANCE ||
        e.velocityY * dir > DISMISS_VELOCITY
      ) {
        scheduleOnRN(commitSwipeDismiss);
      } else {
        dragY.set(withSpring(0));
        scheduleOnRN(restartTimer);
      }
    })
    .onFinalize((_e, success) => {
      if (!success) scheduleOnRN(restartTimer);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: opacity.get(),
      transform: [
        {
          translateY:
            (1 - p) * ENTER_OFFSET * dir + stackY.get() + dragY.get(),
        },
        { scale: (HIDDEN_SCALE + (1 - HIDDEN_SCALE) * p) * stackScale.get() },
      ],
    };
  });

  const handleAction = () => {
    toast.onActionPress?.();
    dismiss("close");
  };

  const iconName = toast.icon
    ? toast.icon
    : toast.type === "error"
      ? "alert-circle"
      : toast.type === "warning"
        ? "warning"
        : toast.type === "info"
          ? "information-circle"
          : "checkmark";

  const iconColor =
    toast.type === "error"
      ? TOAST_ERROR
      : toast.type === "warning"
        ? TOAST_WARNING
        : toast.type === "info"
          ? TOAST_INFO
          : TOAST_SUCCESS;

  const iconBgColor =
    toast.type === "error"
      ? TOAST_ERROR_BG
      : toast.type === "warning"
        ? TOAST_WARNING_BG
        : toast.type === "info"
          ? TOAST_INFO_BG
          : TOAST_SUCCESS_BG;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e) => onHeightChange(toast.id, e.nativeEvent.layout.height)}
        style={[
          styles.container,
          toast.position === "top"
            ? { top: insets.top + 12 }
            : { bottom: insets.bottom + 16 },
          animatedStyle,
        ]}
      >
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
          <View style={styles.textWrap}>
            {toast.title ? (
              <Text style={styles.title} numberOfLines={1}>
                {toast.title}
              </Text>
            ) : null}
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
          {toast.actionText && toast.onActionPress ? (
            <Pressable
              onPress={handleAction}
              hitSlop={8}
              style={styles.actionButton}
            >
              <Text style={styles.actionText}>{toast.actionText}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => dismiss("close")}
            hitSlop={8}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={TOAST_MUTED} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: TOAST_BORDER,
    backgroundColor: TOAST_BACKGROUND,
    zIndex: 9999,
    boxShadow: "0px 10px 28px rgba(0, 0, 0, 0.38)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: TOAST_TEXT,
  },
  message: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: TOAST_SUBTEXT,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: TOAST_TEXT,
  },
  closeButton: {
    padding: 4,
  },
});
