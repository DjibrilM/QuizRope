import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MathMarkdown } from "../../src/components/common/MathMarkdown";
import {
  AnimatedLoader,
  BrainMascot,
  type OrbState,
} from "../../src/components/common";
import {
  useHomeworkChat,
  type ChatMessage,
} from "../../src/hooks/useHomeworkChat";
import { useGameStore } from "../../src/stores/gameStore";
import * as guestDb from "../../src/services/guestDb";
import { apiService } from "../../src/services/api";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

function BlinkingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.Text style={[styles.cursor, { opacity }]}>▋</Animated.Text>;
}

function HeaderMascotSlot({
  orbStateRef,
  subscribe,
}: {
  orbStateRef: React.MutableRefObject<OrbState>;
  subscribe: (cb: () => void) => () => void;
}) {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((n) => n + 1)), [subscribe]);
  return (
    <View style={styles.headerMascotWrap}>
      <BrainMascot size={32} state={orbStateRef.current} interactive />
    </View>
  );
}

const mdStyles = {
  body: {
    color: UI_COLORS.textPrimary,
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    color: UI_COLORS.textPrimary,
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 0,
    marginBottom: 6,
  },
  strong: {
    fontFamily: FONTS.bodyBold,
    fontWeight: "bold" as const,
    color: "#FFFFFF",
  },
  em: {
    fontStyle: "italic" as const,
    color: UI_COLORS.textPrimary,
  },
  h1: {
    color: "#FFFFFF",
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    color: "#FFFFFF",
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    marginTop: 6,
    marginBottom: 2,
  },
  h3: {
    color: "#E2D9F3",
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 2,
  },
  code: {
    backgroundColor: UI_COLORS.bg,
    color: "#A78BFA",
    fontFamily: "Menlo",
    fontSize: 13,
  },
  codeBlock: {
    backgroundColor: UI_COLORS.bg,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    color: "#A78BFA",
    fontFamily: "Menlo",
    fontSize: 13,
  },
};

export default function HomeworkChatScreen() {
  const { t } = useTranslation(["homework", "common"]);
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{
    sessionId: string;
    guestContext?: string;
    subject?: string;
  }>();
  const sessionId = params.sessionId || "";

  const { userRole, locale } = useGameStore();
  const isGuest = userRole === "guest";

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["homeworkSession", sessionId],
    queryFn: () =>
      isGuest
        ? guestDb.getHomeworkSession(sessionId)
        : apiService.getHomeworkSession(sessionId),
    enabled: !!sessionId,
  });

  const effectiveGuestContext =
    params.guestContext ||
    (isGuest ? session?.answersMarkdown || "" : undefined);

  const { messages, send, stop, streaming, loadMore, isLoadingMore } =
    useHomeworkChat(sessionId, effectiveGuestContext);

  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [completionMood, setCompletionMood] = useState<"done" | "error" | null>(
    null,
  );
  const prevStreamingRef = useRef(streaming);
  const latestMessageRef = useRef(messages[0]);
  latestMessageRef.current = messages[0];

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = streaming;

    if (streaming) {
      setCompletionMood(null);
      return;
    }

    if (wasStreaming) {
      const latest = latestMessageRef.current;
      const nextMood = latest?._id?.startsWith("err-") ? "error" : "done";
      setCompletionMood(nextMood);
      const timer = setTimeout(() => {
        setCompletionMood(null);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [streaming]);

  const orbState: OrbState = (() => {
    if (streaming) {
      return messages[0]?.content ? "streaming" : "thinking";
    }
    if (completionMood) return completionMood;
    if (inputFocused) return "listening";
    return "idle";
  })();

  const orbStateRef = useRef<OrbState>(orbState);
  const orbListenersRef = useRef(new Set<() => void>());
  const subscribeOrb = useCallback((cb: () => void) => {
    orbListenersRef.current.add(cb);
    return () => {
      orbListenersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    orbStateRef.current = orbState;
    orbListenersRef.current.forEach((cb) => cb());
  }, [orbState]);

  const hasMessages = messages.length > 0;
  const showSuggestions = !hasMessages && !streaming;
  const suggestionsVisibility = useSharedValue(showSuggestions ? 1 : 0);

  useEffect(() => {
    suggestionsVisibility.value = withTiming(showSuggestions ? 1 : 0, {
      duration: 240,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [showSuggestions, suggestionsVisibility]);

  const suggestionsAnimatedStyle = useAnimatedStyle(() => ({
    height: suggestionsVisibility.value * 40,
    opacity: suggestionsVisibility.value,
    transform: [{ translateY: (1 - suggestionsVisibility.value) * 8 }],
    overflow: "hidden",
  }));

  const renderHeaderRight = useCallback(
    () => (
      <HeaderMascotSlot orbStateRef={orbStateRef} subscribe={subscribeOrb} />
    ),
    [subscribeOrb],
  );

  const suggestions = useMemo(
    () => [
      {
        label: t("chat.suggestions.hintLabel"),
        text: t("chat.suggestions.hintPrompt"),
        icon: "bulb-outline" as const,
      },
      {
        label: t("chat.suggestions.stepsLabel"),
        text: t("chat.suggestions.stepsPrompt"),
        icon: "list-outline" as const,
      },
      {
        label: t("chat.suggestions.simpleLabel"),
        text: t("chat.suggestions.simplePrompt"),
        icon: "school-outline" as const,
      },
      {
        label: t("chat.suggestions.firstLabel"),
        text: t("chat.suggestions.firstPrompt"),
        icon: "help-circle-outline" as const,
      },
    ],
    [t],
  );

  const subjectKey = (params.subject || session?.subject || "").toUpperCase();
  const subjectLabel = subjectKey
    ? t(`common:subjects.${subjectKey}`, { defaultValue: subjectKey })
    : t("chat.title");

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    hapticsService.selection();
    setInput("");
    send(text);
  }, [input, streaming, send]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    if (isUser) {
      return (
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={styles.aiMessageWrap}>
        {item.isStreaming ? (
          <View>
            {item.content ? (
              <Text style={styles.streamingText}>{item.content}</Text>
            ) : null}
            <BlinkingCursor />
          </View>
        ) : (
          <MathMarkdown
            content={item.content}
            style={mdStyles}
            bgColor="transparent"
          />
        )}
      </View>
    );
  }, []);

  if (sessionLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: t("chat.title"),
            headerStyle: { backgroundColor: UI_COLORS.bg },
            headerTitleStyle: {
              fontFamily: headingFont,
              fontSize: 18,
              color: UI_COLORS.textPrimary,
            },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            headerTintColor: UI_COLORS.textPrimary,
          }}
        />
        <View style={styles.center}>
          <AnimatedLoader size="lg" color={UI_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const canSend = input.trim().length > 0;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("chat.title"),
          headerStyle: { backgroundColor: UI_COLORS.bg },
          headerTitleStyle: {
            fontFamily: headingFont,
            fontSize: 18,
            color: UI_COLORS.textPrimary,
          },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: UI_COLORS.textPrimary,
          headerRight: hasMessages ? renderHeaderRight : undefined,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
        style={styles.flex}
      >
        <View style={styles.chatColumn}>
          <View style={styles.listWrap}>
            <FlatList
              data={messages}
              extraData={(messages[0]?.content ?? "") + (streaming ? "_str" : "")}
              keyExtractor={(item) => item._id}
              renderItem={renderMessage}
              inverted
              style={styles.flex}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyMascotWrap}>
                    <BrainMascot size={78} state={orbState} interactive />
                  </View>
                  <Text style={[styles.emptyTitle, { fontFamily: headingFont }]}>
                    {t("chat.title")}
                  </Text>
                  <Text style={styles.emptySubtitle}>{t("chat.emptyState")}</Text>
                </View>
              }
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={styles.loadMoreWrap}>
                    <ActivityIndicator color={UI_COLORS.primary} />
                  </View>
                ) : null
              }
            />

            {hasMessages ? (
              <>
                <LinearGradient
                  colors={[UI_COLORS.bg, "rgba(13, 11, 20, 0)"]}
                  locations={[0, 1]}
                  style={styles.topFade}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={[
                    "rgba(13, 11, 20, 0)",
                    "rgba(13, 11, 20, 0.72)",
                    UI_COLORS.bg,
                  ]}
                  locations={[0, 0.55, 1]}
                  style={styles.bottomFade}
                  pointerEvents="none"
                />
              </>
            ) : null}
          </View>

          {/* Quick Suggestion Pills (animated collapse on first message) */}
          <Reanimated.View
            style={suggestionsAnimatedStyle}
            pointerEvents={showSuggestions ? "auto" : "none"}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsContent}
            >
              {suggestions.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.78}
                  onPress={() => {
                    hapticsService.selection();
                    setInput(item.text);
                    inputRef.current?.focus();
                  }}
                  style={styles.suggestionPill}
                >
                  <Ionicons name={item.icon} size={13} color="#A78BFA" />
                  <Text style={styles.suggestionText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Reanimated.View>

          {/* Concentric Prompt Capsule */}
          <View style={styles.composerWrap}>
            <View
              style={[
                styles.composerBox,
                inputFocused && styles.composerBoxFocused,
              ]}
            >
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={t("chat.placeholder")}
                placeholderTextColor={UI_COLORS.textMuted}
                multiline
                editable={!streaming}
                style={[styles.textInput, streaming && { opacity: 0.5 }]}
              />

              <View style={styles.composerBottomRow}>
                <View style={styles.contextPill}>
                  <Ionicons name="chatbubble-ellipses-outline" size={11} color="#A78BFA" />
                  <Text style={styles.contextPillText} numberOfLines={1}>
                    {subjectLabel}
                  </Text>
                </View>

                {streaming ? (
                  <TouchableOpacity
                    onPress={() => {
                      hapticsService.selection();
                      stop();
                    }}
                    activeOpacity={0.82}
                    style={[styles.circleAction, styles.stopBtn]}
                    accessibilityRole="button"
                    accessibilityLabel="Stop"
                  >
                    <Ionicons name="stop" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleSend}
                    disabled={!canSend}
                    activeOpacity={0.82}
                    style={[
                      styles.circleAction,
                      canSend ? styles.sendBtnActive : styles.sendBtnDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                  >
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={canSend ? "#FFFFFF" : "#A78BFA"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatColumn: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  listWrap: {
    flex: 1,
    position: "relative",
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 18,
    gap: 14,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 18,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: UI_COLORS.primary,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    borderCurve: "continuous",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  aiMessageWrap: {
    width: "100%",
    paddingVertical: 2,
  },
  userBubbleText: {
    fontFamily: FONTS.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: "#FFFFFF",
  },
  streamingText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: UI_COLORS.textPrimary,
  },
  cursor: {
    color: UI_COLORS.primary,
    fontSize: 15,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 64,
    gap: 8,
    transform: [{ scaleY: -1 }],
  },
  emptyMascotWrap: {
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMascotWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  loadMoreWrap: {
    paddingVertical: 14,
    alignItems: "center",
  },
  suggestionsScroll: {
    flexGrow: 0,
    paddingTop: 6,
  },
  suggestionsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.primarySoft,
  },
  suggestionText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12.5,
    color: "#E2D9F3",
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  composerBox: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(108, 92, 231, 0.22)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  composerBoxFocused: {
    borderColor: UI_COLORS.primary,
  },
  textInput: {
    fontFamily: FONTS.body,
    fontSize: 14.5,
    lineHeight: 20,
    color: UI_COLORS.textPrimary,
    minHeight: 40,
    maxHeight: 120,
  },
  composerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: UI_COLORS.primarySoft,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
  },
  contextPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: "#C4B5FD",
  },
  circleAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    backgroundColor: UI_COLORS.coral,
  },
  sendBtnActive: {
    backgroundColor: UI_COLORS.primary,
  },
  sendBtnDisabled: {
    backgroundColor: UI_COLORS.primarySoft,
  },
});
