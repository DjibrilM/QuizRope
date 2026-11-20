import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGameStore } from "../../stores/gameStore";
import type { SupportedLanguage } from "../../i18n";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

const FLAG_MAP: Record<SupportedLanguage, string> = {
  en: "\uD83C\uDDFA\uD83C\uDDF8",
  zh: "\uD83C\uDDE8\uD83C\uDDF3",
  hi: "\uD83C\uDDEE\uD83C\uDDF3",
  es: "\uD83C\uDDEA\uD83C\uDDF8",
  fr: "\uD83C\uDDEB\uD83C\uDDF7",
  ar: "\uD83C\uDDF8\uD83C\uDDE6",
  bn: "\uD83C\uDDE7\uD83C\uDDE9",
  pt: "\uD83C\uDDE7\uD83C\uDDF7",
  ru: "\uD83C\uDDF7\uD83C\uDDFA",
  ja: "\uD83C\uDDEF\uD83C\uDDF5",
};

interface LanguagePillProps {
  onPress: () => void;
  /** Strip card fill/border when hosted inside a native Liquid Glass header bar. */
  transparent?: boolean;
}

/**
 * Compact header pill showing current locale flag, ISO code, and chevron.
 */
export function LanguagePill({
  onPress,
  transparent = false,
}: LanguagePillProps) {
  const locale = useGameStore((s) => s.locale);
  const flag = FLAG_MAP[locale] || FLAG_MAP.en;
  const code = (locale || "en").toUpperCase();

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Language: ${code}`}
      style={[styles.pill, transparent && styles.pillTransparent]}
    >
      <Text style={styles.flag}>{flag}</Text>
      <Text style={styles.code}>{code}</Text>
      <Ionicons
        name="chevron-down"
        size={13}
        color={transparent ? UI_COLORS.textPrimary : UI_COLORS.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillTransparent: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  flag: {
    fontSize: 15,
  },
  code: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: UI_COLORS.textPrimary,
    letterSpacing: 0.4,
  },
});
