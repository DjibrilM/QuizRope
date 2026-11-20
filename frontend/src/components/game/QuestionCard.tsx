import React, { useEffect, useMemo } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AnimatedOption } from "./AnimatedOption";
import { formatMathMarkdown } from "../common/MathMarkdown";
import { UI_COLORS } from "../../constants/theme";

interface QuestionCardProps {
  question: {
    id: string;
    text: string;
    options: string[];
    subject: string;
  } | null;
  selectedAnswer: number | null;
  correctIndex?: number;
  roundResult: {
    isCorrect: boolean;
    correctIndex: number;
    ropeMovement: number;
  } | null;
  onAnswer: (index: number) => void;
  teamSide: "LEFT" | "RIGHT";
  teamColor: string;
  compact?: boolean;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  selectedAnswer,
  correctIndex,
  roundResult,
  onAnswer,
  teamSide,
  teamColor,
  compact = false,
}: QuestionCardProps) {
  void teamSide;
  const questionScale = useSharedValue(0.97);
  const questionOpacity = useSharedValue(0);

  useEffect(() => {
    if (!question) return;

    questionScale.value = 0.97;
    questionOpacity.value = 0;

    questionScale.value = withSpring(1, { damping: 24, stiffness: 420 });
    questionOpacity.value = withSpring(1, { damping: 24, stiffness: 420 });
  }, [question?.id, question, questionOpacity, questionScale]);

  const questionAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: questionScale.value }],
    opacity: questionOpacity.value,
  }));

  const processedMarkdown = useMemo(() => {
    return question ? formatMathMarkdown(question.text, "#FFFFFF") : "";
  }, [question?.text, question]);

  if (!question) return null;

  const resolvedCorrectIndex = correctIndex ?? roundResult?.correctIndex;

  const getVariant = (
    index: number,
  ): "default" | "selected" | "correct" | "wrong" => {
    if (selectedAnswer !== null && resolvedCorrectIndex !== undefined) {
      if (index === resolvedCorrectIndex) return "correct";
      if (index === selectedAnswer) return "wrong";
      return "default";
    }

    if (roundResult) {
      if (index === roundResult.correctIndex) return "correct";
      if (index === selectedAnswer && !roundResult.isCorrect) return "wrong";
      return "default";
    }

    if (index === selectedAnswer) return "selected";
    return "default";
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Central question stem */}
      <ScrollView
        style={styles.promptScroll}
        contentContainerStyle={[
          styles.promptContent,
          compact ? styles.promptContentCompact : styles.promptContentSolo,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[questionAnimatedStyle, styles.promptInner]}>
          <EnrichedMarkdownText
            flavor="github"
            markdown={processedMarkdown}
            onLinkPress={({ url }) => Linking.openURL(url)}
            markdownStyle={{
              paragraph: {
                color: UI_COLORS.textPrimary,
                fontSize: compact ? 15 : 19,
                lineHeight: compact ? 21 : 27,
                marginBottom: 8,
                textAlign: "center",
              },
              h1: {
                fontSize: compact ? 18 : 24,
                fontWeight: "700",
                color: "#FFFFFF",
                marginBottom: 8,
                marginTop: 8,
                textAlign: "center",
              },
              h2: {
                fontSize: compact ? 16 : 21,
                fontWeight: "700",
                color: "#F9FAFB",
                marginBottom: 6,
                marginTop: 8,
                textAlign: "center",
              },
              h3: {
                fontSize: compact ? 15 : 18,
                fontWeight: "600",
                color: "#F3F4F6",
                marginBottom: 4,
                marginTop: 6,
                textAlign: "center",
              },
              link: {
                color: "#60A5FA",
              },
              list: {
                marginBottom: 8,
              },
              code: {
                backgroundColor: UI_COLORS.surfaceElevated,
                color: "#F9FAFB",
                fontFamily: "Menlo",
                fontSize: compact ? 12 : 14,
              },
              codeBlock: {
                backgroundColor: "#161221",
                color: "#E2E8F0",
                padding: 12,
                borderRadius: 12,
                fontFamily: "Menlo",
                fontSize: compact ? 12 : 14,
              },
              blockquote: {
                color: UI_COLORS.textSecondary,
              },
              table: {
                borderColor: "#261F36",
                borderRadius: 8,
              },
              math: {
                color: "#FFFFFF",
                backgroundColor: "transparent",
                textAlign: "center" as const,
              },
              inlineMath: {
                color: "#FFFFFF",
              },
            }}
          />
        </Animated.View>
      </ScrollView>

      {/* Answer Options */}
      <View
        style={[
          styles.optionsContainer,
          compact ? styles.optionsGridCompact : styles.optionsStackSolo,
        ]}
      >
        {question.options.map((option, i) => {
          const isLongCompact =
            option.length > 22 || question.options.length <= 2;

          return (
            <View
              key={i}
              style={
                compact
                  ? { width: isLongCompact ? "100%" : "48.5%" }
                  : styles.optionSlotFull
              }
            >
              <AnimatedOption
                label={OPTION_LABELS[i] ?? String(i + 1)}
                optionText={option}
                index={i}
                questionId={question.id}
                staggerDelay={i * 20}
                variant={getVariant(i)}
                teamColor={teamColor}
                disabled={selectedAnswer !== null}
                onPress={() => onAnswer(i)}
                compact={compact}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  containerCompact: {
    maxWidth: undefined,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  promptScroll: {
    flex: 1,
  },
  promptContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  promptContentSolo: {
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  promptContentCompact: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  promptInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  optionsContainer: {
    width: "100%",
  },
  optionsStackSolo: {
    gap: 10,
    paddingTop: 8,
  },
  optionsGridCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 6,
  },
  optionSlotFull: {
    width: "100%",
  },
});
