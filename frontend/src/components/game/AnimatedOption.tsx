import React, { useEffect, useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { formatMathMarkdown } from "../common/MathMarkdown";
import { soundService } from "../../services/sound";
import { hapticsService } from "../../services/haptics";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedOptionProps {
  label: string;
  optionText: string;
  index: number;
  questionId: string;
  staggerDelay: number;
  variant: "default" | "selected" | "correct" | "wrong";
  teamColor: string;
  disabled: boolean;
  onPress: () => void;
  compact?: boolean;
}

export function AnimatedOption({
  label,
  optionText,
  index,
  questionId,
  staggerDelay,
  variant,
  disabled,
  onPress,
  compact = false,
}: AnimatedOptionProps) {
  void index;
  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(8);
  const opacity = useSharedValue(0);
  const dimOpacity = useSharedValue(1);
  const feedbackScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    scale.value = 0.96;
    translateY.value = 8;
    opacity.value = 0;
    dimOpacity.value = 1;
    feedbackScale.value = 1;
    shakeX.value = 0;

    const ease = { duration: 120, easing: Easing.out(Easing.cubic) };
    scale.value = withDelay(staggerDelay, withTiming(1, ease));
    translateY.value = withDelay(staggerDelay, withTiming(0, ease));
    opacity.value = withDelay(staggerDelay, withTiming(1, { duration: 110 }));
  }, [opacity, questionId, scale, shakeX, staggerDelay, translateY, dimOpacity, feedbackScale]);

  useEffect(() => {
    if (disabled && variant === "default") {
      dimOpacity.value = withTiming(0.38, { duration: 130 });
    }
  }, [dimOpacity, disabled, variant]);

  useEffect(() => {
    if (variant === "correct") {
      feedbackScale.value = withSequence(
        withTiming(1.03, { duration: 85 }),
        withTiming(1, { duration: 110 }),
      );
    } else if (variant === "wrong") {
      shakeX.value = withSequence(
        withTiming(-5, { duration: 40 }),
        withTiming(5, { duration: 40 }),
        withTiming(-3, { duration: 35 }),
        withTiming(0, { duration: 35 }),
      );
    }
  }, [feedbackScale, shakeX, variant]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * feedbackScale.value },
      { translateY: translateY.value },
      { translateX: shakeX.value },
    ],
    opacity: opacity.value * dimOpacity.value,
  }));

  const palette = (() => {
    if (variant === "correct") {
      return {
        bg: "rgba(52, 211, 153, 0.14)",
        border: "rgba(52, 211, 153, 0.48)",
        badgeBg: "rgba(52, 211, 153, 0.22)",
        text: UI_COLORS.mint,
        letter: UI_COLORS.mint,
        math: UI_COLORS.mint,
      };
    }
    if (variant === "wrong") {
      return {
        bg: "rgba(239, 68, 68, 0.14)",
        border: "rgba(239, 68, 68, 0.48)",
        badgeBg: "rgba(239, 68, 68, 0.22)",
        text: "#EF4444",
        letter: "#EF4444",
        math: "#EF4444",
      };
    }
    if (variant === "selected") {
      return {
        bg: UI_COLORS.primary,
        border: "rgba(255, 255, 255, 0.2)",
        badgeBg: "rgba(255, 255, 255, 0.2)",
        text: "#FFFFFF",
        letter: "#FFFFFF",
        math: "#FFFFFF",
      };
    }
    return {
      bg: "#1A1520",
      border: "rgba(255, 255, 255, 0.06)",
      badgeBg: "#241D2E",
      text: UI_COLORS.textPrimary,
      letter: UI_COLORS.textSecondary,
      math: "#F9FAFB",
    };
  })();

  const processedMarkdown = useMemo(
    () => formatMathMarkdown(optionText, palette.math),
    [optionText, palette.math],
  );

  const handlePress = () => {
    onPress();
    soundService.play("buttonPress");
    hapticsService.selection();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled}
      style={[
        animatedStyle,
        styles.base,
        compact ? styles.compactPill : styles.soloPill,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
    >
      <View
        style={[
          styles.letterBall,
          compact ? styles.letterBallCompact : styles.letterBallSolo,
          { backgroundColor: palette.badgeBg },
        ]}
      >
        <Text
          style={[
            styles.letterText,
            {
              color: palette.letter,
              fontSize: compact ? 12 : 14,
            },
          ]}
        >
          {label}
        </Text>
      </View>

      <View style={styles.contentWrap}>
        <EnrichedMarkdownText
          flavor="github"
          markdown={processedMarkdown}
          onLinkPress={({ url }) => Linking.openURL(url)}
          markdownStyle={{
            paragraph: {
              color: palette.text,
              fontSize: compact ? 13 : 15,
              lineHeight: compact ? 18 : 21,
            },
            code: {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: palette.text,
            },
            math: {
              color: palette.math,
              backgroundColor: "transparent",
            },
            inlineMath: {
              color: palette.math,
            },
          }}
        />
      </View>

      {variant === "correct" && (
        <Ionicons
          name="checkmark-circle"
          size={compact ? 18 : 22}
          color={UI_COLORS.mint}
        />
      )}
      {variant === "wrong" && (
        <Ionicons
          name="close-circle"
          size={compact ? 18 : 22}
          color="#EF4444"
        />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderCurve: "continuous",
  },
  soloPill: {
    borderRadius: UI_RADII.pill,
    minHeight: 56,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    gap: 12,
  },
  compactPill: {
    borderRadius: 18,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  letterBall: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: UI_RADII.pill,
  },
  letterBallSolo: {
    width: 44,
    height: 44,
  },
  letterBallCompact: {
    width: 26,
    height: 26,
  },
  letterText: {
    fontFamily: FONTS.bodyExtraBold,
  },
  contentWrap: {
    flex: 1,
    paddingVertical: 2,
  },
});
