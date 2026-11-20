import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { hapticsService } from "../../services/haptics";
import { useGameStore } from "../../stores/gameStore";
import { IconEasy, IconMedium, IconHard } from "./SubjectIcons";
import { BouncePress } from "../common/BouncePress";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";

export interface DifficultyOption {
  id: string;
  label: string;
  description: string;
  tint: string;
  Icon: React.FC<{ size?: number }>;
}

interface DifficultySelectorProps {
  selected: string;
  onSelect: (difficulty: string) => void;
  title?: string;
  options?: DifficultyOption[];
}

export function DifficultySelector({
  selected,
  onSelect,
  title,
  options,
}: DifficultySelectorProps) {
  const { t } = useTranslation(["match", "common"]);
  const locale = useGameStore((s) => s.locale);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const defaultOptions: DifficultyOption[] = [
    {
      id: "EASY",
      label: t("common:difficulties.easy"),
      description: t("common:difficulties.easyDesc"),
      tint: "rgba(16, 185, 129, 0.14)",
      Icon: IconEasy,
    },
    {
      id: "MEDIUM",
      label: t("common:difficulties.medium"),
      description: t("common:difficulties.mediumDesc"),
      tint: "rgba(245, 158, 11, 0.14)",
      Icon: IconMedium,
    },
    {
      id: "HARD",
      label: t("common:difficulties.hard"),
      description: t("common:difficulties.hardDesc"),
      tint: "rgba(239, 68, 68, 0.14)",
      Icon: IconHard,
    },
  ];

  const items = options ?? defaultOptions;

  const handleSelect = (id: string) => {
    if (selected === id) return;
    hapticsService.selection();
    onSelect(id);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        {title ?? t("match:selectors.difficulty")}
      </Text>
      <View style={styles.list}>
        {items.map((item) => {
          const isSelected = selected === item.id;
          return (
            <BouncePress
              key={item.id}
              onPress={() => handleSelect(item.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t("common:accessibility.difficultyLabel", {
                label: item.label,
                desc: item.description,
              })}
              style={[
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillDefault,
              ]}
            >
              <View
                style={[
                  styles.iconBall,
                  {
                    backgroundColor: isSelected
                      ? "rgba(255, 255, 255, 0.18)"
                      : item.tint,
                  },
                ]}
              >
                <item.Icon size={28} />
              </View>

              <View style={styles.textBlock}>
                <Text
                  style={[
                    styles.title,
                    {
                      fontFamily: headingFont,
                      color: isSelected
                        ? UI_COLORS.textOnPrimary
                        : UI_COLORS.textPrimary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.description,
                    {
                      color: isSelected
                        ? UI_COLORS.textSubtleOnPrimary
                        : UI_COLORS.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.description}
                </Text>
              </View>

              <View
                style={[
                  styles.radioOuter,
                  isSelected
                    ? styles.radioOuterSelected
                    : styles.radioOuterUnselected,
                ]}
              >
                {isSelected ? <View style={styles.radioInnerDot} /> : null}
              </View>
            </BouncePress>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  list: {
    gap: 10,
  },
  pill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
