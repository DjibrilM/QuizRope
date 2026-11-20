import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { hapticsService } from "../../services/haptics";
import { useGameStore } from "../../stores/gameStore";
import { SubjectIcon } from "./SubjectIcons";
import { BouncePress } from "../common/BouncePress";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";

const SUBJECT_ACCENTS: Record<string, { tint: string; color: string }> = {
  MATH: { tint: "rgba(96, 165, 250, 0.14)", color: "#60A5FA" },
  SCIENCE: { tint: "rgba(167, 139, 250, 0.14)", color: "#A78BFA" },
  ENGLISH: { tint: "rgba(251, 191, 36, 0.14)", color: "#FBBF24" },
  HISTORY: { tint: "rgba(244, 114, 182, 0.14)", color: "#F472B6" },
  GEOGRAPHY: { tint: "rgba(52, 211, 153, 0.14)", color: "#34D399" },
};

const FALLBACK_ACCENT = {
  tint: "rgba(108, 92, 231, 0.16)",
  color: UI_COLORS.primary,
};

interface SubjectCardProps {
  subject: string;
  selected?: boolean;
  onPress: (subject: string) => void;
}

export function SubjectCard({
  subject,
  selected = false,
  onPress,
}: SubjectCardProps) {
  const { t } = useTranslation(["common", "match"]);
  const locale = useGameStore((s) => s.locale);
  const accent = SUBJECT_ACCENTS[subject] || FALLBACK_ACCENT;
  const label = t(`common:subjects.${subject.toUpperCase()}`);
  const hint = t(`match:create.subjectHint.${subject}`);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  return (
    <BouncePress
      onPress={() => {
        hapticsService.selection();
        onPress(subject);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${hint}`}
      style={[
        styles.pill,
        selected ? styles.pillSelected : styles.pillDefault,
      ]}
    >
      <View
        style={[
          styles.iconBall,
          { backgroundColor: selected ? "rgba(255, 255, 255, 0.18)" : accent.tint },
        ]}
      >
        <SubjectIcon subject={subject} size={30} />
      </View>

      <View style={styles.textBlock}>
        <Text
          style={[
            styles.title,
            {
              fontFamily: headingFont,
              color: UI_COLORS.textPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: selected
                ? UI_COLORS.textSubtleOnPrimary
                : UI_COLORS.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {hint}
        </Text>
      </View>

      <View
        style={[
          styles.chevronWell,
          selected && styles.chevronWellSelected,
        ]}
      >
        <Ionicons
          name="chevron-forward"
          size={16}
          color={selected ? "#FFFFFF" : UI_COLORS.textMuted}
        />
      </View>
    </BouncePress>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
    gap: 12,
  },
  pillDefault: {
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  pillSelected: {
    backgroundColor: UI_COLORS.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  iconBall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
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
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
  },
  chevronWell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  chevronWellSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
