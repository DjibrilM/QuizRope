import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../stores/gameStore";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

export function StreakBadge() {
  const { t } = useTranslation("game");
  const streak = useGameStore((s) => s.streak);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (streak >= 2) {
      scale.value = withSequence(
        withSpring(1.12, { damping: 14, stiffness: 220 }),
        withSpring(1, { damping: 16, stiffness: 220 }),
      );
      rotation.value = withSequence(
        withTiming(-5, { duration: 75 }),
        withTiming(5, { duration: 75 }),
        withTiming(0, { duration: 90 }),
      );
    } else {
      scale.value = withTiming(0, { duration: 140 });
    }
  }, [rotation, scale, streak]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  if (streak < 2) return null;

  return (
    <Animated.View style={[animStyle, styles.pill]}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="#FFFFFF">
        <Path d="M12 2C9 7 4 9 4 14a8 8 0 0016 0c0-5-5-7-8-12z" />
      </Svg>
      <Text style={styles.text}>{t("streak", { count: streak })}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: UI_COLORS.primary,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
  },
});
