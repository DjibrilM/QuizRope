import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { FONTS, UI_COLORS } from "../../constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TimerBarProps {
  timeRemaining: number;
  maxTime: number;
  size?: number;
}

const STROKE = 3.5;

export function TimerBar({ timeRemaining, maxTime, size = 44 }: TimerBarProps) {
  const { t } = useTranslation("common");
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(timeRemaining / maxTime);
  const pulse = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(timeRemaining / maxTime, { duration: 900 });
  }, [maxTime, progress, timeRemaining]);

  useEffect(() => {
    if (timeRemaining <= 5 && timeRemaining > 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 280 }),
          withTiming(1, { duration: 280 }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 180 });
    }
  }, [pulse, timeRemaining <= 5]);

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    stroke: interpolateColor(
      progress.value,
      [0, 0.25, 0.55, 1],
      ["#EF4444", "#FBBF24", UI_COLORS.primary, UI_COLORS.primary],
    ),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        containerStyle,
        styles.container,
        { width: size, height: size },
      ]}
      accessibilityRole="timer"
      accessibilityLabel={t("accessibility.secondsRemaining", {
        count: timeRemaining,
      })}
    >
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={UI_COLORS.surfaceElevated}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={circleProps}
          strokeLinecap="round"
        />
      </Svg>
      <Text
        style={[
          styles.label,
          timeRemaining <= 5 && styles.labelUrgent,
        ]}
      >
        {timeRemaining}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    color: UI_COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bodyExtraBold,
  },
  labelUrgent: {
    color: "#EF4444",
  },
});
