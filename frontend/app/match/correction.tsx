import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import {
  MatchReviewView,
  type ReviewQuestionItem,
} from "../../src/components/match";

export default function CorrectionScreen() {
  usePortrait();
  const { t } = useTranslation(["game", "common"]);
  const { matchId, subject: subjectParam } = useLocalSearchParams<{
    sessionId?: string;
    matchId?: string;
    subject?: string;
  }>();

  const userRole = useGameStore((s) => s.userRole);
  const currentMatch = useGameStore((s) => s.currentMatch);
  const storeCorrections = useGameStore((s) => s.lastMatchCorrection);
  const storeMatchId = useGameStore((s) => s.lastMatchCorrectionMatchId);

  const isGuest = userRole === "guest";
  const hasMatchingStore =
    storeCorrections.length > 0 && (!matchId || storeMatchId === matchId);

  const {
    data: fetchedCorrections,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ReviewQuestionItem[]>({
    queryKey: ["corrections", matchId, userRole],
    queryFn: async () => {
      const id = matchId as string;
      if (isGuest) {
        return guestDb.getCorrections(id);
      }
      try {
        return await apiService.getSoloMatchCorrection(id);
      } catch (err) {
        const localRows = await guestDb.getCorrections(id).catch(() => []);
        if (localRows.length > 0) return localRows;
        throw err;
      }
    },
    enabled: !!matchId && !hasMatchingStore,
    staleTime: 5 * 60 * 1000,
  });

  const { data: guestMatch } = useQuery({
    queryKey: ["guestMatchMeta", matchId],
    queryFn: () => guestDb.getMatch(matchId as string),
    enabled: isGuest && !!matchId && !subjectParam,
  });

  const items: ReviewQuestionItem[] = hasMatchingStore
    ? storeCorrections
    : (fetchedCorrections ?? []);

  const currentMatchId = currentMatch?._id || (currentMatch as any)?.id;
  const resolvedSubject =
    subjectParam ||
    (matchId && currentMatchId === matchId ? currentMatch?.subject : undefined) ||
    guestMatch?.subject;

  const errorMessage =
    isError && items.length === 0
      ? error instanceof Error
        ? error.message
        : String(error)
      : undefined;

  return (
    <MatchReviewView
      title={t("game:correction.title")}
      subject={resolvedSubject}
      items={items}
      isLoading={!hasMatchingStore && isLoading}
      errorMessage={errorMessage}
      emptyMessage={t("game:correction.empty")}
      onRetry={matchId && !hasMatchingStore ? () => refetch() : undefined}
    />
  );
}
