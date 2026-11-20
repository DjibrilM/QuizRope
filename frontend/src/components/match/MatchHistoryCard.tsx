import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ChildMatchSummary } from "@shared/types/analytics.types";
import type { Match } from "@shared/types/match.types";
import { getSubjectTheme } from "../../config/subjectThemes";
import { hapticsService } from "../../services/haptics";
import { useGameStore } from "../../stores/gameStore";

interface HistoryPill {
  label: string;
  bgClass: string;
  textClass: string;
}

interface HistoryMatchRowProps {
  title: string;
  subtitle: string;
  pills?: HistoryPill[];
  onPress?: () => void;
}

/**
 * Shallow dark wrapper container matching recent matches / session lists.
 */
export function HistoryListShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-[#161221] border border-white/[0.06] rounded-[28px] p-1.5 gap-1.5">
      {children}
    </View>
  );
}

/**
 * Shared compact match row rendered inside `HistoryListShell`.
 */
export function HistoryMatchRow({
  title,
  subtitle,
  pills = [],
  onPress,
}: HistoryMatchRowProps) {
  return (
    <TouchableOpacity
      onPress={
        onPress
          ? () => {
              hapticsService.selection();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? "button" : undefined}
      className="bg-[#1E182B] rounded-[23px] px-4 py-3.5 flex-row items-center gap-3"
    >
      <View className="flex-1 gap-0.5">
        <Text
          className="font-body-extrabold text-[15px] text-[#F9FAFB]"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="font-body text-xs text-[#9CA3AF]" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        {pills.map((pill, index) => (
          <View
            key={`${pill.label}-${index}`}
            className={`rounded-full px-2.5 py-1 ${pill.bgClass}`}
          >
            <Text className={`font-body-bold text-[11px] ${pill.textClass}`}>
              {pill.label}
            </Text>
          </View>
        ))}

        {onPress ? (
          <Ionicons name="chevron-forward" size={15} color="#6E6480" />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

interface MatchHistoryCardProps {
  match: Match;
  onPress?: () => void;
}

/**
 * Unified row for overall match history entries (parent/guest "All" tab).
 */
export function MatchHistoryCard({ match, onPress }: MatchHistoryCardProps) {
  const { t } = useTranslation(["match", "common"]);
  const locale = useGameStore((s) => s.locale);
  const theme = getSubjectTheme(match.subject);
  const subjectLabel = t(`common:subjects.${match.subject.toUpperCase()}`, {
    defaultValue: theme.label,
  });
  const difficultyLabel = t(
    `common:difficulties.${(match.difficulty || "easy").toLowerCase()}`,
    { defaultValue: match.difficulty },
  );
  const dateStr = new Date(match.createdAt).toLocaleDateString(
    locale || undefined,
    { month: "short", day: "numeric" },
  );

  const isSolo = (match as any).gameMode === "solo";
  const isCompleted = match.status === "COMPLETED";
  const isRedWinner = match.winner === "LEFT";

  let pill: HistoryPill = {
    label: t("match:history.waiting"),
    bgClass: "bg-[#261F36]",
    textClass: "text-[#9CA3AF]",
  };

  if (isCompleted && match.winner) {
    if (isSolo) {
      pill = {
        label: t("match:history.completed"),
        bgClass: "bg-[#34D399]/15",
        textClass: "text-[#34D399]",
      };
    } else if (isRedWinner) {
      pill = {
        label: `${t("common:teams.redTeam")} ${t("match:history.won")}`,
        bgClass: "bg-[#FF6B6B]/15",
        textClass: "text-[#FF6B6B]",
      };
    } else {
      pill = {
        label: `${t("common:teams.blueTeam")} ${t("match:history.won")}`,
        bgClass: "bg-[#4ECDC4]/15",
        textClass: "text-[#4ECDC4]",
      };
    }
  } else if (match.status === "IN_PROGRESS") {
    pill = {
      label: t("match:history.inProgress"),
      bgClass: "bg-[#FBBF24]/15",
      textClass: "text-[#FBBF24]",
    };
  } else if (
    (match.status as string) === "ABANDONED" ||
    match.status === "CANCELLED"
  ) {
    pill = {
      label: t("match:history.abandoned"),
      bgClass: "bg-[#E85D75]/15",
      textClass: "text-[#E85D75]",
    };
  }

  return (
    <HistoryMatchRow
      title={subjectLabel}
      subtitle={`${dateStr} · ${difficultyLabel} · ${match.rounds}/${match.maxRounds}`}
      pills={[pill]}
      onPress={onPress}
    />
  );
}

interface ChildMatchSummaryCardProps {
  summary: ChildMatchSummary;
  onPress: () => void;
}

/**
 * Unified row for per-child match history entries.
 */
export function ChildMatchSummaryCard({
  summary,
  onPress,
}: ChildMatchSummaryCardProps) {
  const { t } = useTranslation(["analytics", "common"]);
  const locale = useGameStore((s) => s.locale);
  const theme = getSubjectTheme(summary.subject);
  const subjectLabel = t(`common:subjects.${summary.subject.toUpperCase()}`, {
    defaultValue: theme.label,
  });
  const dateStr = new Date(summary.date).toLocaleDateString(
    locale || undefined,
    { month: "short", day: "numeric" },
  );
  const difficultyLabel = summary.difficulty
    ? t(`common:difficulties.${summary.difficulty.toLowerCase()}`, {
        defaultValue: summary.difficulty,
      })
    : null;

  const isSolo = summary.gameMode === "solo";
  const hasCounts =
    typeof summary.correctAnswers === "number" &&
    typeof summary.totalQuestions === "number" &&
    summary.totalQuestions > 0;
  const metaParts = [dateStr];
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

  const pills: HistoryPill[] = [];
  if (!isSolo) {
    pills.push({
      label: summary.didWin
        ? t("analytics:history.won")
        : t("analytics:history.lost"),
      bgClass: summary.didWin ? "bg-[#34D399]/15" : "bg-[#E85D75]/15",
      textClass: summary.didWin ? "text-[#34D399]" : "text-[#E85D75]",
    });
  }

  pills.push({
    label: `${summary.accuracy}%`,
    bgClass:
      summary.accuracy >= 75
        ? "bg-[#34D399]/15"
        : summary.accuracy >= 50
          ? "bg-[#FBBF24]/15"
          : "bg-[#E85D75]/15",
    textClass:
      summary.accuracy >= 75
        ? "text-[#34D399]"
        : summary.accuracy >= 50
          ? "text-[#FBBF24]"
          : "text-[#E85D75]",
  });

  return (
    <HistoryMatchRow
      title={subjectLabel}
      subtitle={metaText}
      pills={pills}
      onPress={onPress}
    />
  );
}
