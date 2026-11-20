import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { AnimatedLoader } from "../common/AnimatedLoader";
import { MathMarkdown, formatMathMarkdown } from "../common/MathMarkdown";
import { PillButton } from "../ui";
import { useGameStore } from "../../stores/gameStore";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { hapticsService } from "../../services/haptics";

export interface ReviewQuestionItem {
  questionText: string;
  options: string[];
  correctIndex: number;
  userAnswerIndex: number; // -1 = timed out / skipped
  isCorrect: boolean;
  explanation?: string;
  responseTime?: number; // milliseconds
}

interface MatchReviewViewProps {
  title: string;
  subject?: string;
  items: ReviewQuestionItem[];
  isLoading?: boolean;
  errorMessage?: string;
  emptyMessage: string;
  onRetry?: () => void;
}

type FilterMode = "all" | "missed" | "correct";

const OPTION_LABELS = ["A", "B", "C", "D"];
const FILTER_MODES: FilterMode[] = ["all", "missed", "correct"];
const SEGMENT_PAD = 4;
const SEGMENT_GAP = 4;

const PROMPT_MD_STYLE = {
  body: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
    lineHeight: 24,
  },
  paragraph: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 2,
  },
};

const EXPLANATION_MD_STYLE = {
  body: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: UI_COLORS.textPrimary,
    lineHeight: 21,
  },
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: UI_COLORS.textPrimary,
    lineHeight: 21,
    marginBottom: 4,
  },
};

function ReviewFilterBar({
  selected,
  onSelect,
  counts,
}: {
  selected: FilterMode;
  onSelect: (mode: FilterMode) => void;
  counts: { all: number; missed: number; correct: number };
}) {
  const { t } = useTranslation("game");
  const [shellWidth, setShellWidth] = useState(0);
  const activeIndex = useSharedValue(FILTER_MODES.indexOf(selected));

  useEffect(() => {
    activeIndex.value = withTiming(FILTER_MODES.indexOf(selected), {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, selected]);

  const slotWidth =
    shellWidth > 0
      ? (shellWidth - SEGMENT_PAD * 2 - SEGMENT_GAP * 2) / 3
      : 0;

  const sliderStyle = useAnimatedStyle(() => ({
    width: slotWidth,
    transform: [{ translateX: activeIndex.value * (slotWidth + SEGMENT_GAP) }],
  }));

  const labels: Record<FilterMode, string> = {
    all: `${t("correction.filterAll")} (${counts.all})`,
    missed: `${t("correction.filterMissed")} (${counts.missed})`,
    correct: `${t("correction.filterCorrect")} (${counts.correct})`,
  };

  return (
    <View
      style={styles.filterShell}
      onLayout={(e) => setShellWidth(e.nativeEvent.layout.width)}
    >
      {slotWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.filterSlider, sliderStyle]}
        />
      ) : null}

      {FILTER_MODES.map((mode, index) => (
        <FilterSegmentTab
          key={mode}
          index={index}
          label={labels[mode]}
          selected={selected === mode}
          progress={activeIndex}
          onPress={() => {
            if (selected !== mode) {
              hapticsService.selection();
              onSelect(mode);
            }
          }}
        />
      ))}
    </View>
  );
}

function FilterSegmentTab({
  index,
  label,
  selected,
  progress,
  onPress,
}: {
  index: number;
  label: string;
  selected: boolean;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const textAnimatedStyle = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(progress.value - index));
    return {
      color: interpolateColor(
        distance,
        [0, 1],
        ["#FFFFFF", UI_COLORS.textSecondary],
      ),
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={styles.filterTab}
    >
      <Animated.Text
        style={[styles.filterTabText, textAnimatedStyle]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
}

function OptionReviewPill({
  label,
  optionText,
  variant,
}: {
  label: string;
  optionText: string;
  variant: "default" | "correct" | "wrong";
}) {
  const palette =
    variant === "correct"
      ? {
          bg: "rgba(52, 211, 153, 0.12)",
          border: "rgba(52, 211, 153, 0.45)",
          badgeBg: "rgba(52, 211, 153, 0.22)",
          text: UI_COLORS.mint,
          math: UI_COLORS.mint,
        }
      : variant === "wrong"
        ? {
            bg: "rgba(239, 68, 68, 0.12)",
            border: "rgba(239, 68, 68, 0.45)",
            badgeBg: "rgba(239, 68, 68, 0.22)",
            text: "#EF4444",
            math: "#EF4444",
          }
        : {
            bg: UI_COLORS.surfaceSubtle,
            border: "rgba(255, 255, 255, 0.05)",
            badgeBg: UI_COLORS.surfaceElevated,
            text: UI_COLORS.textSecondary,
            math: UI_COLORS.textSecondary,
          };

  const processed = useMemo(
    () => formatMathMarkdown(optionText, palette.math),
    [optionText, palette.math],
  );

  return (
    <View
      style={[
        styles.optionPill,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <View
        style={[styles.optionLetterBall, { backgroundColor: palette.badgeBg }]}
      >
        <Text style={[styles.optionLetterText, { color: palette.text }]}>
          {label}
        </Text>
      </View>

      <View style={styles.optionContent}>
        <EnrichedMarkdownText
          flavor="github"
          markdown={processed}
          onLinkPress={({ url }) => Linking.openURL(url)}
          markdownStyle={{
            paragraph: {
              color: palette.text,
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 0,
            },
            code: {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: palette.text,
            },
            math: {
              color: palette.math,
              backgroundColor: "transparent",
            },
            inlineMath: {
              color: palette.math,
            },
          }}
        />
      </View>

      {variant === "correct" ? (
        <Ionicons name="checkmark-circle" size={20} color={UI_COLORS.mint} />
      ) : null}
      {variant === "wrong" ? (
        <Ionicons name="close-circle" size={20} color="#EF4444" />
      ) : null}
    </View>
  );
}

function ReviewQuestionCard({
  item,
  questionNumber,
  isCopied,
  onCopy,
}: {
  item: ReviewQuestionItem;
  questionNumber: number;
  isCopied: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation("game");
  const isSkipped = !item.isCorrect && item.userAnswerIndex === -1;

  const statusBadge = item.isCorrect
    ? {
        bg: "rgba(52, 211, 153, 0.14)",
        color: UI_COLORS.mint,
        icon: "checkmark-circle" as const,
        label: t("correction.statusCorrect"),
      }
    : isSkipped
      ? {
          bg: "rgba(251, 191, 36, 0.14)",
          color: UI_COLORS.amber,
          icon: "time-outline" as const,
          label: t("correction.statusSkipped"),
        }
      : {
          bg: "rgba(239, 68, 68, 0.14)",
          color: "#EF4444",
          icon: "close-circle" as const,
          label: t("correction.statusWrong"),
        };

  return (
    <View style={styles.questionCard}>
      {/* Card Header */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.questionNumberText}>
            {t("correction.question", { number: questionNumber })}
          </Text>
          <View
            style={[styles.statusPill, { backgroundColor: statusBadge.bg }]}
          >
            <Ionicons
              name={statusBadge.icon}
              size={13}
              color={statusBadge.color}
            />
            <Text style={[styles.statusPillText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardHeaderRight}>
          {item.responseTime !== undefined && item.responseTime > 0 ? (
            <View style={styles.timePill}>
              <Ionicons
                name="time-outline"
                size={12}
                color={UI_COLORS.textSecondary}
              />
              <Text style={styles.timePillText}>
                {(item.responseTime / 1000).toFixed(1)}s
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={onCopy}
            hitSlop={8}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Copy question"
            style={[
              styles.copyButton,
              isCopied && styles.copyButtonActive,
            ]}
          >
            <Ionicons
              name={isCopied ? "checkmark" : "copy-outline"}
              size={15}
              color={isCopied ? UI_COLORS.mint : UI_COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Question Prompt */}
      <MathMarkdown content={item.questionText} style={PROMPT_MD_STYLE} />

      {/* Skipped / Time Ran Out Callout */}
      {isSkipped ? (
        <View style={styles.skippedBanner}>
          <Ionicons name="time-outline" size={16} color={UI_COLORS.amber} />
          <Text style={styles.skippedText}>{t("correction.skipped")}</Text>
        </View>
      ) : null}

      {/* Options */}
      <View style={styles.optionsList}>
        {item.options.map((option, i) => {
          const isCorrectOption = i === item.correctIndex;
          const isUserWrong = i === item.userAnswerIndex && !item.isCorrect;
          const variant = isCorrectOption
            ? "correct"
            : isUserWrong
              ? "wrong"
              : "default";

          return (
            <OptionReviewPill
              key={i}
              label={OPTION_LABELS[i] ?? String(i + 1)}
              optionText={option}
              variant={variant}
            />
          );
        })}
      </View>

      {/* Concentric Explanation Tile */}
      {item.explanation?.trim() ? (
        <View style={styles.explanationTile}>
          <View style={styles.explanationHeader}>
            <Ionicons name="bulb-outline" size={14} color="#A78BFA" />
            <Text style={styles.explanationLabel}>
              {t("correction.explanation")}
            </Text>
          </View>
          <MathMarkdown
            content={item.explanation}
            style={EXPLANATION_MD_STYLE}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Full post-match review screen matching QuizRope's concentric matte design system.
 */
export function MatchReviewView({
  title,
  subject,
  items,
  isLoading = false,
  errorMessage,
  emptyMessage,
  onRetry,
}: MatchReviewViewProps) {
  const { t } = useTranslation(["game", "common"]);
  const locale = useGameStore((s) => s.locale);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const [filter, setFilter] = useState<FilterMode>("all");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const total = items.length;
  const correctCount = useMemo(
    () => items.filter((item) => item.isCorrect).length,
    [items],
  );
  const missedCount = total - correctCount;

  const indexedItems = useMemo(
    () => items.map((item, originalIndex) => ({ item, originalIndex })),
    [items],
  );

  const visibleItems = useMemo(() => {
    if (filter === "missed") {
      return indexedItems.filter(({ item }) => !item.isCorrect);
    }
    if (filter === "correct") {
      return indexedItems.filter(({ item }) => item.isCorrect);
    }
    return indexedItems;
  }, [filter, indexedItems]);

  const subjectKey = subject ? subject.toUpperCase() : "";
  const subjectLabel = subjectKey
    ? t(`common:subjects.${subjectKey}`, { defaultValue: subjectKey })
    : "";

  const subtitle = subjectLabel
    ? `${subjectLabel} · ${t("game:correction.questionsCount", { count: total })}`
    : t("game:correction.questionsCount", { count: total });

  const handleCopy = useCallback(
    async (item: ReviewQuestionItem, originalIndex: number) => {
      let text = `${t("game:correction.question", { number: originalIndex + 1 })}\n${item.questionText}\n\n`;
      item.options.forEach((opt, idx) => {
        const marker = idx === item.correctIndex ? " ✓" : "";
        text += `${OPTION_LABELS[idx] ?? idx + 1}. ${opt}${marker}\n`;
      });
      if (item.explanation) {
        text += `\n${t("game:correction.explanation")}:\n${item.explanation}\n`;
      }
      await Clipboard.setStringAsync(text);
      hapticsService.selection();
      setCopiedIndex(originalIndex);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopiedIndex(null);
      }, 1400);
    },
    [t],
  );

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          title: "",
          headerBackVisible: true,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: UI_COLORS.textPrimary,
        }}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: contentTop,
            paddingBottom: Math.max(insets.bottom, 20) + 18,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Editorial Title */}
          <View style={styles.heroSection}>
            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {title}
            </Text>
            {!isLoading && total > 0 ? (
              <Text style={styles.subheading}>{subtitle}</Text>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <AnimatedLoader size="lg" />
            </View>
          ) : errorMessage ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconHalo}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color="#EF4444"
                />
              </View>
              <Text style={styles.errorText}>{errorMessage}</Text>
              {onRetry ? (
                <PillButton
                  variant="secondary"
                  size="default"
                  label={t("common:buttons.tryAgain")}
                  onPress={onRetry}
                  style={styles.retryBtn}
                />
              ) : null}
            </View>
          ) : total === 0 ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconHalo}>
                <Ionicons
                  name="book-outline"
                  size={26}
                  color={UI_COLORS.textSecondary}
                />
              </View>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              <PillButton
                variant="secondary"
                size="default"
                label={t("game:correction.done")}
                onPress={() => router.back()}
                style={styles.retryBtn}
              />
            </View>
          ) : (
            <>
              {/* Segmented Filter Pill */}
              <ReviewFilterBar
                selected={filter}
                onSelect={setFilter}
                counts={{
                  all: total,
                  missed: missedCount,
                  correct: correctCount,
                }}
              />

              {/* Filtered Empty State or Question Cards */}
              {visibleItems.length === 0 ? (
                <View style={styles.stateCard}>
                  <View
                    style={[
                      styles.stateIconHalo,
                      filter === "missed" && {
                        backgroundColor: "rgba(52, 211, 153, 0.14)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        filter === "missed"
                          ? "checkmark-circle"
                          : "list-outline"
                      }
                      size={28}
                      color={
                        filter === "missed"
                          ? UI_COLORS.mint
                          : UI_COLORS.textSecondary
                      }
                    />
                  </View>
                  {filter === "missed" ? (
                    <>
                      <Text style={styles.filterEmptyTitle}>
                        {t("game:correction.perfectFilterTitle")}
                      </Text>
                      <Text style={styles.emptyText}>
                        {t("game:correction.perfectFilterSubtitle")}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>
                      {t("game:correction.noCorrectFilterSubtitle")}
                    </Text>
                  )}
                  <PillButton
                    variant="secondary"
                    size="default"
                    label={t("game:correction.showAll")}
                    onPress={() => setFilter("all")}
                    style={styles.retryBtn}
                  />
                </View>
              ) : (
                <View style={styles.cardsStack}>
                  {visibleItems.map(({ item, originalIndex }) => (
                    <ReviewQuestionCard
                      key={originalIndex}
                      item={item}
                      questionNumber={originalIndex + 1}
                      isCopied={copiedIndex === originalIndex}
                      onCopy={() => handleCopy(item, originalIndex)}
                    />
                  ))}
                </View>
              )}

              {/* Bottom Return Pill */}
              <View style={styles.footerWrap}>
                <PillButton
                  variant="secondary"
                  size="lg"
                  label={t("game:correction.done")}
                  onPress={() => router.back()}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 16,
  },
  heroSection: {
    marginBottom: 4,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    color: UI_COLORS.textPrimary,
    paddingTop: 2,
  },
  subheading: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  filterShell: {
    flexDirection: "row",
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: SEGMENT_PAD,
    gap: SEGMENT_GAP,
    position: "relative",
  },
  filterSlider: {
    position: "absolute",
    top: SEGMENT_PAD,
    bottom: SEGMENT_PAD,
    left: SEGMENT_PAD,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.primary,
  },
  filterTab: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  filterTabText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13,
  },
  cardsStack: {
    gap: 14,
  },
  questionCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 16,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  questionNumberText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13,
    color: UI_COLORS.textSecondary,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
  },
  statusPillText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11.5,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: UI_COLORS.surfaceSubtle,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
  },
  timePillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  copyButtonActive: {
    backgroundColor: "rgba(52, 211, 153, 0.16)",
  },
  skippedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(251, 191, 36, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  skippedText: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: UI_COLORS.amber,
  },
  optionsList: {
    gap: 8,
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    borderWidth: 1,
    minHeight: 48,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    gap: 10,
  },
  optionLetterBall: {
    width: 34,
    height: 34,
    borderRadius: UI_RADII.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13,
  },
  optionContent: {
    flex: 1,
    paddingVertical: 2,
  },
  explanationTile: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 14,
    gap: 6,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  explanationLabel: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11,
    color: UI_COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stateCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  stateIconHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  filterEmptyTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 17,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: "#EF4444",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    minWidth: 170,
  },
  footerWrap: {
    paddingTop: 6,
  },
});
