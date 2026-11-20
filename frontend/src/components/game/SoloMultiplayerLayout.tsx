import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { MascotBuddy } from "../common/MascotBuddy";
import {
  BrainMascot,
  type OrbExpressionName,
  type OrbState,
} from "../common/Mascots";
import { QuestionCard } from "./QuestionCard";
import { TimerBar } from "./TimerBar";
import { GameEndOverlay } from "./GameEndOverlay";
import { StreakBadge } from "./StreakBadge";
import { ScorePop } from "./ScorePop";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import type { StoreQuestion, StoreRoundResult } from "../../stores/gameStore";
import type { GameEndResult } from "@shared/types/game.types";

interface SoloMultiplayerLayoutProps {
  isSoloMode: boolean;
  isChildDevice: boolean;
  scorePopKey: { left: number; right: number };
  teamScores: { left: number; right: number };
  timeRemaining: number;
  currentRound: number;
  maxRounds: number;
  currentQuestion: StoreQuestion | null;
  selectedAnswerLeft: number | null;
  selectedAnswerRight: number | null;
  roundResult: StoreRoundResult | null;
  showResult: boolean;
  showGameEnd: boolean;
  gameEndResult: GameEndResult | null;
  onAbandon: () => void;
  onAnswer: (index: number, side: "LEFT" | "RIGHT") => void;
  onPlayAgain: () => void;
  onExit: () => void;
  onReview: () => void;
  mascotState?: OrbState;
  mascotExpression?: OrbExpressionName;
  buddyMessage: string;
  buddyVisible: boolean;
  buddyTriggerKey?: number;
  buddyState?: OrbState;
  onHideBuddy: () => void;
}

export function SoloMultiplayerLayout({
  scorePopKey,
  teamScores,
  timeRemaining,
  currentRound,
  maxRounds,
  currentQuestion,
  selectedAnswerLeft,
  roundResult,
  showResult,
  showGameEnd,
  gameEndResult,
  onAbandon,
  onAnswer,
  onPlayAgain,
  onExit,
  onReview,
  mascotState = "idle",
  mascotExpression,
  buddyMessage,
  buddyVisible,
  buddyTriggerKey = 0,
  buddyState = "done",
  onHideBuddy,
}: SoloMultiplayerLayoutProps) {
  const { t } = useTranslation(["game", "common"]);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.root}>
      {/* Fixed single-row HUD with detached floating streak slot so nothing shifts layout */}
      <View style={styles.hudWrapper}>
        <View style={styles.hudContainer}>
          <TouchableOpacity
            onPress={onAbandon}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t("common:accessibility.goBack")}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={18}
              color={UI_COLORS.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.centerMeta}>
            <View style={styles.roundMascotPill}>
              <BrainMascot
                size={32}
                state={mascotState}
                expression={mascotExpression}
                interactive
              />
              <Text style={styles.roundText} numberOfLines={1}>
                {t("game:roundLabel", {
                  current: currentRound,
                  max: maxRounds,
                })}
              </Text>
            </View>
          </View>

          <View style={styles.rightCluster}>
            <TimerBar timeRemaining={timeRemaining} maxTime={30} size={40} />
            <View style={styles.scorePill}>
              {scorePopKey.left > 0 && (
                <ScorePop key={`left-${scorePopKey.left}`} side="left" />
              )}
              <Text style={styles.scoreLabel}>
                {t("game:scoreboard.score")}
              </Text>
              <Text style={styles.scoreValue}>{teamScores.left}</Text>
            </View>
          </View>
        </View>

        <View pointerEvents="none" style={styles.streakFloatRow}>
          <StreakBadge />
        </View>
      </View>

      {/* Main question & full-pill answers */}
      <View style={styles.stage}>
        <QuestionCard
          question={currentQuestion}
          selectedAnswer={selectedAnswerLeft}
          correctIndex={currentQuestion?.correctIndex}
          roundResult={showResult ? roundResult : null}
          onAnswer={(index) => onAnswer(index, "LEFT")}
          teamSide="LEFT"
          teamColor={UI_COLORS.primary}
        />
      </View>

      {showGameEnd && gameEndResult && (
        <GameEndOverlay
          result={gameEndResult}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
          onReview={onReview}
        />
      )}

      <MascotBuddy
        message={buddyMessage}
        triggerKey={buddyTriggerKey}
        state={buddyState}
        showMascot={false}
        topOffset={insets.top + 92}
        visible={buddyVisible}
        onHide={onHideBuddy}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  hudWrapper: {
    position: "relative",
    zIndex: 20,
  },
  hudContainer: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  centerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  streakFloatRow: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 4,
  },
  roundMascotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    borderRadius: UI_RADII.pill,
    paddingVertical: 4,
    paddingLeft: 5,
    paddingRight: 12,
  },
  roundText: {
    color: UI_COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 0.4,
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scorePill: {
    position: "relative",
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scoreLabel: {
    color: UI_COLORS.textMuted,
    fontSize: 10,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  scoreValue: {
    color: UI_COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bodyBlack,
  },
  stage: {
    flex: 1,
  },
});
