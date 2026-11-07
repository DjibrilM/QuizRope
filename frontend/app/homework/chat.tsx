import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MathMarkdown } from "../../src/components/common/MathMarkdown";
import { ScreenHeader, AnimatedLoader } from "../../src/components/common";
import { useHomeworkChat, type ChatMessage } from "../../src/hooks/useHomeworkChat";
import { useGameStore } from "../../src/stores/gameStore";
import * as guestDb from "../../src/services/guestDb";
import { apiService } from "../../src/services/api";
import { FONTS } from "../../src/constants/theme";

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

  return (
    <Animated.Text
      style={{
        opacity,
        color: "#6C5CE7",
        fontSize: 16,
        lineHeight: 10,
        marginTop: -4,
      }}
    >
      ▋
    </Animated.Text>
  );
}

const QUICK_SUGGESTIONS = [
  { label: "Give me a hint", text: "Can you give me a hint without giving away the full answer?", icon: "bulb-outline" as const },
  { label: "Step-by-step", text: "Can you explain this step by step?", icon: "list-outline" as const },
  { label: "Explain simply", text: "Can you explain the main idea in simple terms?", icon: "school-outline" as const },
  { label: "What's the first step?", text: "What should be my first step to solve this?", icon: "help-circle-outline" as const },
];

export default function HomeworkChatScreen() {
  const { t } = useTranslation(["homework", "common"]);
  const params = useLocalSearchParams<{
    sessionId: string;
    guestContext?: string;
  }>();
  const sessionId = params.sessionId || "";

  const { userRole } = useGameStore();
  const isGuest = userRole === "guest";

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["homeworkSession", sessionId],
    queryFn: () =>
      isGuest
        ? guestDb.getHomeworkSession(sessionId)
        : apiService.getHomeworkSession(sessionId),
    enabled: !!sessionId,
  });

  const effectiveGuestContext =
    params.guestContext || (isGuest ? session?.answersMarkdown || "" : undefined);

  const { messages, send, stop, streaming, loadMore, isLoadingMore } =
    useHomeworkChat(sessionId, effectiveGuestContext);

  const [input, setInput] = useState("");
  const scrollRef = useRef<FlatList>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    send(text);
  }, [input, streaming, send]);

  const renderMessage = useCallback((item: ChatMessage) => {
    const isUser = item.role === "user";
    return (
      <View
        key={item._id}
        className={`max-w-[85%] rounded-[18px] px-3.5 py-2.5 my-[1px] ${
          isUser
            ? "self-end bg-[#6C5CE7] rounded-br-[4px]"
            : "self-start bg-[#1E1828] rounded-bl-[4px] border border-[#2D233D]"
        }`}
      >
        {isUser ? (
          <Text className="text-white font-body text-sm leading-[21px]">
            {item.content}
          </Text>
        ) : item.isStreaming ? (
          <View>
            {item.content ? (
              <Text className="text-white font-body text-base leading-[22px]">
                {item.content}
              </Text>
            ) : null}
            <View className="mt-0.5">
              <BlinkingCursor />
            </View>
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
      <SafeAreaView className="flex-1 bg-[#0D0B14]">
        <View className="flex-1 items-center justify-center">
          <AnimatedLoader size="lg" color="#6C5CE7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-[#0D0B14]">
      {/* ScreenHeader matching session screen structure */}
      <ScreenHeader title={t("chat.title")} />

      {/* Chat Area with Keyboard Handling */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-between">
          <FlatList
            ref={scrollRef}
            data={messages}
            extraData={messages[0]?.content + (streaming ? "_str" : "")}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => renderMessage(item)}
            inverted={true}
            className="flex-1"
            contentContainerStyle={{
              flexGrow: 1,
              paddingVertical: 12,
            }}
            contentContainerClassName="px-4 gap-2.5"
            keyboardShouldPersistTaps="handled"
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pt-24 gap-3 scale-y-[-1]">
                <View className="w-16 h-16 rounded-full bg-[#1E1828] items-center justify-center mb-1">
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={32}
                    color="#6C5CE7"
                  />
                </View>
                <Text className="text-white font-['Bungee_400Regular'] text-base text-center">
                  {t("chat.title")}
                </Text>
                <Text className="text-[#8E7D9E] font-body text-sm text-center px-8">
                  {t("chat.emptyState")}
                </Text>
              </View>
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View className="py-4 items-center justify-center">
                  <ActivityIndicator color="#6C5CE7" />
                </View>
              ) : null
            }
          />

          {/* Quick Suggestions */}
          {!streaming && (
            <View className="pt-2">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              >
                {QUICK_SUGGESTIONS.map((item, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setInput(item.text);
                      send(item.text);
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181324] border border-[#2D233D]"
                  >
                    <Ionicons name={item.icon} size={13} color="#A78BFA" />
                    <Text className="text-[#C4B5D4] font-body text-xs">
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Prompt Capsule */}
          <View className="px-4 pt-2 pb-2 bg-[#0D0B14]">
            <View className="bg-[#181324] rounded-[24px] border border-[#2D233D] px-4 pt-3 pb-2.5 shadow-sm">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t("chat.placeholder")}
                placeholderTextColor="#64537A"
                multiline
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                editable={!streaming}
                className="text-white font-body text-sm max-h-[120px] min-h-[44px] leading-5"
                style={streaming ? { opacity: 0.5 } : undefined}
              />

              {/* Bottom Capsule Row */}
              <View className="flex-row items-center justify-between pt-1">
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#231A33]">
                  <Ionicons name="sparkles" size={12} color="#A78BFA" />
                  <Text className="text-[#A78BFA] text-[11px] font-body">{t("chat.title")}</Text>
                </View>

                {streaming ? (
                  <Pressable
                    onPress={stop}
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                    className="w-8 h-8 rounded-full items-center justify-center bg-[#E85D75]"
                    accessibilityRole="button"
                    accessibilityLabel="Stop"
                  >
                    <Ionicons name="stop" size={14} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleSend}
                    disabled={!input.trim()}
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      input.trim() ? "bg-[#6C5CE7]" : "bg-[#251E33]"
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                  >
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={input.trim() ? "#FFFFFF" : "#5A4B6B"}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const mdStyles = {
  body: {
    color: "#FFFFFF",
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    color: "#FFFFFF",
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
    color: "#FFFFFF",
  },
  h1: {
    color: "#FFFFFF",
    fontFamily: FONTS.heading,
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
    backgroundColor: "#0D0B14",
    color: "#A78BFA",
    fontFamily: "monospace",
    fontSize: 13,
  },
  codeBlock: {
    backgroundColor: "#0D0B14",
    borderColor: "#2D233D",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    color: "#A78BFA",
    fontFamily: "monospace",
    fontSize: 13,
  },
  list: {
    color: "#FFFFFF",
    bulletColor: "#A78BFA",
    markerColor: "#A78BFA",
    marginTop: 4,
    marginBottom: 6,
  },
  listItem: {
    color: "#FFFFFF",
    marginBottom: 3,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#6C5CE7",
    paddingLeft: 10,
    marginVertical: 6,
    color: "#D4C5E4",
  },
  hr: { backgroundColor: "#2D1F3D", height: 1, marginVertical: 8 },
  link: { color: "#A78BFA" },
  math: {
    color: "#fab143",
    backgroundColor: "transparent",
    fontSize: 16,
  },
  inlineMath: {
    color: "#fab143",
  },
};
