import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ChildMatchSummary } from "@shared/types/analytics.types";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import { AnimatedLoader, ScreenHeader } from "../../src/components/common";
import {
  ChildMatchSummaryCard,
  HistoryListShell,
} from "../../src/components/match";
import { StateCard } from "../../src/components/ui";
import { getSubjectTheme } from "../../src/config/subjectThemes";
import { hapticsService } from "../../src/services/haptics";

export default function ChildMatchesScreen() {
  usePortrait();
  const { t } = useTranslation(["analytics", "homework", "common"]);
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: matches = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ChildMatchSummary[]>({
    queryKey: ["childMatches", childId],
    queryFn: () => apiService.getChildMatchHistory(childId as string),
    enabled: !!childId,
    staleTime: 0,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const subjects = useMemo(() => {
    const seen = new Set<string>();
    for (const m of matches) {
      if (m.subject) seen.add(m.subject.toUpperCase());
    }
    return Array.from(seen);
  }, [matches]);

  const activeSubject =
    selectedSubject && subjects.includes(selectedSubject)
      ? selectedSubject
      : null;

  const filteredMatches = useMemo(() => {
    if (!activeSubject) return matches;
    return matches.filter(
      (m) => m.subject?.toUpperCase() === activeSubject,
    );
  }, [matches, activeSubject]);

  const errorMessage = error instanceof Error ? error.message : "";

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-game-bg">
      <ScreenHeader title={t("analytics:history.title")} />

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
        <View className="w-full max-w-[480px] self-center px-4 pt-3 pb-10">
          {!isLoading && !isError && subjects.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4 -mx-1"
            >
              <View className="flex-row gap-2 px-1">
                <TouchableOpacity
                  onPress={() => {
                    hapticsService.selection();
                    setSelectedSubject(null);
                  }}
                  activeOpacity={0.8}
                  className={`rounded-full px-4 py-2 ${
                    activeSubject === null
                      ? "bg-[#6C5CE7]"
                      : "bg-[#161221] border border-white/[0.06]"
                  }`}
                >
                  <Text
                    className={`font-body-bold text-xs ${
                      activeSubject === null ? "text-white" : "text-[#9CA3AF]"
                    }`}
                  >
                    {t("homework:filters.all")}
                  </Text>
                </TouchableOpacity>

                {subjects.map((subjectKey) => {
                  const isActive = activeSubject === subjectKey;
                  const label = t(`common:subjects.${subjectKey}`, {
                    defaultValue: getSubjectTheme(subjectKey).label,
                  });
                  return (
                    <TouchableOpacity
                      key={subjectKey}
                      onPress={() => {
                        hapticsService.selection();
                        setSelectedSubject(subjectKey);
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
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}

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
                void refetch();
              }}
            />
          ) : null}

          {!isLoading && !isError && matches.length === 0 ? (
            <StateCard
              icon="game-controller-outline"
              title={t("analytics:history.noMatches")}
              subtitle={t("analytics:history.noMatchesSubtitle")}
            />
          ) : null}

          {!isLoading && !isError && filteredMatches.length > 0 ? (
            <HistoryListShell>
              {filteredMatches.map((match) => (
                <ChildMatchSummaryCard
                  key={match.matchId}
                  summary={match}
                  onPress={() => {
                    router.push({
                      pathname: "/match/review" as any,
                      params: {
                        matchId: match.matchId,
                        childId: childId as string,
                        subject: match.subject,
                      },
                    });
                  }}
                />
              ))}
            </HistoryListShell>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
