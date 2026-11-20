import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { soundService } from "../../services/sound";
import { hapticsService } from "../../services/haptics";
import { ConfettiOverlay } from "../common/ConfettiOverlay";
import { BrainMascot } from "../common/Mascots";
import { SubjectIcon } from "../match/SubjectIcons";
import { PillButton } from "../ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { useGameStore } from "../../stores/gameStore";
import type { GameEndResult, PlayerStats } from "@shared/types/game.types";

interface GameEndOverlayProps {
  result: GameEndResult;
  onPlayAgain: () => void;
  onExit: () => void;
  onReview?: () => void;
}

export function GameEndOverlay({
  result,
  onPlayAgain,
  onExit,
  onReview,
}: GameEndOverlayProps) {
  const { t } = useTranslation(["game", "match", "common"]);
  const insets = useSafeAreaInsets();
  const currentMatch = useGameStore((s) => s.currentMatch);
  const locale = useGameStore((s) => s.locale);
  const isSoloMode = currentMatch?.gameMode === "solo";

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const heroScale = useSharedValue(0.92);
  const actionsOpacity = useSharedValue(0);

  const leftScore = result.teamScores?.left ?? 0;
  const rightScore = result.teamScores?.right ?? 0;
  const isTie = !isSoloMode && leftScore === rightScore;
  const isRedWinner = !isTie && leftScore > rightScore;
  const isCloseMatch = Math.abs(leftScore - rightScore) <= 10;

  useEffect(() => {
    heroScale.value = withSpring(1, { damping: 20, stiffness: 220 });
    actionsOpacity.value = withDelay(180, withTiming(1, { duration: 280 }));

    soundService.play("gameEnd");
    hapticsService.heavy();
  }, [actionsOpacity, heroScale]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actionsOpacity.value,
  }));

  const soloStat: PlayerStats | undefined = result.stats?.[0];
  const soloCorrect = soloStat?.correctAnswers ?? 0;
  const soloTotal = soloStat?.totalAnswers ?? 0;
  const soloAccuracy =
    soloTotal > 0 ? Math.round((soloCorrect / soloTotal) * 100) : 0;
  const soloAvgSeconds = soloStat
    ? (soloStat.avgResponseTime / 1000).toFixed(1)
    : "0.0";
  const didStruggle = isSoloMode && soloAccuracy < 50;
  const isVeryLow = isSoloMode && soloAccuracy < 35;

  const mascotState = !didStruggle
    ? "done"
    : isVeryLow
      ? "error"
      : "idle";
  const mascotExpression = !didStruggle
    ? "joy"
    : isVeryLow
      ? "sad"
      : "mildSad";

  const subjectKey = (currentMatch?.subject || "MATH").toUpperCase();
  const subjectLabel = t(`common:subjects.${subjectKey}`, {
    defaultValue: subjectKey,
  });

  const roundsTotal = currentMatch?.maxRounds ?? soloTotal;
  const subtitleLine = isSoloMode
    ? `${subjectLabel} · ${t("common:accessibility.roundsLabel", { count: roundsTotal })}`
    : isTie
      ? t("match:detail.draw", "Draw!")
      : `${isRedWinner ? result.stats?.[0]?.displayName || t("common:teams.redTeam") : result.stats?.[1]?.displayName || t("common:teams.blueTeam")} ${t("game:end.champions")}`;

  const headlineText = isSoloMode
    ? didStruggle
      ? t("game:end.keepPracticing")
      : t("game:end.wellDone")
    : isCloseMatch
      ? t("game:end.closeMatch")
      : t("game:end.greatGame");

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.overlay}>
      <ConfettiOverlay visible={!didStruggle} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Hero block aligned with KidProfileView headerBlock */}
          <Animated.View style={[heroStyle, styles.heroBlock]}>
            <View style={styles.mascotHalo}>
              <BrainMascot
                size={80}
                state={mascotState}
                expression={mascotExpression}
              />
            </View>

            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {headlineText}
            </Text>
            <Text style={styles.subheading}>{subtitleLine}</Text>
          </Animated.View>

          {/* Concentric Stats Module aligned with KidProfileView & HomeScreen */}
          {isSoloMode ? (
            <View style={styles.statsShell}>
              {[
                [
                  {
                    key: "correct",
                    value: `${soloCorrect}/${soloTotal}`,
                    label: t("match:detail.correct", "Correct"),
                    color: UI_COLORS.mint,
                  },
                  {
                    key: "accuracy",
                    value: `${soloAccuracy}%`,
                    label: t("game:end.accuracy"),
                  },
                ],
                [
                  {
                    key: "score",
                    value: String(leftScore),
                    label: t("game:end.score"),
                  },
                  {
                    key: "avgTime",
                    value: `${soloAvgSeconds}s`,
                    label: t("game:end.avgTime"),
                  },
                ],
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.statsRow}>
                  {row.map((item) => (
                    <View key={item.key} style={styles.statTile}>
                      <Text
                        style={[
                          styles.statValue,
                          { fontFamily: headingFont },
                          item.color ? { color: item.color } : undefined,
                        ]}
                        numberOfLines={1}
                      >
                        {item.value}
                      </Text>
                      <Text style={styles.statLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              ))}

              {/* Subject Breakdown Tile */}
              <View style={styles.subjectSummaryTile}>
                <View style={styles.subjectTopRow}>
                  <View style={styles.subjectIdentity}>
                    <SubjectIcon subject={subjectKey} size={22} />
                    <Text style={styles.subjectTitle}>{subjectLabel}</Text>
                  </View>
                  <View style={styles.accuracyPill}>
                    <Text style={styles.accuracyPillText}>{soloAccuracy}%</Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(soloAccuracy, 3)}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.statsShell}>
              {[
                {
                  key: "red",
                  color: "#EF4444",
                  won: isRedWinner,
                  name:
                    result.stats?.[0]?.displayName || t("common:teams.redTeam"),
                  score: leftScore,
                  stat: result.stats?.[0],
                },
                {
                  key: "blue",
                  color: "#3B82F6",
                  won: !isTie && !isRedWinner,
                  name:
                    result.stats?.[1]?.displayName ||
                    t("common:teams.blueTeam"),
                  score: rightScore,
                  stat: result.stats?.[1],
                },
              ].map((team) => {
                const total = team.stat?.totalAnswers ?? 0;
                const correct = team.stat?.correctAnswers ?? 0;
                const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
                const avg = team.stat
                  ? (team.stat.avgResponseTime / 1000).toFixed(1)
                  : "0.0";

                return (
                  <View key={team.key} style={styles.teamTile}>
                    <View style={styles.teamHeaderRow}>
                      <View style={styles.teamIdentity}>
                        <View
                          style={[
                            styles.teamDot,
                            { backgroundColor: team.color },
                          ]}
                        />
                        <Text style={styles.teamName} numberOfLines={1}>
                          {team.name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.teamScore,
                          { fontFamily: headingFont },
                        ]}
                      >
                        {team.score}
                      </Text>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(acc, 3)}%`,
                            backgroundColor: team.won
                              ? UI_COLORS.primary
                              : "#3B3154",
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.teamMetaRow}>
                      <Text style={styles.teamMeta}>
                        {correct}/{total} {t("match:detail.correct", "Correct")}{" "}
                        · {acc}%
                      </Text>
                      <Text style={styles.teamMetaMuted}>{avg}s</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Clean Anchored Full-Pill CTA Stack */}
      <Animated.View
        style={[
          actionsStyle,
          styles.ctaDock,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <View style={styles.ctaInner}>
          <PillButton
            variant="primary"
            size="lg"
            label={t("game:end.playAgain")}
            icon={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
            onPress={onPlayAgain}
          />

          {onReview && (
            <PillButton
              variant="secondary"
              size="lg"
              label={t("game:end.reviewAnswers")}
              icon={
                <Ionicons
                  name="book-outline"
                  size={18}
                  color={UI_COLORS.textPrimary}
                />
              }
              onPress={onReview}
            />
          )}

          <PillButton
            variant="ghost"
            size="default"
            label={t("game:end.backToHome")}
            onPress={onExit}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI_COLORS.bg,
    zIndex: 50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
    justifyContent: "center",
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  heroBlock: {
    alignItems: "center",
    paddingBottom: 24,
  },
  mascotHalo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    paddingTop: 2,
  },
  subheading: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  statsShell: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    gap: 6,
  },
  statsRow: {
    flexDirection: "row",
    gap: 6,
  },
  statTile: {
    flex: 1,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 25,
    borderCurve: "continuous",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 4,
  },
  statValue: {
    flexShrink: 1,
    fontSize: 28,
    lineHeight: 34,
    color: UI_COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subjectSummaryTile: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 25,
    borderCurve: "continuous",
    padding: 16,
    gap: 10,
  },
  subjectTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subjectIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subjectTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  accuracyPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.surfaceElevated,
  },
  accuracyPillText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 12,
    color: UI_COLORS.textPrimary,
  },
  progressTrack: {
    height: 7,
    backgroundColor: "#261F36",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: UI_COLORS.primary,
  },
  teamTile: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 25,
    borderCurve: "continuous",
    padding: 16,
    gap: 10,
  },
  teamHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  teamIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    flex: 1,
    color: UI_COLORS.textPrimary,
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
  },
  teamScore: {
    fontSize: 26,
    lineHeight: 30,
    color: UI_COLORS.textPrimary,
  },
  teamMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  teamMeta: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  teamMetaMuted: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  ctaDock: {
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: UI_COLORS.bg,
  },
  ctaInner: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 10,
  },
});
