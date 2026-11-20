import { useState, useCallback, forwardRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiService } from "../../services/api";
import * as guestDb from "../../services/guestDb";
import { useGameStore } from "../../stores/gameStore";
import { AnimatedLoader } from "../common";
import {
  FloatingBottomSheet,
  FloatingBottomSheetScrollView,
  FloatingBottomSheetView,
  PillButton,
  type FloatingBottomSheetRef,
} from "../ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { MatchStatus } from "@shared/types/match.types";
import { hapticsService } from "../../services/haptics";

export interface QuizScore {
  correct: number;
  total: number;
  accuracy: number;
}

interface HomeworkQuizSheetProps {
  sessionId: string;
  session: any;
  onSessionUpdate: (updatedSession: any) => void;
}

export const HomeworkQuizSheet = forwardRef<
  FloatingBottomSheetRef,
  HomeworkQuizSheetProps
>(({ sessionId, session, onSessionUpdate }, ref) => {
  const { t } = useTranslation(["homework", "common"]);
  const insets = useSafeAreaInsets();
  const { setCurrentMatch, setCorrections, userRole, locale } = useGameStore();
  const isGuest = userRole === "guest";

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const [quizScores, setQuizScores] = useState<Record<string, QuizScore>>({});
  const [loadingScores, setLoadingScores] = useState(false);

  const linkedMatchIds: string[] = session?.linkedMatchIds?.length
    ? session.linkedMatchIds
    : session?.linkedMatchId
      ? [session.linkedMatchId]
      : [];

  const quizCount = linkedMatchIds.length;

  const fetchScores = async () => {
    if (linkedMatchIds.length === 0) return;

    const missing = linkedMatchIds.filter((id) => !quizScores[id]);
    if (missing.length === 0) return;

    setLoadingScores(true);
    const fetched: Record<string, QuizScore> = {};
    await Promise.all(
      missing.map(async (matchId) => {
        try {
          const items = isGuest
            ? await guestDb.getCorrections(matchId)
            : await apiService.getSoloMatchCorrection(matchId);
          const correct = (items as any[]).filter((i) => i.isCorrect).length;
          const total = (items as any[]).length;
          fetched[matchId] = {
            correct,
            total,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
          };
        } catch {
          // score stays undefined — handled in UI
        }
      }),
    );
    setQuizScores((prev) => ({ ...prev, ...fetched }));
    setLoadingScores(false);
  };

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index >= 0) {
        fetchScores();
      }
    },
    [linkedMatchIds, quizScores],
  );

  const openCorrectionMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const items = isGuest
        ? await guestDb.getCorrections(matchId)
        : await apiService.getSoloMatchCorrection(matchId);
      return { matchId, items };
    },
    onSuccess: ({ matchId, items }) => {
      setCorrections(items as any, matchId);
      if (ref && "current" in ref && ref.current) {
        ref.current.dismiss();
      }
      router.push({
        pathname: "/match/correction",
        params: {
          matchId,
          sessionId,
          ...(session?.subject ? { subject: session.subject } : {}),
        },
      });
    },
    onError: (err) => {
      console.error("Failed to load correction:", err);
    },
  });

  const startQuizMutation = useMutation({
    mutationFn: async () => {
      const subject = (session.subject || "SCIENCE").toUpperCase();
      const teams = [
        { name: t("common:teams.redTeam"), color: "#EF4444", side: "LEFT" },
        { name: t("common:teams.blueTeam"), color: "#3B82F6", side: "RIGHT" },
      ];

      if (isGuest) {
        const { questions } = await apiService.generateGuestMatch({
          subject,
          difficulty: "EASY",
          maxRounds: 8,
          context: session.answersMarkdown,
          language: locale,
        });
        const matchId = Crypto.randomUUID();
        const now = Date.now();
        await guestDb.saveMatch({
          _id: matchId,
          subject,
          difficulty: "EASY",
          gameMode: "solo",
          maxRounds: 8,
          status: "IN_PROGRESS",
          roundsPlayed: 0,
          createdAt: now,
          context: session.answersMarkdown,
          language: locale,
          scoreLeft: 0,
          scoreRight: 0,
        });
        await guestDb.saveQuestions(
          matchId,
          questions.map((q, i) => ({ ...q, id: `${matchId}-q${i}` })),
        );
        const updatedIds = [...linkedMatchIds, matchId];
        await guestDb
          .updateHomeworkSession(sessionId, {
            quizTaken: true,
            linkedMatchIds: updatedIds,
          })
          .catch(() => {});

        return {
          _id: matchId,
          subject,
          difficulty: "EASY",
          maxRounds: 8,
          questions: questions.map((q, i) => ({
            ...q,
            id: `${matchId}-q${i}`,
          })),
          teams,
          createdAt: new Date(now),
        };
      }

      const created = await apiService.createMatch({
        subject,
        difficulty: "EASY",
        maxRounds: 8,
        gameMode: "solo",
        context: session.answersMarkdown,
        teams,
        language: locale,
      });

      await apiService
        .linkHomeworkMatch(sessionId, (created as any)._id)
        .catch(() => {});
      return created;
    },
    onSuccess: (created) => {
      const matchId = (created as any)._id;
      const updatedSession = {
        ...session,
        quizTaken: true,
        linkedMatchIds: [...(session.linkedMatchIds || []), matchId],
        linkedMatchId: matchId,
      };

      onSessionUpdate(updatedSession);

      const match = {
        ...(created as any),
        id: matchId,
        gameMode: "solo" as const,
        teams: ((created as any).teams || []).map((tm: any, i: number) => ({
          id: tm._id || tm.id || `team-${i}`,
          name: tm.name,
          color: tm.color,
          side: tm.side,
          players: tm.players || [],
        })),
        ropePosition: 0,
        currentQuestionIndex: 0,
        status: MatchStatus.IN_PROGRESS,
        rounds: 0,
        maxRounds: 8,
        createdAt: (created as any).createdAt || new Date(),
      };

      setCurrentMatch(match);
      if (ref && "current" in ref && ref.current) {
        ref.current.dismiss();
      }
      router.push({ pathname: "/match/game", params: { matchId: match.id } });
    },
    onError: (err) => {
      console.error("Failed to start quiz:", err);
    },
  });

  const handleStartQuiz = () => {
    if (!session) return;
    hapticsService.medium();
    startQuizMutation.mutate();
  };

  return (
    <FloatingBottomSheet
      ref={ref}
      snapPoints={["88%"]}
      enableDynamicSizing={false}
      onChange={handleSheetChanges}
    >
      <FloatingBottomSheetView style={styles.sheetRoot}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { fontFamily: headingFont }]}>
            {t("quiz.title")}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (ref && "current" in ref && ref.current) {
                ref.current.dismiss();
              }
            }}
            activeOpacity={0.75}
            style={styles.closeBtn}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={UI_COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {quizCount === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconHalo}>
                <Ionicons
                  name="school-outline"
                  size={28}
                  color={UI_COLORS.textSecondary}
                />
              </View>
              <Text style={[styles.emptyTitle, { fontFamily: headingFont }]}>
                {t("quiz.emptyTitle")}
              </Text>
              <Text style={styles.emptySubtitle}>
                {t("quiz.emptySubtitle")}
              </Text>
            </View>
          </View>
        ) : (
          <FloatingBottomSheetScrollView
            style={styles.flex}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {linkedMatchIds.map((matchId, i) => {
              const score = quizScores[matchId];
              const isLoading =
                openCorrectionMutation.isPending &&
                openCorrectionMutation.variables === matchId;
              const scoreColor = score
                ? score.accuracy >= 70
                  ? UI_COLORS.mint
                  : score.accuracy >= 40
                    ? UI_COLORS.amber
                    : "#EF4444"
                : UI_COLORS.primary;
              const scoreBg = score
                ? score.accuracy >= 70
                  ? "rgba(52, 211, 153, 0.14)"
                  : score.accuracy >= 40
                    ? "rgba(251, 191, 36, 0.14)"
                    : "rgba(239, 68, 68, 0.14)"
                : UI_COLORS.surfaceElevated;

              return (
                <TouchableOpacity
                  key={matchId}
                  onPress={() => {
                    hapticsService.selection();
                    openCorrectionMutation.mutate(matchId);
                  }}
                  disabled={openCorrectionMutation.isPending}
                  activeOpacity={0.85}
                  style={styles.attemptCard}
                >
                  <View style={styles.attemptTopRow}>
                    <Text style={styles.attemptTitle}>
                      {t("quiz.attempt", { number: i + 1 })}
                    </Text>

                    {score ? (
                      <View
                        style={[
                          styles.scorePill,
                          { backgroundColor: scoreBg },
                        ]}
                      >
                        <Text
                          style={[styles.scorePillText, { color: scoreColor }]}
                        >
                          {score.accuracy}%
                        </Text>
                      </View>
                    ) : loadingScores ? (
                      <AnimatedLoader size="sm" color={UI_COLORS.textMuted} />
                    ) : null}
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: score ? `${Math.max(score.accuracy, 3)}%` : "0%",
                          backgroundColor: scoreColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.attemptBottomRow}>
                    <Text style={styles.attemptMeta}>
                      {score
                        ? t("quiz.scoreDetail", {
                            correct: score.correct,
                            wrong: score.total - score.correct,
                          })
                        : t("quiz.tapToView")}
                    </Text>

                    {isLoading ? (
                      <AnimatedLoader size="sm" color="#A78BFA" />
                    ) : (
                      <View style={styles.viewLinkRow}>
                        <Text style={styles.viewLinkText}>
                          {t("quiz.viewResults")}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="#A78BFA"
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </FloatingBottomSheetScrollView>
        )}

        {/* Footer CTA */}
        <View
          style={[
            styles.footerDock,
            { paddingBottom: Math.max(insets.bottom, 12) + 4 },
          ]}
        >
          <PillButton
            variant="primary"
            size="lg"
            loading={startQuizMutation.isPending}
            icon={<Ionicons name="play" size={18} color="#FFFFFF" />}
            label={quizCount === 0 ? t("quiz.startFirst") : t("quiz.startNew")}
            onPress={handleStartQuiz}
          />
        </View>
      </FloatingBottomSheetView>
    </FloatingBottomSheet>
  );
});

HomeworkQuizSheet.displayName = "HomeworkQuizSheet";

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: UI_COLORS.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 26,
    borderCurve: "continuous",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  emptyIconHalo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: UI_COLORS.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 10,
  },
  attemptCard: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 16,
    gap: 12,
  },
  attemptTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attemptTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
  },
  scorePillText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: UI_COLORS.surfaceElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  attemptBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attemptMeta: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: UI_COLORS.textSecondary,
  },
  viewLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewLinkText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    color: "#A78BFA",
  },
  footerDock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
});
