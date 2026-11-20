import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Blur,
  Canvas,
  FontWeight,
  Group,
  Paint,
  Paragraph,
  RoundedRect,
  Skia,
  TextAlign,
  TextDirection,
} from "@shopify/react-native-skia";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BrainMascot, type OrbState } from "./Mascots";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

const BLUR_PAD = 28;
const PILL_PAD_Y = 9;
const PILL_PAD_X = 20;
const MASCOT_LEFT_PAD = 8;
const MASCOT_SIZE = 36;
const MASCOT_GAP = 10;
const MASCOT_RIGHT_PAD = 18;

interface MascotBuddyProps {
  message: string;
  visible: boolean;
  triggerKey?: number;
  state?: OrbState;
  showMascot?: boolean;
  topOffset?: number;
  onHide?: () => void;
  displayDurationMs?: number;
}

/**
 * Calm matte-obsidian floating companion pill displaying adaptive feedback
 * below the top HUD with a unified GPU Skia blur reveal over container and text.
 */
export function MascotBuddy({
  message,
  visible,
  triggerKey = 0,
  state = "done",
  showMascot = true,
  topOffset,
  onHide,
  displayDurationMs = 2000,
}: MascotBuddyProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-10);
  const pillScale = useSharedValue(0.93);
  const revealBlur = useSharedValue(12);
  const revealOpacity = useSharedValue(0);

  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  const notifyHidden = useCallback(() => {
    onHideRef.current?.();
  }, []);

  const maxTextWidth = showMascot ? 248 : 288;

  const skiaParagraph = useMemo(() => {
    if (!message) return null;
    try {
      const builder = Skia.ParagraphBuilder.Make({
        textAlign: TextAlign.Center,
        textDirection: I18nManager.isRTL
          ? TextDirection.RTL
          : TextDirection.LTR,
        maxLines: 2,
        ellipsis: "…",
      });
      builder.pushStyle({
        color: Skia.Color(UI_COLORS.textPrimary),
        fontFamilies: ["Nunito_700Bold", "Nunito", "System"],
        fontSize: 13.5,
        fontStyle: { weight: FontWeight.Bold },
        heightMultiplier: 1.35,
      });
      builder.addText(message);
      const paragraph = builder.build();
      paragraph.layout(maxTextWidth);
      const tightWidth = Math.min(
        maxTextWidth,
        Math.max(24, Math.ceil(paragraph.getLongestLine()) + 2),
      );
      paragraph.layout(tightWidth);
      const height = Math.max(18, Math.ceil(paragraph.getHeight()));
      return { paragraph, width: tightWidth, height };
    } catch {
      return null;
    }
  }, [maxTextWidth, message]);

  useEffect(() => {
    cancelAnimation(translateY);
    cancelAnimation(pillScale);
    cancelAnimation(revealBlur);
    cancelAnimation(revealOpacity);

    if (!visible || !message) {
      translateY.value = -10;
      pillScale.value = 0.93;
      revealBlur.value = 12;
      revealOpacity.value = 0;
      return;
    }

    translateY.value = -10;
    pillScale.value = 0.93;
    revealBlur.value = 12;
    revealOpacity.value = 0;

    translateY.value = withSpring(0, { damping: 20, stiffness: 250 });
    pillScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    revealOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    revealBlur.value = withTiming(0, {
      duration: 540,
      easing: Easing.inOut(Easing.cubic),
    });

    const timeout = setTimeout(() => {
      revealBlur.value = withTiming(12, {
        duration: 300,
        easing: Easing.in(Easing.cubic),
      });
      pillScale.value = withTiming(0.94, {
        duration: 280,
        easing: Easing.in(Easing.cubic),
      });
      translateY.value = withTiming(-8, {
        duration: 280,
        easing: Easing.in(Easing.cubic),
      });
      revealOpacity.value = withTiming(
        0,
        { duration: 280, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(notifyHidden)();
          }
        },
      );
    }, displayDurationMs);

    return () => clearTimeout(timeout);
  }, [
    visible,
    message,
    triggerKey,
    displayDurationMs,
    notifyHidden,
    pillScale,
    revealBlur,
    revealOpacity,
    translateY,
  ]);

  const containerTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: pillScale.value },
    ],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
  }));

  if (!visible || !message) return null;

  const textLeftPad = showMascot
    ? MASCOT_LEFT_PAD + MASCOT_SIZE + MASCOT_GAP
    : PILL_PAD_X;
  const textRightPad = showMascot ? MASCOT_RIGHT_PAD : PILL_PAD_X;
  const pillWidth = skiaParagraph
    ? Math.min(340, skiaParagraph.width + textLeftPad + textRightPad)
    : 0;
  const pillHeight = skiaParagraph
    ? Math.max(showMascot ? 52 : 36, skiaParagraph.height + PILL_PAD_Y * 2)
    : 0;
  const textY = skiaParagraph ? (pillHeight - skiaParagraph.height) / 2 : 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { top: topOffset ?? insets.top + 66 },
        containerTransformStyle,
      ]}
    >
      {skiaParagraph ? (
        <View
          style={{
            width: pillWidth,
            height: pillHeight,
            overflow: "visible",
          }}
        >
          <Canvas
            style={{
              width: pillWidth + BLUR_PAD * 2,
              height: pillHeight + BLUR_PAD * 2,
              marginHorizontal: -BLUR_PAD,
              marginVertical: -BLUR_PAD,
            }}
          >
            <Group
              layer={
                <Paint opacity={revealOpacity}>
                  <Blur blur={revealBlur} mode="decal" />
                </Paint>
              }
            >
              <RoundedRect
                x={BLUR_PAD}
                y={BLUR_PAD}
                width={pillWidth}
                height={pillHeight}
                r={pillHeight / 2}
                color={UI_COLORS.surfaceSubtle}
              />
              <Paragraph
                paragraph={skiaParagraph.paragraph}
                x={BLUR_PAD + textLeftPad}
                y={BLUR_PAD + textY}
                width={skiaParagraph.width}
              />
            </Group>
          </Canvas>

          {showMascot ? (
            <Animated.View
              style={[
                styles.mascotOverlay,
                {
                  top: (pillHeight - MASCOT_SIZE) / 2,
                  left: MASCOT_LEFT_PAD,
                },
                fadeStyle,
              ]}
            >
              <BrainMascot size={MASCOT_SIZE} state={state} />
            </Animated.View>
          ) : null}
        </View>
      ) : (
        <Animated.View
          style={[
            styles.fallbackPill,
            !showMascot && styles.fallbackPillTextOnly,
            fadeStyle,
          ]}
        >
          {showMascot ? (
            <View style={styles.mascotSlot}>
              <BrainMascot size={MASCOT_SIZE} state={state} />
            </View>
          ) : null}
          <Text style={styles.fallbackText} numberOfLines={2}>
            {message}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 40,
  },
  mascotOverlay: {
    position: "absolute",
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: MASCOT_GAP,
    maxWidth: 340,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingVertical: 8,
    paddingLeft: MASCOT_LEFT_PAD,
    paddingRight: MASCOT_RIGHT_PAD,
  },
  fallbackPillTextOnly: {
    paddingVertical: 9,
    paddingLeft: PILL_PAD_X,
    paddingRight: PILL_PAD_X,
  },
  mascotSlot: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    flexShrink: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: UI_COLORS.textPrimary,
  },
});
