import React from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PlayerStats } from "@shared/types/game.types";
import type { Match } from "@shared/types/match.types";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import { useGameStore } from "../../src/stores/gameStore";
import { AnimatedLoader, ScreenHeader } from "../../src/components/common";
import { PillButton, StateCard } from "../../src/components/ui";
import { getSubjectTheme } from "../../src/config/subjectThemes";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

function getAccuracyColorClass(accuracy: number) {
  if (accuracy >= 70) {
    return { text: "text-[#34D399]", bg: "bg-[#34D399]/15" };
  }
  if (accuracy >= 50) {
    return { text: "text-[#FBBF24]", bg: "bg-[#FBBF24]/15" };
  }
  return { text: "text-[#E85D75]", bg: "bg-[#E85D75]/15" };
}

function SoloDetail({
  match,
  matchId,
  stats,
  headingClass,
}: {
  match: Match;
  matchId: string;
  stats: PlayerStats[];
  headingClass: string;
}) {
  const { t } = useTranslation(["match"]);
  const player = stats[0];
  const matchLeft = (match as any).teamScoreLeft ?? 0;
  const matchRounds = (match as any).rounds ?? (match as any).maxRounds ?? 0;
  const correctAnswers = player?.correctAnswers ?? Math.round(matchLeft / 10);
  const totalAnswers = player?.totalAnswers ?? matchRounds;
  const avgMs = player?.avgResponseTime ?? 0;
  const accuracy =
    totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const isCompleted = match.status === "COMPLETED";
  const accStyle = getAccuracyColorClass(accuracy);

  const reviewPlayerId =
    player?.playerId || (match as any).childIds?.[0] || "mock-player";

  return (
    <View className="gap-4">
      {totalAnswers > 0 ? (
        <View className="bg-[#161221] border border-white/[0.06] rounded-[28px] p-1.5 flex-row gap-1.5">
          <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-2.5 items-center gap-1">
            <Text
              className={`${headingClass} text-[24px] leading-8 ${accStyle.text}`}
              numberOfLines={1}
            >
              {accuracy}%
            </Text>
            <Text
              className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px] text-center"
              numberOfLines={1}
            >
              {t("match:detail.accuracy")}
            </Text>
          </View>

          <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-2.5 items-center gap-1">
            <Text
              className={`${headingClass} text-[24px] leading-8 text-[#34D399]`}
              numberOfLines={1}
            >
              {correctAnswers}/{totalAnswers}
            </Text>
            <Text
              className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px] text-center"
              numberOfLines={1}
            >
              {t("match:detail.correct")}
            </Text>
          </View>

          <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-2.5 items-center gap-1">
            <Text
              className={`${headingClass} text-[24px] leading-8 text-[#F9FAFB]`}
              numberOfLines={1}
            >
              {avgMs > 0 ? `${(avgMs / 1000).toFixed(1)}s` : `${match.rounds}/${match.maxRounds}`}
            </Text>
            <Text
              className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px] text-center"
              numberOfLines={1}
            >
              {avgMs > 0 ? t("match:detail.avgTime") : t("match:detail.rounds")}
            </Text>
          </View>
        </View>
      ) : (
        <StateCard
          icon="bar-chart-outline"
          title={t("match:detail.noStats")}
        />
      )}

      {isCompleted ? (
        <PillButton
          label={t("match:detail.reviewAnswers")}
          size="lg"
          onPress={() => {
            hapticsService.selection();
            router.push({
              pathname: "/match/review" as any,
              params: {
                matchId,
                childId: reviewPlayerId,
                subject: match.subject,
              },
            });
          }}
        />
      ) : null}
    </View>
  );
}

function SplitDetail({
  match,
  matchId,
  stats,
  headingClass,
}: {
  match: Match;
  matchId: string;
  stats: PlayerStats[];
  headingClass: string;
}) {
  const { t } = useTranslation(["match", "common"]);
  const children = useGameStore((s) => s.children);
  const isCompleted = match.status === "COMPLETED";
  const leftScore = (match as any).teamScoreLeft ?? 0;
  const rightScore = (match as any).teamScoreRight ?? 0;
  const totalScore = leftScore + rightScore || 1;
  const leftPct = Math.round((leftScore / totalScore) * 100);
  const ropeLeftPct = Math.round(((5 - (match.ropePosition ?? 0)) / 10) * 100);

  const reviewDefaultPlayerId =
    stats[0]?.playerId || (match as any).childIds?.[0] || "player-red";

  const resolvePlayerName = (stat: PlayerStats) => {
    const child = children.find((c) => c.id === stat.playerId);
    if (child?.displayName) return child.displayName;
    if ((stat as any).displayName) return (stat as any).displayName;
    if (stat.playerId === "player-red") return t("common:teams.redTeam");
    if (stat.playerId === "player-blue") return t("common:teams.blueTeam");
    return stat.playerId;
  };

  return (
    <View className="gap-5">
      {/* Team Scores + Rope */}
      <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-4">
        <View className="gap-2">
          <Text className="font-body-bold text-[11px] text-[#6E6480] tracking-[1px] uppercase">
            {t("match:detail.teamScores")}
          </Text>
          <View className="flex-row justify-between items-baseline">
            <Text className={`${headingClass} text-2xl text-[#FF6B6B]`}>
              {leftScore}
            </Text>
            <Text className={`${headingClass} text-2xl text-[#4ECDC4]`}>
              {rightScore}
            </Text>
          </View>
          <View className="h-2.5 rounded-full overflow-hidden flex-row bg-[#261F36]">
            <View
              className="bg-[#FF6B6B] rounded-l-full"
              style={{ width: `${leftPct}%` }}
            />
            <View className="flex-1 bg-[#4ECDC4] rounded-r-full" />
          </View>
          <View className="flex-row justify-between">
            <Text className="font-body-semibold text-xs text-[#FF6B6B]">
              {t("common:teams.redTeam")}
            </Text>
            <Text className="font-body-semibold text-xs text-[#4ECDC4]">
              {t("common:teams.blueTeam")}
            </Text>
          </View>
        </View>

        <View className="border-t border-white/[0.06] pt-3.5 gap-2">
          <Text className="font-body-bold text-[11px] text-[#6E6480] tracking-[1px] uppercase">
            {t("match:detail.ropePosition")}
          </Text>
          <View className="h-2 rounded-full overflow-hidden flex-row bg-[#261F36]">
            <View
              className="bg-[#FF6B6B]/45"
              style={{ width: `${ropeLeftPct}%` }}
            />
            <View className="flex-1 bg-[#4ECDC4]/45" />
          </View>
        </View>
      </View>

      {/* Rounds & Players */}
      <View className="bg-[#161221] border border-white/[0.06] rounded-[28px] p-1.5 flex-row gap-1.5">
        <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-3 items-center gap-1">
          <Text className={`${headingClass} text-2xl leading-8 text-[#F9FAFB]`}>
            {match.rounds}/{match.maxRounds}
          </Text>
          <Text className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px]">
            {t("match:detail.rounds")}
          </Text>
        </View>
        <View className="flex-1 bg-[#1E182B] rounded-[23px] py-3.5 px-3 items-center gap-1">
          <Text className={`${headingClass} text-2xl leading-8 text-[#F9FAFB]`}>
            {stats.length || "—"}
          </Text>
          <Text className="font-body-semibold text-[11px] text-[#9CA3AF] uppercase tracking-[0.4px]">
            {t("match:detail.players")}
          </Text>
        </View>
      </View>

      {/* Per-player Statistics */}
      {stats.length > 0 ? (
        <View>
          <Text className="font-body-bold text-xs text-[#6E6480] tracking-[1.1px] uppercase mb-2.5 px-1">
            {t("match:detail.playerStatistics")}
          </Text>
          <View className="bg-[#161221] border border-white/[0.06] rounded-[28px] p-1.5 gap-1.5">
            {stats.map((stat) => {
              const acc =
                stat.totalAnswers > 0
                  ? Math.round((stat.correctAnswers / stat.totalAnswers) * 100)
                  : 0;
              const accStyle = getAccuracyColorClass(acc);
              return (
                <TouchableOpacity
                  key={stat.playerId}
                  onPress={() => {
                    hapticsService.selection();
                    router.push({
                      pathname: "/match/review" as any,
                      params: {
                        matchId,
                        childId: stat.playerId,
                        subject: match.subject,
                      },
                    });
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  className="bg-[#1E182B] rounded-[23px] px-4 py-3.5 flex-row items-center gap-3"
                >
                  <View className="flex-1 gap-0.5">
                    <Text
                      className="font-body-extrabold text-[15px] text-[#F9FAFB]"
                      numberOfLines={1}
                    >
                      {resolvePlayerName(stat)}
                    </Text>
                    <Text className="font-body text-xs text-[#9CA3AF]">
                      {stat.correctAnswers}/{stat.totalAnswers} ·{" "}
                      {(stat.avgResponseTime / 1000).toFixed(1)}s
                    </Text>
                  </View>

                  <View className={`rounded-full px-2.5 py-1 ${accStyle.bg}`}>
                    <Text
                      className={`font-body-extrabold text-xs ${accStyle.text}`}
                    >
                      {acc}%
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="#6E6480" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {isCompleted ? (
        <PillButton
          label={t("match:detail.reviewAnswers")}
          size="lg"
          onPress={() => {
            hapticsService.selection();
            router.push({
              pathname: "/match/review" as any,
              params: {
                matchId,
                childId: reviewDefaultPlayerId,
                subject: match.subject,
              },
            });
          }}
        />
      ) : null}
    </View>
  );
}

export default function MatchDetailScreen() {
  usePortrait();
  const { t } = useTranslation(["match", "common"]);
  const { matchId: rawMatchId } = useLocalSearchParams<{
    matchId?: string | string[];
  }>();
  const matchId = Array.isArray(rawMatchId) ? rawMatchId[0] : rawMatchId;
  const locale = useGameStore((s) => s.locale);

  void locale;
  const headingClass =
    getHeadingFont() === "System" ? "font-body-extrabold" : "font-heading";

  const {
    data: match,
    isLoading,
    isFetching,
    error: matchError,
    refetch,
  } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => apiService.getMatch(matchId as string),
    enabled: !!matchId,
  });

  const { data: stats = [], refetch: refetchStats } = useQuery({
    queryKey: ["matchStats", matchId],
    queryFn: () => apiService.getMatchStats(matchId as string),
    enabled: !!matchId,
    retry: false,
  });

  const errorMessage = matchError
    ? matchError instanceof Error
      ? matchError.message
      : String(matchError)
    : "";

  const isSolo = (match as any)?.gameMode === "solo";
  const subjectLabel = match
    ? t(`common:subjects.${match.subject.toUpperCase()}`, {
        defaultValue: getSubjectTheme(match.subject).label,
      })
    : "";
  const difficultyLabel = match
    ? t(`common:difficulties.${(match.difficulty || "easy").toLowerCase()}`, {
        defaultValue: match.difficulty,
      })
    : "";
  const dateStr = match
    ? new Date(match.createdAt).toLocaleDateString(locale || undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const modeLabel = isSolo
    ? t("match:detail.soloMode")
    : t("match:detail.splitMode");

  const outcomePill = (() => {
    if (!match) return null;
    if (isSolo && match.status === "COMPLETED") {
      return {
        label: t("match:detail.completed"),
        bgClass: "bg-[#34D399]/15",
        textClass: "text-[#34D399]",
      };
    }
    if (!isSolo && match.winner === "LEFT") {
      return {
        label: t("match:detail.redWins"),
        bgClass: "bg-[#FF6B6B]/15",
        textClass: "text-[#FF6B6B]",
      };
    }
    if (!isSolo && match.winner === "RIGHT") {
      return {
        label: t("match:detail.blueWins"),
        bgClass: "bg-[#4ECDC4]/15",
        textClass: "text-[#4ECDC4]",
      };
    }
    if (!isSolo && match.winner) {
      return {
        label: t("match:detail.draw"),
        bgClass: "bg-[#6C5CE7]/15",
        textClass: "text-[#C4B5FD]",
      };
    }
    return null;
  })();

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-game-bg">
      <ScreenHeader title={t("match:detail.title")} />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void Promise.all([refetch(), refetchStats()]);
            }}
            tintColor="#A78BFA"
          />
        }
      >
        <View className="w-full max-w-[480px] self-center px-4 pt-3 pb-11">
          {!matchId ? (
            <StateCard
              icon="alert-circle-outline"
              tone="error"
              title={t("common:errors.somethingWentWrong")}
            />
          ) : null}

          {matchId && isLoading ? (
            <View className="items-center pt-20">
              <AnimatedLoader size="lg" />
            </View>
          ) : null}

          {matchId && !isLoading && (!!errorMessage || !match) ? (
            <StateCard
              icon="alert-circle-outline"
              tone="error"
              title={t("common:errors.somethingWentWrong")}
              subtitle={errorMessage || undefined}
              actionLabel={t("common:buttons.tryAgain")}
              onAction={() => {
                void refetch();
              }}
            />
          ) : null}

          {matchId && !isLoading && match ? (
            <View className="gap-5">
              {/* Summary Header Card */}
              <View className="bg-[#161221] border border-white/[0.06] rounded-[24px] p-4 gap-2">
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className={`${headingClass} text-2xl text-[#F9FAFB]`}
                    numberOfLines={1}
                  >
                    {subjectLabel}
                  </Text>
                  {outcomePill ? (
                    <View
                      className={`rounded-full px-3 py-1 ${outcomePill.bgClass}`}
                    >
                      <Text
                        className={`font-body-bold text-xs ${outcomePill.textClass}`}
                      >
                        {outcomePill.label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text className="font-body text-[13px] text-[#9CA3AF]">
                  {modeLabel} · {difficultyLabel} · {dateStr}
                </Text>
              </View>

              {isSolo ? (
                <SoloDetail
                  match={match}
                  matchId={match._id || matchId}
                  stats={stats}
                  headingClass={headingClass}
                />
              ) : (
                <SplitDetail
                  match={match}
                  matchId={match._id || matchId}
                  stats={stats}
                  headingClass={headingClass}
                />
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
