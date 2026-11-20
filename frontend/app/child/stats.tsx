import React, { useCallback, useState } from "react";
import {
  type DimensionValue,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  ChildMatchSummary,
  ChildPerformance,
  SubjectStats,
} from "@shared/types/analytics.types";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import { useGameStore } from "../../src/stores/gameStore";
import {
  AnimatedLoader,
  AvatarIcon,
  ScreenHeader,
} from "../../src/components/common";
import { MatchHistoryRow } from "../../src/components/children/KidProfileView";
import { PillButton, StateCard } from "../../src/components/ui";
import { getSubjectTheme } from "../../src/config/subjectThemes";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

function getAccuracyClasses(accuracy: number) {
  if (accuracy >= 75) {
    return {
      text: "text-[#34D399]",
      pillBg: "bg-[#34D399]/15",
      barBg: "bg-[#34D399]",
    };
  }
  if (accuracy >= 50) {
    return {
      text: "text-[#FBBF24]",
      pillBg: "bg-[#FBBF24]/15",
      barBg: "bg-[#FBBF24]",
    };
  }
  return {
    text: "text-[#E85D75]",
    pillBg: "bg-[#E85D75]/15",
    barBg: "bg-[#E85D75]",
  };
}

function SubjectBreakdownItem({
  stat,
  isBest,
  isWeakest,
}: {
  stat: SubjectStats;
  isBest: boolean;
  isWeakest: boolean;
}) {
  const { t } = useTranslation(["analytics", "common"]);
  const theme = getSubjectTheme(stat.subject);
  const subjectLabel = t(`common:subjects.${stat.subject.toUpperCase()}`, {
    defaultValue: theme.label,
  });
  const acc = getAccuracyClasses(stat.accuracy);
  const barWidth: DimensionValue = `${Math.max(stat.accuracy, 4)}%`;

  return (
    <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-2.5">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center flex-wrap flex-1 gap-2">
          <Text
            className="font-body-extrabold text-[15px] text-[#F9FAFB]"
            numberOfLines={1}
          >
            {subjectLabel}
          </Text>

          {isBest ? (
            <View className="rounded-full bg-[#34D399]/15 px-2.5 py-0.5">
              <Text className="font-body-bold text-[11px] text-[#34D399]">
                {t("analytics:dashboard.bestSubject")}
              </Text>
            </View>
          ) : null}

          {isWeakest ? (
            <View className="rounded-full bg-[#FBBF24]/15 px-2.5 py-0.5">
              <Text className="font-body-bold text-[11px] text-[#FBBF24]">
                {t("analytics:dashboard.weakestSubject")}
              </Text>
            </View>
          ) : null}
        </View>

        <View className={`px-2.5 py-1 rounded-full ${acc.pillBg}`}>
          <Text className={`font-body-extrabold text-xs ${acc.text}`}>
            {stat.accuracy}%
          </Text>
        </View>
      </View>

      <View className="h-[7px] bg-[#261F36] rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${acc.barBg}`}
          style={{ width: barWidth }}
        />
      </View>

      <View className="flex-row justify-between">
        <Text className="font-body-semibold text-xs text-[#9CA3AF]">
          {t("analytics:dashboard.correct", {
            correct: stat.correctAnswers,
            total: stat.totalQuestions,
          })}
        </Text>
        <Text className="font-body text-xs text-[#6E6480]">
          {t("analytics:dashboard.avgTime", {
            time: (stat.avgResponseTime / 1000).toFixed(1),
          })}
        </Text>
      </View>
    </View>
  );
}

function computeAccuracyTrend(matches: ChildMatchSummary[]) {
  if (matches.length < 2) return null;
  const splitIdx = Math.max(1, Math.floor(matches.length / 2));
  const recentSlice = matches.slice(0, splitIdx);
  const earlierSlice = matches.slice(splitIdx);

  const sumSlice = (list: ChildMatchSummary[]) =>
    list.reduce(
      (acc, m) => ({
        correct: acc.correct + (m.correctAnswers ?? 0),
        total: acc.total + (m.totalQuestions ?? 0),
      }),
      { correct: 0, total: 0 },
    );

  const recentTotals = sumSlice(recentSlice);
  const earlierTotals = sumSlice(earlierSlice);
  if (recentTotals.total === 0 || earlierTotals.total === 0) return null;

  const recentAcc = Math.round((recentTotals.correct / recentTotals.total) * 100);
  const earlierAcc = Math.round(
    (earlierTotals.correct / earlierTotals.total) * 100,
  );
  return {
    delta: recentAcc - earlierAcc,
    recentAcc,
    earlierAcc,
    recentCorrect: recentTotals.correct,
    recentTotal: recentTotals.total,
    recentCount: recentSlice.length,
  };
}

function computeDifficultyStats(matches: ChildMatchSummary[]) {
  const map = new Map<string, { correct: number; total: number }>();
  for (const m of matches) {
    const key = (m.difficulty || "").toLowerCase();
    if (!key) continue;
    const prev = map.get(key) ?? { correct: 0, total: 0 };
    prev.correct += m.correctAnswers ?? 0;
    prev.total += m.totalQuestions ?? 0;
    map.set(key, prev);
  }
  const order = ["easy", "medium", "hard"];
  return Array.from(map.entries())
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(([difficulty, { correct, total }]) => ({
      difficulty,
      correct,
      total,
      accuracy: Math.round((correct / total) * 100),
    }));
}

function LearningInsightsSection({
  data,
  matches,
}: {
  data: ChildPerformance;
  matches: ChildMatchSummary[];
}) {
  const { t } = useTranslation(["analytics", "common"]);
  const strongSubjects = data.subjectStats.filter((s) => s.accuracy >= 75);
  const focusSubjects = [...data.subjectStats]
    .filter((s) => s.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy);

  const totalSubjectQuestions = data.subjectStats.reduce(
    (sum, s) => sum + s.totalQuestions,
    0,
  );
  const weightedSubjectAvg =
    totalSubjectQuestions > 0
      ? data.subjectStats.reduce(
          (sum, s) => sum + s.avgResponseTime * s.totalQuestions,
          0,
        ) / totalSubjectQuestions
      : 0;
  const avgTime = data.avgResponseTime ?? weightedSubjectAvg;
  const avgSecs = (avgTime / 1000).toFixed(1);

  const isFast = avgTime > 0 && avgTime < 10000;
  const isAccurate = data.overallAccuracy >= 70;
  const isLowAccuracy = data.overallAccuracy < 50;

  const pacePill = isFast
    ? isAccurate
      ? {
          bg: "bg-[#34D399]/15",
          text: "text-[#34D399]",
          label: t("analytics:dashboard.report.fastNote"),
        }
      : isLowAccuracy
        ? {
            bg: "bg-[#E85D75]/15",
            text: "text-[#E85D75]",
            label: t("analytics:dashboard.report.rushedNote", {
              defaultValue: "Rushing — slow down!",
            }),
          }
        : {
            bg: "bg-[#FBBF24]/15",
            text: "text-[#FBBF24]",
            label: t("analytics:dashboard.report.quickCheckNote", {
              defaultValue: "Fast — check answers",
            }),
          }
    : isAccurate
      ? {
          bg: "bg-[#34D399]/15",
          text: "text-[#34D399]",
          label: t("analytics:dashboard.report.slowNote"),
        }
      : {
          bg: "bg-[#6C5CE7]/15",
          text: "text-[#C4B5FD]",
          label: t("analytics:dashboard.report.slowPracticeNote", {
            defaultValue: "Review missed steps",
          }),
        };

  const trend = computeAccuracyTrend(matches);
  const difficultyStats = computeDifficultyStats(matches);

  return (
    <View className="mb-6">
      <Text className="font-body-bold text-xs text-[#6E6480] tracking-[1.1px] uppercase mb-2.5 px-1">
        {t("analytics:dashboard.report.title")}
      </Text>

      <View className="gap-2.5">
        {trend ? (
          <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-body-bold text-[11px] text-[#A78BFA] tracking-[0.9px] uppercase">
                {t("analytics:dashboard.report.recentTrend", {
                  defaultValue: "Recent Trend",
                })}
              </Text>
              <View
                className={`rounded-full px-2.5 py-0.5 ${
                  trend.delta >= 8
                    ? "bg-[#34D399]/15"
                    : trend.delta <= -8
                      ? "bg-[#E85D75]/15"
                      : "bg-[#6C5CE7]/15"
                }`}
              >
                <Text
                  className={`font-body-bold text-[11px] ${
                    trend.delta >= 8
                      ? "text-[#34D399]"
                      : trend.delta <= -8
                        ? "text-[#E85D75]"
                        : "text-[#C4B5FD]"
                  }`}
                >
                  {trend.delta >= 8
                    ? t("analytics:dashboard.report.trendImproving", {
                        delta: trend.delta,
                        defaultValue: "Improving (+{{delta}}%)",
                      })
                    : trend.delta <= -8
                      ? t("analytics:dashboard.report.trendDipping", {
                          delta: Math.abs(trend.delta),
                          defaultValue: "Dropping (-{{delta}}%)",
                        })
                      : t("analytics:dashboard.report.trendSteady", {
                          defaultValue: "Steady Pace",
                        })}
                </Text>
              </View>
            </View>
            <Text className="font-body text-xs leading-[17px] text-[#9CA3AF]">
              {t("analytics:dashboard.report.trendComparison", {
                recent: trend.recentAcc,
                recentCorrect: trend.recentCorrect,
                recentTotal: trend.recentTotal,
                earlier: trend.earlierAcc,
                defaultValue:
                  "Recent matches: {{recent}}% ({{recentCorrect}}/{{recentTotal}}) vs {{earlier}}% earlier",
              })}
            </Text>
          </View>
        ) : null}

        {strongSubjects.length > 0 ? (
          <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-2.5">
            <Text className="font-body-bold text-[11px] text-[#34D399] tracking-[0.9px] uppercase">
              {t("analytics:dashboard.report.strongAt")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {strongSubjects.map((s) => {
                const theme = getSubjectTheme(s.subject);
                const label = t(`common:subjects.${s.subject.toUpperCase()}`, {
                  defaultValue: theme.label,
                });
                return (
                  <View
                    key={s.subject}
                    className="rounded-full bg-[#34D399]/15 px-3 py-1"
                  >
                    <Text className="font-body-bold text-xs text-[#34D399]">
                      {label} · {s.accuracy}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-2.5">
          <Text className="font-body-bold text-[11px] text-[#FBBF24] tracking-[0.9px] uppercase">
            {t("analytics:dashboard.report.practiceNeeded")}
          </Text>

          {focusSubjects.length > 0 ? (
            <View className="gap-2.5">
              {focusSubjects.map((s, idx) => {
                const theme = getSubjectTheme(s.subject);
                const label = t(`common:subjects.${s.subject.toUpperCase()}`, {
                  defaultValue: theme.label,
                });
                const acc = getAccuracyClasses(s.accuracy);
                const missed = Math.max(0, s.totalQuestions - s.correctAnswers);
                const subjSecs = (s.avgResponseTime / 1000).toFixed(1);
                const hintText =
                  s.avgResponseTime > 0 &&
                  s.avgResponseTime < 7000 &&
                  s.accuracy < 60
                    ? t("analytics:dashboard.report.practiceHintFast", {
                        missed,
                        total: s.totalQuestions,
                        time: subjSecs,
                        defaultValue:
                          "Missed {{missed}} of {{total}} at {{time}}s avg — slow down and read carefully.",
                      })
                    : s.avgResponseTime >= 12000
                      ? t("analytics:dashboard.report.practiceHintSlow", {
                          missed,
                          total: s.totalQuestions,
                          time: subjSecs,
                          subject: label,
                          defaultValue:
                            "Missed {{missed}} of {{total}} ({{time}}s avg) — review core {{subject}} steps together.",
                        })
                      : s.accuracy >= 50
                        ? t("analytics:dashboard.report.practiceHintClose", {
                            correct: s.correctAnswers,
                            total: s.totalQuestions,
                            subject: label,
                            defaultValue:
                              "Got {{correct}} of {{total}} right — close to 75%! Review missed answers together.",
                          })
                        : t("analytics:dashboard.report.practiceHintSupport", {
                            missed,
                            total: s.totalQuestions,
                            subject: label,
                            defaultValue:
                              "Missed {{missed}} of {{total}} — try an easier round or review missed questions.",
                          });

                return (
                  <View
                    key={s.subject}
                    className={
                      idx > 0 ? "border-t border-white/[0.06] pt-2.5 gap-1" : "gap-1"
                    }
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-body-bold text-sm text-[#F9FAFB]">
                        {label}
                      </Text>
                      <Text className={`font-body-extrabold text-[13px] ${acc.text}`}>
                        {t("analytics:dashboard.report.missedBadge", {
                          missed,
                          accuracy: s.accuracy,
                          defaultValue: "{{missed}} missed · {{accuracy}}%",
                        })}
                      </Text>
                    </View>
                    <Text className="font-body text-xs leading-[17px] text-[#9CA3AF]">
                      {hintText}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={16} color="#34D399" />
              <Text className="flex-1 font-body text-[13px] text-[#9CA3AF]">
                {data.totalQuestions >= 5
                  ? t("analytics:dashboard.report.allOnTrack", {
                      defaultValue:
                        "All subjects are at 70%+ — great steady progress!",
                    })
                  : t("analytics:dashboard.report.noWeakSubject")}
              </Text>
            </View>
          )}
        </View>

        {avgTime > 0 ? (
          <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] px-4 py-3.5 flex-row items-center justify-between gap-3">
            <View className="gap-0.5">
              <Text className="font-body-bold text-[11px] text-[#6E6480] uppercase tracking-[0.8px]">
                {t("analytics:dashboard.report.avgResponseTime")}
              </Text>
              <Text className="font-body-extrabold text-sm text-[#F9FAFB]">
                {t("analytics:dashboard.report.avgResponseValue", {
                  time: avgSecs,
                })}
              </Text>
            </View>
            <View className={`rounded-full px-3 py-1.5 max-w-[190px] ${pacePill.bg}`}>
              <Text
                className={`font-body-semibold text-[11.5px] text-center ${pacePill.text}`}
                numberOfLines={2}
              >
                {pacePill.label}
              </Text>
            </View>
          </View>
        ) : null}

        {difficultyStats.length > 0 ? (
          <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-2.5">
            <Text className="font-body-bold text-[11px] text-[#6E6480] tracking-[0.9px] uppercase">
              {t("analytics:dashboard.report.difficultyTitle", {
                defaultValue: "By Difficulty",
              })}
            </Text>
            <View className="gap-2">
              {difficultyStats.map((item, idx) => {
                const diffLabel = t(`common:difficulties.${item.difficulty}`, {
                  defaultValue: item.difficulty,
                });
                const acc = getAccuracyClasses(item.accuracy);
                return (
                  <View
                    key={item.difficulty}
                    className={`flex-row items-center justify-between gap-2 ${
                      idx > 0 ? "border-t border-white/[0.06] pt-2" : ""
                    }`}
                  >
                    <Text className="font-body-bold text-[13px] text-[#F9FAFB]">
                      {diffLabel}
                    </Text>
                    <View className="flex-row items-center gap-2.5">
                      <Text className="font-body text-xs text-[#9CA3AF]">
                        {t("analytics:dashboard.correct", {
                          correct: item.correct,
                          total: item.total,
                        })}
                      </Text>
                      <View className={`rounded-full px-2.5 py-0.5 ${acc.pillBg}`}>
                        <Text className={`font-body-extrabold text-xs ${acc.text}`}>
                          {item.accuracy}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function ChildStatsScreen() {
  usePortrait();
  const { t } = useTranslation(["analytics", "leaderboard", "common"]);
  const { childId, childName, avatarUrl } = useLocalSearchParams<{
    childId?: string;
    childName?: string;
    avatarUrl?: string;
  }>();
  const { children, locale } = useGameStore();
  const [refreshing, setRefreshing] = useState(false);

  void locale;
  const headingClass =
    getHeadingFont() === "System" ? "font-body-extrabold" : "font-heading";

  const storeChild = children.find((c) => c.id === childId);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["childStats", childId],
    queryFn: () => apiService.getChildStats(childId as string),
    enabled: !!childId,
    staleTime: 0,
  });

  const {
    data: matchHistory = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery<ChildMatchSummary[]>({
    queryKey: ["childMatches", childId],
    queryFn: () => apiService.getChildMatchHistory(childId as string),
    enabled: !!childId,
    staleTime: 0,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchHistory()]);
    setRefreshing(false);
  }, [refetchStats, refetchHistory]);

  const resolvedName =
    childName || storeChild?.displayName || data?.displayName || "Kid";
  const resolvedAvatar = avatarUrl || storeChild?.avatarUrl;
  const resolvedGrade = storeChild?.grade;

  const totalMatchesCount = matchHistory.length || data?.totalMatches || 0;
  const totalCorrect =
    data?.totalCorrect ??
    (data?.subjectStats.reduce((sum, s) => sum + s.correctAnswers, 0) ?? 0);
  const recentMatches = matchHistory.slice(0, 5);
  const errorMessage = error instanceof Error ? error.message : "";

  const perf = getAccuracyClasses(data?.overallAccuracy ?? 0);
  const perfLabel = data
    ? data.overallAccuracy >= 75
      ? t("analytics:dashboard.performanceBadge.excellent")
      : data.overallAccuracy >= 50
        ? t("analytics:dashboard.performanceBadge.good")
        : t("analytics:dashboard.performanceBadge.needsWork")
    : "";

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-game-bg">
      <ScreenHeader
        title={t("analytics:dashboard.title", { name: resolvedName })}
      />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A78BFA"
          />
        }
      >
        <View className="w-full max-w-[480px] self-center px-4 pt-3 pb-11">
          {isLoading ? (
            <View className="items-center pt-20">
              <AnimatedLoader size="lg" />
            </View>
          ) : null}

          {!isLoading && isError ? (
            <StateCard
              icon="alert-circle-outline"
              tone="error"
              title={t("common:errors.somethingWentWrong")}
              subtitle={errorMessage || undefined}
              actionLabel={t("common:buttons.tryAgain")}
              onAction={() => {
                void onRefresh();
              }}
            />
          ) : null}

          {!isLoading && !isError && data && data.totalMatches === 0 ? (
            <View className="pt-2">
              <View className="items-center pt-2 pb-5">
                <View className="w-[102px] h-[102px] rounded-full bg-white/[0.08] border-[1.5px] border-[#6C5CE7]/50 items-center justify-center overflow-hidden mb-3">
                  <AvatarIcon avatarId={resolvedAvatar} size={86} />
                </View>
                <Text
                  className={`${headingClass} text-[28px] leading-[34px] text-[#F9FAFB] text-center mb-1.5`}
                  numberOfLines={1}
                >
                  {resolvedName}
                </Text>
                {resolvedGrade ? (
                  <Text className="font-body text-[13.5px] text-[#9CA3AF]">
                    {resolvedGrade}
                  </Text>
                ) : null}
              </View>

              <StateCard
                icon="game-controller-outline"
                title={t("analytics:dashboard.noData")}
                subtitle={t("analytics:dashboard.noDataSubtitle")}
              />
            </View>
          ) : null}

          {!isLoading && !isError && data && data.totalMatches > 0 ? (
            <>
              {/* Hero Header */}
              <View className="items-center pt-2 pb-5">
                <View className="w-[102px] h-[102px] rounded-full bg-white/[0.08] border-[1.5px] border-[#6C5CE7]/50 items-center justify-center overflow-hidden mb-3">
                  <AvatarIcon avatarId={resolvedAvatar} size={90} />
                </View>

                <Text
                  className={`${headingClass} text-[28px] leading-[34px] text-[#F9FAFB] text-center mb-1.5`}
                  numberOfLines={1}
                >
                  {resolvedName}
                </Text>

                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  <Text className="font-body text-[13.5px] text-[#9CA3AF]">
                    {resolvedGrade
                      ? `${resolvedGrade} · ${t("leaderboard:gamesPlayed", {
                          count: totalMatchesCount,
                        })}`
                      : t("leaderboard:gamesPlayed", {
                          count: totalMatchesCount,
                        })}
                  </Text>
                  <View className={`rounded-full px-2.5 py-0.5 ${perf.pillBg}`}>
                    <Text className={`font-body-bold text-[11.5px] ${perf.text}`}>
                      {perfLabel}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Overview Stats */}
              <View className="bg-[#161221] border border-white/[0.06] rounded-[28px] p-1.5 mb-6 flex-row gap-1.5">
                <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-2.5 items-center gap-1">
                  <Text
                    className={`${headingClass} text-[26px] leading-8 text-[#34D399]`}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {totalCorrect}/{data.totalQuestions}
                  </Text>
                  <Text
                    className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px] text-center"
                    numberOfLines={1}
                  >
                    {t("leaderboard:correct")}
                  </Text>
                </View>

                <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-2.5 items-center gap-1">
                  <Text
                    className={`${headingClass} text-[26px] leading-8 ${perf.text}`}
                    numberOfLines={1}
                  >
                    {data.overallAccuracy}%
                  </Text>
                  <Text
                    className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px] text-center"
                    numberOfLines={1}
                  >
                    {t("leaderboard:accuracy")}
                  </Text>
                </View>

                <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-2.5 items-center gap-1">
                  <Text
                    className={`${headingClass} text-[26px] leading-8 text-[#F9FAFB]`}
                    numberOfLines={1}
                  >
                    {totalMatchesCount}
                  </Text>
                  <Text
                    className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px] text-center"
                    numberOfLines={1}
                  >
                    {t("analytics:dashboard.totalMatches")}
                  </Text>
                </View>
              </View>

              {/* Recent Matches */}
              <View className="mb-6">
                <Text className="font-body-bold text-xs text-[#6E6480] tracking-[1.1px] uppercase mb-2.5 px-1">
                  {t("leaderboard:recentMatches")}
                </Text>

                {historyLoading ? (
                  <View className="items-center py-4">
                    <AnimatedLoader size="sm" />
                  </View>
                ) : recentMatches.length === 0 ? (
                  <View className="flex-row items-center justify-center gap-2.5 bg-[#161221] border border-white/[0.06] rounded-[24px] py-4 px-4">
                    <Ionicons
                      name="game-controller-outline"
                      size={18}
                      color="#6E6480"
                    />
                    <Text className="font-body text-[13px] text-[#9CA3AF]">
                      {t("leaderboard:noMatchesYet")}
                    </Text>
                  </View>
                ) : (
                  <View className="bg-[#161221] border border-white/[0.06] rounded-[28px] p-1.5 gap-1.5">
                    {recentMatches.map((m) => (
                      <MatchHistoryRow
                        key={m.matchId}
                        summary={m}
                        onPress={() => {
                          hapticsService.selection();
                          router.push({
                            pathname: "/match/review" as any,
                            params: {
                              matchId: m.matchId,
                              childId: childId as string,
                              subject: m.subject,
                            },
                          });
                        }}
                      />
                    ))}
                  </View>
                )}

                {matchHistory.length > 0 ? (
                  <View className="mt-2.5">
                    <PillButton
                      label={t("analytics:dashboard.viewHistory")}
                      variant="secondary"
                      size="default"
                      onPress={() => {
                        hapticsService.selection();
                        router.push({
                          pathname: "/child/matches" as any,
                          params: {
                            childId: childId as string,
                            childName: resolvedName,
                          },
                        });
                      }}
                      icon={
                        <Ionicons name="time-outline" size={17} color="#F9FAFB" />
                      }
                    />
                  </View>
                ) : null}
              </View>

              {/* Subject Breakdown */}
              {data.subjectStats.length > 0 ? (
                <View className="mb-6">
                  <Text className="font-body-bold text-xs text-[#6E6480] tracking-[1.1px] uppercase mb-2.5 px-1">
                    {t("analytics:dashboard.subjectBreakdown")}
                  </Text>

                  <View className="gap-2.5">
                    {data.subjectStats.map((stat) => (
                      <SubjectBreakdownItem
                        key={stat.subject}
                        stat={stat}
                        isBest={
                          stat.subject === data.bestSubject &&
                          stat.accuracy >= 50
                        }
                        isWeakest={
                          stat.subject === data.weakestSubject &&
                          data.subjectStats.length > 1 &&
                          stat.accuracy < 75
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Learning Report */}
              <LearningInsightsSection data={data} matches={matchHistory} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
