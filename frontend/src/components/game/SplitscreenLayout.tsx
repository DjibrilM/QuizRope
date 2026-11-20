import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { QuestionCard } from "./QuestionCard";
import { GameEndOverlay } from "./GameEndOverlay";
import { ScorePop } from "./ScorePop";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import type { StoreQuestion } from "../../stores/gameStore";
import type { GameEndResult } from "@shared/types/game.types";

interface SplitscreenLayoutProps {
  p1Name: string;
  p2Name: string;
  p1Id?: string;
  matchId: string | string[] | undefined;
  subject: string;
  scorePopKey: { left: number; right: number };
  teamScores: { left: number; right: number };
  currentQuestion: StoreQuestion | null;
  selectedAnswerLeft: number | null;
  selectedAnswerRight: number | null;
  allAnswered: boolean;
  timeRemaining: number;
  currentRound: number;
  maxRounds: number;
  onAnswer: (index: number, side: "LEFT" | "RIGHT") => void;
  onAbandon: () => void;
  showGameEnd: boolean;
  gameEndResult: GameEndResult | null;
  onPlayAgain: () => void;
  onExit: () => void;
  onReview: () => void;
}

export function SplitscreenLayout({
  p1Name,
  p2Name,
  scorePopKey,
  teamScores,
  currentQuestion,
  selectedAnswerLeft,
  selectedAnswerRight,
  allAnswered,
  timeRemaining,
  currentRound,
  maxRounds,
  onAnswer,
  onAbandon,
  showGameEnd,
  gameEndResult,
  onPlayAgain,
  onExit,
  onReview,
}: SplitscreenLayoutProps) {
  useEffect(() => {
    if (showGameEnd) {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  }, [showGameEnd]);

  const totalScore = teamScores.left + teamScores.right;
  const targetRatio = totalScore > 0 ? teamScores.left / totalScore : 0.5;
  const momentumRatio = useSharedValue(targetRatio);

  useEffect(() => {
    momentumRatio.value = withSpring(targetRatio, {
      damping: 18,
      stiffness: 170,
    });
  }, [momentumRatio, targetRatio]);

  const redBarStyle = useAnimatedStyle(() => ({
    height: `${Math.max(8, Math.min(92, momentumRatio.value * 100))}%`,
  }));

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles.root}
    >
      <View style={styles.arena}>
        {/* P1 LEFT HALF */}
        <View style={styles.playerHalf}>
          <View style={styles.playerHeader}>
            <View style={styles.nameChip}>
              <View style={[styles.teamDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.nameText} numberOfLines={1}>
                {p1Name || "Red Team"}
              </Text>
            </View>
            <View style={styles.playerScorePill}>
              {scorePopKey.left > 0 && (
                <ScorePop key={`left-${scorePopKey.left}`} side="left" />
              )}
              <Text style={styles.playerScoreValue}>{teamScores.left}</Text>
            </View>
          </View>

          <View style={styles.cardWrap}>
            <QuestionCard
              question={currentQuestion}
              selectedAnswer={selectedAnswerLeft}
              correctIndex={
                allAnswered ? currentQuestion?.correctIndex : undefined
              }
              roundResult={null}
              onAnswer={(index) => onAnswer(index, "LEFT")}
              teamSide="LEFT"
              teamColor="#EF4444"
              compact
            />
          </View>
        </View>

        {/* CENTER DIVIDER SPINE */}
        <View style={styles.dividerSpine}>
          <TouchableOpacity
            onPress={onAbandon}
            activeOpacity={0.75}
            style={styles.spineCloseButton}
          >
            <Ionicons
              name="close"
              size={15}
              color={UI_COLORS.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.spineRoundBadge}>
            <Text style={styles.spineRoundText}>
              {currentRound}/{maxRounds}
            </Text>
          </View>

          <View
            style={[
              styles.spineTimerPill,
              timeRemaining <= 5 && styles.spineTimerUrgent,
            ]}
          >
            <Text
              style={[
                styles.spineTimerText,
                timeRemaining <= 5 && styles.spineTimerTextUrgent,
              ]}
            >
              {timeRemaining}
            </Text>
          </View>

          {/* Animated Red-vs-Blue momentum track */}
          <View style={styles.momentumTrack}>
            <Animated.View style={[styles.momentumRedFill, redBarStyle]} />
          </View>
        </View>

        {/* P2 RIGHT HALF (rotated 180 deg) */}
        <View style={[styles.playerHalf, styles.rotatedHalf]}>
          <View style={styles.playerHeader}>
            <View style={styles.nameChip}>
              <View style={[styles.teamDot, { backgroundColor: "#3B82F6" }]} />
              <Text style={styles.nameText} numberOfLines={1}>
                {p2Name || "Blue Team"}
              </Text>
            </View>
            <View style={styles.playerScorePill}>
              {scorePopKey.right > 0 && (
                <ScorePop key={`right-${scorePopKey.right}`} side="right" />
              )}
              <Text style={styles.playerScoreValue}>{teamScores.right}</Text>
            </View>
          </View>

          <View style={styles.cardWrap}>
            <QuestionCard
              question={currentQuestion}
              selectedAnswer={selectedAnswerRight}
              correctIndex={
                allAnswered ? currentQuestion?.correctIndex : undefined
              }
              roundResult={null}
              onAnswer={(index) => onAnswer(index, "RIGHT")}
              teamSide="RIGHT"
              teamColor="#3B82F6"
              compact
            />
          </View>
        </View>
      </View>

      {showGameEnd && gameEndResult && (
        <GameEndOverlay
          result={gameEndResult}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
          onReview={onReview}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  arena: {
    flex: 1,
    flexDirection: "row",
  },
  playerHalf: {
    flex: 1,
    flexDirection: "column",
  },
  rotatedHalf: {
    transform: [{ rotate: "180deg" }],
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 8,
  },
  nameChip: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nameText: {
    color: UI_COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
  },
  playerScorePill: {
    position: "relative",
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  playerScoreValue: {
    color: UI_COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bodyBlack,
  },
  cardWrap: {
    flex: 1,
    padding: 4,
  },
  dividerSpine: {
    width: 54,
    backgroundColor: UI_COLORS.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  spineCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  spineRoundBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.surfaceSubtle,
  },
  spineRoundText: {
    color: UI_COLORS.textSecondary,
    fontSize: 10,
    fontFamily: FONTS.bodyExtraBold,
  },
  spineTimerPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: UI_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  spineTimerUrgent: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  spineTimerText: {
    color: UI_COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bodyBlack,
  },
  spineTimerTextUrgent: {
    color: "#EF4444",
  },
  momentumTrack: {
    flex: 1,
    width: 8,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    overflow: "hidden",
  },
  momentumRedFill: {
    width: "100%",
    backgroundColor: "#EF4444",
  },
});
