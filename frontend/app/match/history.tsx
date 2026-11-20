import React, { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { useGameStore } from "../../src/stores/gameStore";
import {
  AnimatedLoader,
  ScreenHeader,
  StaggeredList,
} from "../../src/components/common";
import {
  ChildMatchSummaryCard,
  HistoryListShell,
  MatchHistoryCard,
} from "../../src/components/match";
import { StateCard } from "../../src/components/ui";
import { hapticsService } from "../../src/services/haptics";

export default function MatchHistoryScreen() {
  usePortrait();
  const { t } = useTranslation(["match", "homework", "common"]);
  const { children, userRole, parentUser, guestProfile, childSession } =
    useGameStore();
  const isGuest = userRole === "guest";
  const isChild = userRole === "child";
  const uid = parentUser?._id ?? parentUser?.id ?? guestProfile?.guestId ?? null;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const visibleChildren = children.filter((c) => c?.displayName);
  const resolvedSelectedChildId =
    selectedChildId && visibleChildren.some((c) => c.id === selectedChildId)
      ? selectedChildId
      : null;
  const activeChildId = isChild
    ? (childSession?.childId ?? null)
    : resolvedSelectedChildId;

  const allMatchesQuery = useQuery({
    queryKey: ["matches", uid],
    queryFn: async () => {
      const local = await guestDb.getMatches();
      if (isGuest) return local;

      try {
        const remote = await apiService.getMatches();
        guestDb
          .syncFromBackend({ matches: remote, homeworkSessions: [] })
          .catch(() => {});
        return remote;
      } catch (err) {
        if (local.length > 0) return local;
        throw err;
      }
    },
    enabled: activeChildId === null,
  });

  const childMatchesQuery = useQuery({
    queryKey: ["childMatches", uid, activeChildId],
    queryFn: () => apiService.getChildMatchHistory(activeChildId!),
    enabled: !isGuest && activeChildId !== null,
  });

  const isLoading =
    activeChildId === null
      ? allMatchesQuery.isLoading
      : childMatchesQuery.isLoading;
  const isError =
    activeChildId === null
      ? allMatchesQuery.isError
      : childMatchesQuery.isError;
  const isFetching =
    activeChildId === null
      ? allMatchesQuery.isFetching
      : childMatchesQuery.isFetching;
  const error =
    activeChildId === null ? allMatchesQuery.error : childMatchesQuery.error;
  const refetch =
    activeChildId === null ? allMatchesQuery.refetch : childMatchesQuery.refetch;

  const allMatches = allMatchesQuery.data ?? [];
  const childMatches = childMatchesQuery.data ?? [];
  const errorMessage = error instanceof Error ? error.message : "";
  const isEmpty =
    activeChildId === null ? allMatches.length === 0 : childMatches.length === 0;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-game-bg">
      <ScreenHeader title={t("match:history.title")} />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => {
              void refetch();
            }}
            tintColor="#A78BFA"
            colors={["#A78BFA"]}
          />
        }
      >
        <View className="w-full max-w-[480px] self-center px-4 pt-3 pb-10">
          {!isChild && visibleChildren.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4 -mx-1"
            >
              <View className="flex-row gap-2 px-1">
                <TouchableOpacity
                  onPress={() => {
                    hapticsService.selection();
                    setSelectedChildId(null);
                  }}
                  activeOpacity={0.8}
                  className={`rounded-full px-4 py-2 ${
                    resolvedSelectedChildId === null
                      ? "bg-[#6C5CE7]"
                      : "bg-[#161221] border border-white/[0.06]"
                  }`}
                >
                  <Text
                    className={`font-body-bold text-xs ${
                      resolvedSelectedChildId === null
                        ? "text-white"
                        : "text-[#9CA3AF]"
                    }`}
                  >
                    {t("homework:filters.all")}
                  </Text>
                </TouchableOpacity>

                {visibleChildren.map((child) => {
                  const isActive = resolvedSelectedChildId === child.id;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      onPress={() => {
                        hapticsService.selection();
                        setSelectedChildId(child.id);
                      }}
                      activeOpacity={0.8}
                      className={`rounded-full px-4 py-2 ${
                        isActive
                          ? "bg-[#6C5CE7]"
                          : "bg-[#161221] border border-white/[0.06]"
                      }`}
                    >
                      <Text
                        className={`font-body-bold text-xs ${
                          isActive ? "text-white" : "text-[#9CA3AF]"
                        }`}
                      >
                        {child.displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}

          {isLoading ? (
            <View className="items-center pt-20">
              <AnimatedLoader
                size="lg"
                message={t("match:history.loadingMessage")}
              />
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
                void refetch();
              }}
            />
          ) : null}

          {!isLoading && !isError && isEmpty ? (
            <StateCard
              icon="game-controller-outline"
              title={t("match:history.emptyTitle")}
              subtitle={t("match:history.emptySubtitle")}
            />
          ) : null}

          {!isLoading && !isError && !isEmpty ? (
            <HistoryListShell>
              <StaggeredList staggerMs={45}>
                {activeChildId === null
                  ? allMatches.map((match: any) => {
                      const matchId = match._id || match.id;
                      return (
                        <MatchHistoryCard
                          key={matchId}
                          match={match}
                          onPress={
                            matchId && (!isGuest || match.status === "COMPLETED")
                              ? () => {
                                  if (!isGuest) {
                                    router.push({
                                      pathname: "/match/detail" as any,
                                      params: { matchId },
                                    });
                                  } else {
                                    router.push({
                                      pathname: "/match/correction" as any,
                                      params: { matchId },
                                    });
                                  }
                                }
                              : undefined
                          }
                        />
                      );
                    })
                  : childMatches.map((summary) => (
                      <ChildMatchSummaryCard
                        key={summary.matchId}
                        summary={summary}
                        onPress={() => {
                          router.push({
                            pathname: "/match/review" as any,
                            params: {
                              matchId: summary.matchId,
                              childId: activeChildId,
                              subject: summary.subject,
                            },
                          });
                        }}
                      />
                    ))}
              </StaggeredList>
            </HistoryListShell>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
