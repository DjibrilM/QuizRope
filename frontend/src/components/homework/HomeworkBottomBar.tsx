import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { hapticsService } from "../../services/haptics";

interface HomeworkBottomBarProps {
  quizCount: number;
  onOpenQuizSheet: () => void;
  onOpenChat: () => void;
  bottomInset: number;
}

export function HomeworkBottomBar({
  quizCount,
  onOpenQuizSheet,
  onOpenChat,
  bottomInset,
}: HomeworkBottomBarProps) {
  const { t } = useTranslation("homework");

  const attemptsLabel =
    quizCount === 0
      ? t("bottomBar.noQuizzesYet")
      : quizCount === 1
        ? t("bottomBar.oneAttempt")
        : t("bottomBar.attempts", { count: quizCount });

  return (
    <View
      style={[
        styles.dock,
        { paddingBottom: Math.max(bottomInset, 12) + 8 },
      ]}
    >
      <View style={styles.dockInner}>
        <TouchableOpacity
          onPress={() => {
            hapticsService.selection();
            onOpenQuizSheet();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={styles.quizzesPill}
        >
          <View style={styles.quizzesIconBall}>
            <Ionicons name="layers-outline" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.quizzesTextCol}>
            <Text style={styles.quizzesTitle} numberOfLines={1}>
              {t("bottomBar.quizzes")}
            </Text>
            <Text style={styles.quizzesSubtitle} numberOfLines={1}>
              {attemptsLabel}
            </Text>
          </View>
          <Ionicons
            name="chevron-up"
            size={16}
            color={UI_COLORS.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticsService.selection();
            onOpenChat();
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          style={styles.askPill}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FFFFFF" />
          <Text style={styles.askText} numberOfLines={1}>
            {t("chat.askShort")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: UI_COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  dockInner: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quizzesPill: {
    flex: 1,
    height: 54,
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 14,
    gap: 10,
  },
  quizzesIconBall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  quizzesTextCol: {
    flex: 1,
    gap: 1,
  },
  quizzesTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 14,
    color: UI_COLORS.textPrimary,
  },
  quizzesSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  askPill: {
    height: 54,
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    backgroundColor: UI_COLORS.primary,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  askText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
