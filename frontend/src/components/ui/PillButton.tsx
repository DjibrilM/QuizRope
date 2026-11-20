import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PillButtonVariant = "primary" | "secondary" | "ghost";
export type PillButtonSize = "sm" | "default" | "lg";

interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  loading?: boolean;
  disabled?: boolean;
  withHaptics?: boolean;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHT_MAP: Record<PillButtonSize, number> = {
  sm: 40,
  default: 48,
  lg: 54,
};

const FONT_SIZE_MAP: Record<PillButtonSize, number> = {
  sm: 14,
  default: 15,
  lg: 16,
};

/**
 * Tactile full-pill action button in QuizRope's matte palette
 * with subtle spring press feedback and optional light haptics.
 */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  withHaptics = true,
  icon,
  rightSlot,
  style,
  accessibilityLabel,
}: PillButtonProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (isDisabled) return;
    if (withHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const containerStyle = (): ViewStyle => {
    if (variant === "primary") {
      return {
        backgroundColor:
          !isDisabled && pressed ? UI_COLORS.primaryPressed : UI_COLORS.primary,
      };
    }

    if (variant === "secondary") {
      return {
        backgroundColor: pressed ? "#251E2E" : "#1A1520",
      };
    }

    return {
      backgroundColor: pressed ? "#1A1520" : "transparent",
    };
  };

  const textColor = (() => {
    if (variant === "primary") {
      return UI_COLORS.textOnPrimary;
    }
    if (variant === "secondary") {
      return isDisabled ? UI_COLORS.textMuted : UI_COLORS.textPrimary;
    }
    return isDisabled ? UI_COLORS.textMuted : UI_COLORS.textSecondary;
  })();

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        if (isDisabled) return;
        setPressed(true);
        scale.value = withSpring(0.985, { damping: 20, stiffness: 360 });
      }}
      onPressOut={() => {
        setPressed(false);
        scale.value = withSpring(1, { damping: 20, stiffness: 360 });
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        { height: HEIGHT_MAP[size], opacity: isDisabled ? 0.55 : 1 },
        containerStyle(),
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#FFFFFF" : UI_COLORS.textSecondary}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={styles.leftIcon}>{icon}</View> : null}
          <Text
            style={[
              styles.label,
              {
                color: textColor,
                fontSize: FONT_SIZE_MAP[size],
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  leftIcon: {
    marginRight: 10,
  },
  rightSlot: {
    marginLeft: 8,
  },
  label: {
    fontFamily: FONTS.bodyBlack,
    letterSpacing: 0.1,
  },
});
