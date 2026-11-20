import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  MathMarkdown,
  formatCopyableMarkdown,
} from "../../../src/components/common/MathMarkdown";
import { apiService } from "../../../src/services/api";
import * as guestDb from "../../../src/services/guestDb";
import { useGameStore } from "../../../src/stores/gameStore";
import { HomeworkBottomBar } from "../../../src/components/homework/HomeworkBottomBar";
import { HomeworkQuizSheet } from "../../../src/components/homework/HomeworkQuizSheet";
import { PillButton, type FloatingBottomSheetRef } from "../../../src/components/ui";
import { AnimatedLoader } from "../../../src/components/common";
import { FONTS, UI_COLORS, UI_RADII } from "../../../src/constants/theme";
import { getSubjectTheme } from "../../../src/config/subjectThemes";
import { getHeadingFont } from "../../../src/utils/fontForLocale";
import { hapticsService } from "../../../src/services/haptics";

const SOLUTION_MD_STYLE = {
  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    color: UI_COLORS.textPrimary,
  },
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    color: UI_COLORS.textPrimary,
    marginBottom: 10,
  },
  h1: {
    fontSize: 20,
    fontFamily: FONTS.bodyExtraBold,
    color: UI_COLORS.textPrimary,
  },
  h2: {
    fontSize: 17,
    fontFamily: FONTS.bodyExtraBold,
    color: UI_COLORS.textPrimary,
  },
  h3: {
    fontSize: 15.5,
    fontFamily: FONTS.bodyBold,
    color: "#E2D9F3",
  },
};

export default function HomeworkSessionScreen() {
  const { t } = useTranslation(["homework", "common"]);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const queryClient = useQueryClient();
  const { userRole, locale } = useGameStore();
  const isGuest = userRole === "guest";

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const quizSheetRef = useRef<FloatingBottomSheetRef>(null);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const { data: session, isLoading: loading } = useQuery({
    queryKey: ["homeworkSession", sessionId],
    queryFn: () =>
      isGuest
        ? guestDb.getHomeworkSession(sessionId)
        : apiService.getHomeworkSession(sessionId),
  });

  const linkedMatchIds: string[] = session?.linkedMatchIds?.length
    ? session.linkedMatchIds
    : (session as any)?.linkedMatchId
      ? [(session as any).linkedMatchId]
      : [];

  const quizCount = linkedMatchIds.length;

  const openQuizSheet = () => quizSheetRef.current?.present();

  const openChatScreen = () => {
    router.push({
      pathname: "/homework/chat",
      params: {
        sessionId,
        ...(session?.subject ? { subject: session.subject } : {}),
        ...(isGuest ? { guestContext: session?.answersMarkdown || "" } : {}),
      },
    });
  };

  const handleCopySolution = async () => {
    if (!session?.answersMarkdown) return;
    await Clipboard.setStringAsync(
      formatCopyableMarkdown(session.answersMarkdown),
    );
    hapticsService.selection();
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.root}>
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
        <View style={styles.center}>
          <AnimatedLoader size="lg" color={UI_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.root}>
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
        <View style={styles.center}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyHalo}>
              <Ionicons
                name="document-text-outline"
                size={26}
                color={UI_COLORS.textSecondary}
              />
            </View>
            <Text style={styles.emptyText}>{t("session.notFound")}</Text>
            <PillButton
              variant="secondary"
              size="default"
              label={t("common:buttons.back", "Back")}
              onPress={() => router.back()}
              style={styles.backPill}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const subjectKey = (session.subject || "SCIENCE").toUpperCase();
  const theme = getSubjectTheme(subjectKey);
  const subjectLabel = t(`common:subjects.${subjectKey}`, {
    defaultValue: theme.label,
  });

  const photoUri = session.imageBase64
    ? `data:${session.imageMimeType || "image/jpeg"};base64,${session.imageBase64}`
    : null;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
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
            paddingBottom: Math.max(insets.bottom, 12) + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Editorial Title & Metadata */}
          <View style={styles.heroBlock}>
            <View style={styles.metaBadgesRow}>
              <View style={styles.subjectPill}>
                <Text style={styles.subjectPillText}>{subjectLabel}</Text>
              </View>

              {quizCount > 0 ? (
                <View style={styles.quizBadgePill}>
                  <Ionicons name="checkmark" size={12} color="#A78BFA" />
                  <Text style={styles.quizBadgeText}>
                    {t("session.quizDone")}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {session.title || t("session.defaultTitle")}
            </Text>

            {session.topics && session.topics.length > 0 ? (
              <View style={styles.topicsWrap}>
                {session.topics.map((topic: string) => (
                  <View key={topic} style={styles.topicPill}>
                    <Text style={styles.topicText}>{topic}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Tappable Photo Shell */}
          {photoUri ? (
            <TouchableOpacity
              onPress={() => {
                hapticsService.selection();
                setPhotoVisible(true);
              }}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={t("session.viewPhoto")}
              style={styles.photoShell}
            >
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
              <View style={styles.zoomPill}>
                <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                <Text style={styles.zoomPillText}>
                  {t("session.viewPhoto")}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Concentric Solution Card */}
          <View style={styles.solutionCard}>
            <View style={styles.solutionHeaderRow}>
              <View style={styles.solutionTitleRow}>
                <Ionicons name="bulb-outline" size={15} color="#A78BFA" />
                <Text style={styles.solutionLabel}>
                  {t("session.solution")}
                </Text>
              </View>

              {session.answersMarkdown ? (
                <TouchableOpacity
                  onPress={handleCopySolution}
                  activeOpacity={0.75}
                  style={[styles.copyPill, copied && styles.copyPillActive]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={13}
                    color={copied ? UI_COLORS.mint : UI_COLORS.textSecondary}
                  />
                  {copied ? (
                    <Text style={styles.copiedText}>{t("session.copied")}</Text>
                  ) : null}
                </TouchableOpacity>
              ) : null}
            </View>

            {session.answersMarkdown ? (
              <MathMarkdown
                content={session.answersMarkdown}
                style={SOLUTION_MD_STYLE}
              />
            ) : (
              <Text style={styles.noExplanationText}>
                {t("session.noExplanation")}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <HomeworkBottomBar
        quizCount={quizCount}
        onOpenQuizSheet={openQuizSheet}
        onOpenChat={openChatScreen}
        bottomInset={insets.bottom}
      />

      <HomeworkQuizSheet
        ref={quizSheetRef}
        sessionId={sessionId}
        session={session}
        onSessionUpdate={(updatedSession) => {
          queryClient.setQueryData(
            ["homeworkSession", sessionId],
            updatedSession,
          );
        }}
      />

      {/* Fullscreen Zoomable Photo Lightbox */}
      {photoUri ? (
        <Modal
          visible={photoVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPhotoVisible(false)}
        >
          <View style={styles.lightboxBackdrop}>
            <TouchableOpacity
              onPress={() => setPhotoVisible(false)}
              activeOpacity={0.8}
              style={[
                styles.lightboxClose,
                { top: Math.max(insets.top, 16) + 8 },
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.lightboxContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Image
                source={{ uri: photoUri }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </Modal>
      ) : null}
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
    paddingHorizontal: 20,
  },
  emptyCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyHalo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  backPill: {
    marginTop: 6,
    minWidth: 150,
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
  heroBlock: {
    gap: 10,
  },
  metaBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  subjectPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
  },
  subjectPillText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 12,
    color: UI_COLORS.textPrimary,
  },
  quizBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(108, 92, 231, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
  },
  quizBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: "#A78BFA",
  },
  heading: {
    fontSize: 26,
    lineHeight: 33,
    color: UI_COLORS.textPrimary,
    paddingTop: 2,
  },
  topicsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  topicPill: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
  },
  topicText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  photoShell: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    position: "relative",
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: 210,
    borderRadius: 21,
    backgroundColor: UI_COLORS.surfaceSubtle,
  },
  zoomPill: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(13, 11, 20, 0.82)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  zoomPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  solutionCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 18,
    gap: 12,
  },
  solutionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  solutionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  solutionLabel: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11.5,
    color: UI_COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  copyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: UI_COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
  },
  copyPillActive: {
    backgroundColor: "rgba(52, 211, 153, 0.16)",
  },
  copiedText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: UI_COLORS.mint,
  },
  noExplanationText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: UI_COLORS.textMuted,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13, 11, 20, 0.96)",
  },
  lightboxClose: {
    position: "absolute",
    right: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lightboxImage: {
    width: "100%",
    height: "85%",
  },
});
