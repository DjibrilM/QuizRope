import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AnswerDetail } from "@shared/types/analytics.types";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { useGameStore } from "../../src/stores/gameStore";
import {
  MatchReviewView,
  type ReviewQuestionItem,
} from "../../src/components/match";

export default function MatchReviewScreen() {
  usePortrait();
  const { t } = useTranslation(["analytics", "common"]);
  const { matchId, childId, subject } = useLocalSearchParams<{
    matchId?: string;
    childId?: string;
    subject?: string;
  }>();

  const userRole = useGameStore((s) => s.userRole);
  const storeCorrections = useGameStore((s) => s.lastMatchCorrection);
  const storeMatchId = useGameStore((s) => s.lastMatchCorrectionMatchId);
  const isGuest = userRole === "guest";
  const hasMatchingStore =
    !!matchId && storeCorrections.length > 0 && storeMatchId === matchId;

  const {
    data: remoteAnswers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AnswerDetail[]>({
    queryKey: ["matchReview", matchId, childId],
    queryFn: () =>
      apiService.getMatchReview(matchId as string, childId as string),
    enabled: !isGuest && !!matchId && !!childId,
  });

  const { data: guestCorrections = [], isLoading: loadingGuest } = useQuery({
    queryKey: ["guestReviewCorrections", matchId],
    queryFn: () => guestDb.getCorrections(matchId as string),
    enabled: isGuest && !!matchId && !hasMatchingStore,
  });

  const mappedRemote: ReviewQuestionItem[] = remoteAnswers.map((a) => ({
    questionText: a.questionText,
    options: a.options,
    correctIndex: a.correctIndex,
    userAnswerIndex: a.childAnswerIndex,
    isCorrect: a.isCorrect,
    explanation: a.explanation,
    responseTime: a.responseTime,
  }));

  let items: ReviewQuestionItem[] = [];
  if (isGuest) {
    items = hasMatchingStore ? storeCorrections : guestCorrections;
  } else if (mappedRemote.length > 0) {
    items = mappedRemote;
  } else if (hasMatchingStore) {
    items = storeCorrections;
  }

  const effectiveLoading = isGuest
    ? !hasMatchingStore && loadingGuest
    : isLoading && items.length === 0;

  const errorMessage =
    !isGuest && isError && !effectiveLoading && items.length === 0
      ? error instanceof Error
        ? error.message
        : String(error)
      : undefined;

  return (
    <MatchReviewView
      title={t("analytics:review.title")}
      subject={subject}
      items={items}
      isLoading={effectiveLoading}
      errorMessage={errorMessage}
      emptyMessage={t("analytics:review.noQuestions")}
      onRetry={!isGuest && matchId && childId ? () => refetch() : undefined}
    />
  );
}
