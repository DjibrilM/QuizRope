import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PillButton } from "./PillButton";
import { FONTS, UI_COLORS } from "../../constants/theme";

interface StateCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tone?: "neutral" | "error";
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Minimal obsidian surface card for empty and error states.
 */
export function StateCard({
  icon,
  title,
  subtitle,
  tone = "neutral",
  actionLabel,
  onAction,
}: StateCardProps) {
  const isError = tone === "error";

  return (
    <View style={styles.card}>
      <View style={[styles.iconHalo, isError && styles.iconHaloError]}>
        <Ionicons
          name={icon}
          size={26}
          color={isError ? UI_COLORS.coral : UI_COLORS.textSecondary}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <PillButton
          label={actionLabel}
          variant="secondary"
          size="default"
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  iconHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconHaloError: {
    backgroundColor: "rgba(232, 93, 117, 0.14)",
  },
  title: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  action: {
    marginTop: 8,
    minWidth: 150,
  },
});
