import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FONTS, UI_COLORS } from "../../constants/theme";
import { AnimatedLoader } from "./AnimatedLoader";
import { BrainMascot, type OrbExpressionName } from "./Mascots";

interface AnimatedSplashScreenProps {
  /** True once native splash is hidden so our visible animation starts cleanly on frame 1. */
  active?: boolean;
  /** Whether app hydration & initial auth verification have completed. */
  ready: boolean;
  /** Optional message revealed only when network verification takes longer than the intro beat. */
  statusMessage?: string;
  /** Invoked once the exit transition finishes so the overlay can unmount. */
  onFinish: () => void;
}

const MIN_SPLASH_MS = 5500;
const MASCOT_SIZE = 92;
const LOCKUP_GAP = 20;
const WORDMARK_CENTER_OFFSET = -((MASCOT_SIZE + LOCKUP_GAP) / 2);

export function AnimatedSplashScreen({
  active = true,
  ready,
  statusMessage,
  onFinish,
}: AnimatedSplashScreenProps) {
  const { t } = useTranslation("auth");
  const [minBeatDone, setMinBeatDone] = useState(false);
  const [showMascot, setShowMascot] = useState(false);
  const [showSlowStatus, setShowSlowStatus] = useState(false);
  const [mascotExpression, setMascotExpression] =
    useState<OrbExpressionName>("eager");
  const hasExitedRef = useRef(false);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const notifyFinish = useCallback(() => {
    onFinishRef.current();
  }, []);

  const overlayOpacity = useSharedValue(1);
  const heroScale = useSharedValue(1);

  // Act 1: Monochrome wordmark centered cleanly on #0D0B14
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.92);
  const titleTranslateY = useSharedValue(WORDMARK_CENTER_OFFSET + 14);

  // Act 2: Wordmark glides smoothly down & Mascot performs its Welcome greeting above
  const mascotOpacity = useSharedValue(0);
  const mascotScale = useSharedValue(0.5);

  useEffect(() => {
    if (!active) return;

    // Act 1 (0ms -> 700ms): Reveal centered monochrome QUIZROPE wordmark cleanly
    titleOpacity.value = withDelay(
      140,
      withTiming(1, {
        duration: 560,
        easing: Easing.out(Easing.cubic),
      }),
    );
    titleScale.value = withDelay(
      140,
      withTiming(1, {
        duration: 580,
        easing: Easing.out(Easing.cubic),
      }),
    );
    titleTranslateY.value = withDelay(
      140,
      withTiming(WORDMARK_CENTER_OFFSET, {
        duration: 560,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Act 2 (1050ms): Slide QUIZROPE down gently and launch the Welcome mascot animation
    const mascotRevealTimer = setTimeout(() => {
      setShowMascot(true);

      titleTranslateY.value = withTiming(0, {
        duration: 680,
        easing: Easing.inOut(Easing.cubic),
      });
      titleScale.value = withTiming(0.92, {
        duration: 680,
        easing: Easing.inOut(Easing.cubic),
      });

      mascotOpacity.value = withDelay(
        80,
        withTiming(1, {
          duration: 460,
          easing: Easing.out(Easing.cubic),
        }),
      );
      mascotScale.value = withDelay(
        80,
        withSpring(1, { damping: 14, stiffness: 130 }),
      );
    }, 1050);

    // Expressive greeting sequence synchronized with `variant="welcome"`:
    // curious glance -> celebratory joy smile during sway -> friendly wink nod
    const curiousTimer = setTimeout(() => setMascotExpression("curious"), 1650);
    const joyTimer = setTimeout(() => setMascotExpression("joy"), 2150);
    const winkTimer = setTimeout(() => setMascotExpression("wink"), 2950);
    const settleTimer = setTimeout(() => setMascotExpression("hopeful"), 3350);

    const slowTimer = setTimeout(() => setShowSlowStatus(true), 5600);
    const minTimer = setTimeout(() => setMinBeatDone(true), MIN_SPLASH_MS);

    return () => {
      clearTimeout(mascotRevealTimer);
      clearTimeout(curiousTimer);
      clearTimeout(joyTimer);
      clearTimeout(winkTimer);
      clearTimeout(settleTimer);
      clearTimeout(slowTimer);
      clearTimeout(minTimer);

      cancelAnimation(overlayOpacity);
      cancelAnimation(heroScale);
      cancelAnimation(titleOpacity);
      cancelAnimation(titleScale);
      cancelAnimation(titleTranslateY);
      cancelAnimation(mascotOpacity);
      cancelAnimation(mascotScale);
    };
  }, [
    active,
    heroScale,
    mascotOpacity,
    mascotScale,
    overlayOpacity,
    titleOpacity,
    titleScale,
    titleTranslateY,
  ]);

  useEffect(() => {
    if (!active || !ready || !minBeatDone || hasExitedRef.current) return;
    hasExitedRef.current = true;

    heroScale.value = withTiming(1.03, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
    overlayOpacity.value = withTiming(
      0,
      { duration: 400, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(notifyFinish)();
        }
      },
    );
  }, [active, heroScale, minBeatDone, notifyFinish, overlayOpacity, ready]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const heroExitStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotOpacity.value,
    transform: [{ scale: mascotScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [
      { translateY: titleTranslateY.value },
      { scale: titleScale.value },
    ],
  }));

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      pointerEvents="auto"
      accessibilityLabel={t("appTitle", "QUIZROPE")}
    >
      <Animated.View style={[styles.centerStage, heroExitStyle]}>
        <Animated.View style={[styles.mascotWrap, mascotStyle]}>
          {showMascot ? (
            <BrainMascot
              size={MASCOT_SIZE}
              variant="welcome"
              expression={mascotExpression}
              showFloorShadow={false}
              interactive={false}
            />
          ) : null}
        </Animated.View>

        <Animated.Text style={[styles.wordmark, titleStyle]}>
          {t("appTitle", "QUIZROPE")}
        </Animated.Text>
      </Animated.View>

      <View style={styles.footerSlot} pointerEvents="none">
        {showSlowStatus && !ready && statusMessage ? (
          <AnimatedLoader
            size="sm"
            color="#A78BFA"
            message={statusMessage}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 999,
  },
  centerStage: {
    alignItems: "center",
    justifyContent: "center",
    gap: LOCKUP_GAP,
  },
  mascotWrap: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 2.2,
    color: "#FFFFFF",
  },
  footerSlot: {
    position: "absolute",
    bottom: 68,
    left: 24,
    right: 24,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
