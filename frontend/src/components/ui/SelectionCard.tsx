import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { useGameStore } from "../../stores/gameStore";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SelectionCardProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  renderIcon: (selected: boolean) => React.ReactNode;
  accessibilityHint?: string;
}

/**
 * Fully rounded pill option card with a circular side ball icon well
 * and concentric radio indicator on a calm matte dark surface.
 */
export function SelectionCard({
  title,
  description,
  selected,
  onPress,
  renderIcon,
  accessibilityHint,
}: SelectionCardProps) {
  const scale = useSharedValue(1);
  const locale = useGameStore((s) => s.locale);
  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.985, { damping: 22, stiffness: 360 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 22, stiffness: 360 });
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${description}`}
      accessibilityHint={accessibilityHint}
      style={[
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
        animatedStyle,
      ]}
    >
      {/* Rounded side ball containing the role icon */}
      <View
        style={[
          styles.iconBall,
          selected ? styles.iconBallSelected : styles.iconBallUnselected,
        ]}
      >
        {renderIcon(selected)}
      </View>

      {/* Text hierarchy */}
      <View style={styles.textBlock}>
        <Text
          style={[
            styles.title,
            {
              fontFamily: headingFont,
              color: selected ? UI_COLORS.textOnPrimary : UI_COLORS.textPrimary,
            },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.description,
            {
              color: selected
                ? UI_COLORS.textSubtleOnPrimary
                : UI_COLORS.textSecondary,
            },
          ]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>

      {/* Concentric radio indicator */}
      <View
        style={[
          styles.radioOuter,
          selected ? styles.radioOuterSelected : styles.radioOuterUnselected,
        ]}
      >
        {selected && <View style={styles.radioInnerDot} />}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: UI_RADII.pill,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 16,
    gap: 12,
  },
  cardUnselected: {
    backgroundColor: "#1A1520",
  },
  cardSelected: {
    backgroundColor: UI_COLORS.primary,
  },
  iconBall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBallUnselected: {
    backgroundColor: "#241D2E",
  },
  iconBallSelected: {
    backgroundColor: "#5746CE",
  },
  textBlock: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    paddingTop: 1,
    letterSpacing: 0.4,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterUnselected: {
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  radioOuterSelected: {
    borderColor: "#FFFFFF",
  },
  radioInnerDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
});
