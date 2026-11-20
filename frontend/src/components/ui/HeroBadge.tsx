import React from "react";
import { StyleSheet, View } from "react-native";
import { UI_RADII } from "../../constants/theme";

interface HeroBadgeProps {
  children: React.ReactNode;
}

/**
 * Signature 72x64 rounded badge container inspired by Twende's PhoneCard:
 * anchors the top-left of onboarding screens with subtle popped-out mascot overflow.
 */
export function HeroBadge({ children }: HeroBadgeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.mascotOverflow}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 72,
    height: 64,
    borderRadius: UI_RADII.badge,
    backgroundColor: "#1A1520",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
  },
  mascotOverflow: {
    marginTop: -6,
  },
});
