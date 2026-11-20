import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { hapticsService } from "../../services/haptics";
import { AnimatedLoader } from "../common/AnimatedLoader";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface LoginButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * Primary matte #6C5CE7 stadium pill CTA for Google Authentication with a
 * concentric white circular side badge holding the Google G emblem.
 */
export function LoginButton({
  onPress,
  loading = false,
  disabled = false,
  label,
}: LoginButtonProps) {
  const { t } = useTranslation(["auth", "common"]);
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;
  const displayLabel =
    label ?? t("auth:login.continueWithGoogle", "Continue with Google");

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (isDisabled) return;
    hapticsService.light();
    onPress();
  };

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={() => {
        if (isDisabled) return;
        scale.value = withSpring(0.985, { damping: 20, stiffness: 360 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 20, stiffness: 360 });
      }}
      activeOpacity={0.88}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={displayLabel}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      style={[
        styles.pill,
        isDisabled && styles.pillDisabled,
        animatedStyle,
      ]}
    >
      <View style={styles.iconBall}>
        {loading ? (
          <AnimatedLoader color="#14101D" size="sm" />
        ) : (
          <GoogleIcon />
        )}
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {loading ? t("common:labels.connecting", "Connecting...") : displayLabel}
      </Text>

      <View style={styles.balanceSpacer} />
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: "100%",
    height: 54,
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    backgroundColor: UI_COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  pillDisabled: {
    opacity: 0.65,
  },
  iconBall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontFamily: FONTS.bodyBlack,
    fontSize: 16,
    color: UI_COLORS.textOnPrimary,
    letterSpacing: 0.25,
  },
  balanceSpacer: {
    width: 44,
  },
});
