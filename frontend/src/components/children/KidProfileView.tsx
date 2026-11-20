import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ChildMatchSummary } from "@shared/types/analytics.types";
import { apiService, type LeaderboardEntry } from "../../services/api";
import { useGameStore } from "../../stores/gameStore";
import * as guestDb from "../../services/guestDb";
import { AnimatedLoader, AvatarIcon } from "../common";
import { PillButton } from "../ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { getSubjectTheme } from "../../config/subjectThemes";
import { hapticsService } from "../../services/haptics";

export function SubjectStatRow({
  subject,
  correctAnswers,
  totalQuestions,
  accuracy,
}: {
  subject: string;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
}) {
  const { t } = useTranslation(["leaderboard", "analytics", "common"]);
  const theme = getSubjectTheme(subject);
  const subjectLabel = t(`common:subjects.${subject.toUpperCase()}`, {
    defaultValue: theme.label,
  });
  const score = correctAnswers * 10;
  const maxScore = totalQuestions * 10;

  return (
    <View style={styles.subjectCard}>
      <View style={styles.subjectTopRow}>
        <Text style={styles.subjectTitle}>{subjectLabel}</Text>
        <View style={styles.accuracyPill}>
          <Text style={styles.accuracyPillText}>{accuracy}%</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(accuracy, 3)}%`,
            },
          ]}
        />
      </View>

      <View style={styles.subjectBottomRow}>
        <Text style={styles.subjectMeta}>
          {t("leaderboard:scoreRatio", { score, max: maxScore })}
        </Text>
        <Text style={styles.subjectMetaMuted}>
          {t("analytics:dashboard.correct", {
            correct: correctAnswers,
            total: totalQuestions,
          })}
        </Text>
      </View>
    </View>
  );
}

type MatchRowItem = {
  matchId: string;
  subject: string;
  difficulty?: string;
  date: string | number | Date;
  gameMode: string;
  accuracy: number;
  avgResponseTime?: number;
  didWin: boolean;
  correctAnswers?: number;
  totalQuestions?: number;
};

export function MatchHistoryRow({
  summary,
  onPress,
}: {
  summary: MatchRowItem;
  onPress?: () => void;
}) {
  const { t } = useTranslation(["analytics", "common"]);
  const locale = useGameStore((s) => s.locale);
  const theme = getSubjectTheme(summary.subject);
  const subjectLabel = t(`common:subjects.${summary.subject.toUpperCase()}`, {
    defaultValue: theme.label,
  });
  const date = new Date(summary.date).toLocaleDateString(locale || undefined, {
    month: "short",
    day: "numeric",
  });
  const difficultyLabel = summary.difficulty
    ? t(`common:difficulties.${summary.difficulty.toLowerCase()}`, {
        defaultValue: summary.difficulty,
      })
    : null;
  const isSolo = summary.gameMode === "solo";
  const outcomeColor = summary.didWin ? UI_COLORS.mint : UI_COLORS.coral;
  const hasCounts =
    typeof summary.correctAnswers === "number" &&
    typeof summary.totalQuestions === "number" &&
    summary.totalQuestions > 0;
  const metaParts = [date];
  if (difficultyLabel) metaParts.push(difficultyLabel);
  metaParts.push(
    hasCounts
      ? t("analytics:dashboard.correct", {
          correct: summary.correctAnswers,
          total: summary.totalQuestions,
        })
      : t("analytics:history.accuracy", {
          accuracy: summary.accuracy,
        }),
  );
  if (summary.avgResponseTime && summary.avgResponseTime > 0) {
    metaParts.push(`${(summary.avgResponseTime / 1000).toFixed(1)}s`);
  }
  const metaText = metaParts.join(" · ");
  const accuracyPillColors =
    summary.accuracy >= 75
      ? { bg: "rgba(52, 211, 153, 0.14)", text: UI_COLORS.mint }
      : summary.accuracy >= 50
        ? { bg: "rgba(251, 191, 36, 0.14)", text: UI_COLORS.amber }
        : { bg: "rgba(232, 93, 117, 0.14)", text: UI_COLORS.coral };

  const rowContent = (
    <>
      <View style={styles.matchTextCol}>
        <Text style={styles.matchTitle} numberOfLines={1}>
          {subjectLabel}
        </Text>
        <Text style={styles.matchSub} numberOfLines={1}>
          {metaText}
        </Text>
      </View>

      <View style={styles.matchRightCluster}>
        {!isSolo ? (
          <View
            style={[
              styles.outcomePill,
              { backgroundColor: `${outcomeColor}1E` },
            ]}
          >
            <Text style={[styles.outcomePillText, { color: outcomeColor }]}>
              {summary.didWin
                ? t("analytics:history.won")
                : t("analytics:history.lost")}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.accuracyPill,
            { backgroundColor: accuracyPillColors.bg },
          ]}
        >
          <Text
            style={[
              styles.accuracyPillText,
              { color: accuracyPillColors.text },
            ]}
          >
            {summary.accuracy}%
          </Text>
        </View>

        {onPress ? (
          <Ionicons
            name="chevron-forward"
            size={15}
            color={UI_COLORS.textMuted}
          />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.matchRow}>{rowContent}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={styles.matchRow}
    >
      {rowContent}
    </TouchableOpacity>
  );
}

export function KidProfileView({
  entry,
  onLogout,
}: {
  entry: LeaderboardEntry & { avatarUrl?: string };
  onLogout: () => void;
}) {
  const { t } = useTranslation(["leaderboard", "common", "auth"]);
  const { userRole, locale } = useGameStore();
  const isGuest = userRole === "guest";

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["childStats", entry.playerId],
    queryFn: () => apiService.getChildStats(entry.playerId),
    enabled: !isGuest,
  });

  const { data: matchHistory = [], isLoading: historyLoading } = useQuery<
    ChildMatchSummary[]
  >({
    queryKey: ["childMatchHistory", entry.playerId],
    queryFn: () => apiService.getChildMatchHistory(entry.playerId),
    enabled: !isGuest,
  });

  const { data: guestStats, isLoading: guestStatsLoading } = useQuery({
    queryKey: ["guestProfileStats"],
    queryFn: guestDb.getGuestProfileStats,
    enabled: isGuest,
  });

  const { data: cachedProfile } = useQuery({
    queryKey: ["cachedChildProfile", entry.playerId],
    queryFn: () => guestDb.getChildProfile(entry.playerId),
    enabled: !isGuest,
  });

  const displayName = entry.displayName || cachedProfile?.displayName || "Kid";
  const avatarUrl = entry.avatarUrl || cachedProfile?.avatarUrl;

  const recentMatches: MatchRowItem[] = isGuest
    ? (guestStats?.recentMatches ?? [])
    : matchHistory.slice(0, 5);

  const subjectStats = isGuest
    ? (guestStats?.subjectStats ?? [])
    : (stats?.subjectStats ?? []);

  const isHistoryLoading = isGuest ? guestStatsLoading : historyLoading;
  const isSubjectLoading = isGuest ? guestStatsLoading : statsLoading;

  return (
    <View style={styles.root}>
      {/* Clean Avatar Header */}
      <View style={styles.headerBlock}>
        <View style={styles.avatarRing}>
          <AvatarIcon avatarId={avatarUrl} size={96} />
        </View>

        <Text
          style={[styles.displayName, { fontFamily: headingFont }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text style={styles.gamesSubtitle}>
          {t("leaderboard:gamesPlayed", { count: entry.gamesPlayed })}
        </Text>
      </View>

      {/* Concentric Stats Module */}
      <View style={styles.statsShell}>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text
              style={[
                styles.statValue,
                { fontFamily: headingFont, color: UI_COLORS.mint },
              ]}
              numberOfLines={1}
            >
              {entry.correctAnswers}
            </Text>
            <Text style={styles.statLabel}>{t("leaderboard:correct")}</Text>
          </View>

          <View style={styles.statTile}>
            <Text
              style={[styles.statValue, { fontFamily: headingFont }]}
              numberOfLines={1}
            >
              {entry.accuracy}%
            </Text>
            <Text style={styles.statLabel}>{t("leaderboard:accuracy")}</Text>
          </View>
        </View>
      </View>

      {/* Recent Matches */}
      <Text style={styles.sectionLabel}>
        {t("leaderboard:recentMatches")}
      </Text>

      {isHistoryLoading ? (
        <View style={styles.loaderWrap}>
          <AnimatedLoader size="sm" />
        </View>
      ) : recentMatches.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="game-controller-outline"
            size={20}
            color={UI_COLORS.textMuted}
          />
          <Text style={styles.emptyCardText}>
            {t("leaderboard:noMatchesYet")}
          </Text>
        </View>
      ) : (
        <View style={styles.listShell}>
          {recentMatches.map((m) => (
            <MatchHistoryRow
              key={m.matchId}
              summary={m}
              onPress={() => {
                hapticsService.selection();
                if (isGuest || m.gameMode === "solo") {
                  router.push({
                    pathname: "/match/correction" as any,
                    params: { matchId: m.matchId, subject: m.subject },
                  });
                } else {
                  router.push({
                    pathname: "/match/review" as any,
                    params: {
                      matchId: m.matchId,
                      childId: entry.playerId,
                      subject: m.subject,
                    },
                  });
                }
              }}
            />
          ))}
        </View>
      )}

      {/* By Subject */}
      <Text style={styles.sectionLabel}>{t("leaderboard:bySubject")}</Text>

      {isSubjectLoading ? (
        <View style={styles.loaderWrap}>
          <AnimatedLoader size="sm" />
        </View>
      ) : subjectStats.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="bar-chart-outline"
            size={20}
            color={UI_COLORS.textMuted}
          />
          <Text style={styles.emptyCardText}>
            {t("leaderboard:noSubjectDataYet")}
          </Text>
        </View>
      ) : (
        <View style={styles.subjectStack}>
          {subjectStats.map((s) => (
            <SubjectStatRow
              key={s.subject}
              subject={s.subject}
              correctAnswers={s.correctAnswers}
              totalQuestions={s.totalQuestions}
              accuracy={s.accuracy}
            />
          ))}
        </View>
      )}

      {/* Sign Out CTA */}
      <PillButton
        label={t("auth:logout.button", "Log out")}
        variant="primary"
        onPress={onLogout}
        size="lg"
        icon={<Ionicons name="log-out-outline" size={18} color="#FFFFFF" />}
        style={styles.logoutButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  headerBlock: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 14,
  },
  displayName: {
    fontSize: 30,
    lineHeight: 36,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  gamesSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: UI_COLORS.textSecondary,
  },
  statsShell: {
    backgroundColor: "#161221",
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    marginBottom: 26,
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
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  loaderWrap: {
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 18,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: UI_COLORS.surface,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  emptyCardText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: UI_COLORS.textSecondary,
  },
  listShell: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    gap: 6,
    marginBottom: 26,
  },
  subjectStack: {
    gap: 10,
    marginBottom: 28,
  },
  subjectCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 16,
    gap: 10,
  },
  subjectTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subjectTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  accuracyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.surfaceElevated,
  },
  accuracyPillHigh: {
    backgroundColor: "rgba(52, 211, 153, 0.14)",
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
  subjectBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subjectMeta: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  subjectMetaMuted: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  matchRow: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 23,
    borderCurve: "continuous",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  matchTextCol: {
    flex: 1,
    gap: 2,
  },
  matchTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  matchSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  matchRightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  outcomePill: {
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  outcomePillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
  },
  logoutButton: {
    backgroundColor: "#EF4444",
  },
});
