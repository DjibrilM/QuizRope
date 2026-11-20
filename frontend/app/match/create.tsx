import React, { useEffect, useState } from "react";
import {
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
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { GameMode } from "@shared/types/match.types";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import { SubjectCard } from "../../src/components/match";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

const SUBJECTS = ["MATH", "SCIENCE", "ENGLISH", "HISTORY", "GEOGRAPHY"];
const SEGMENT_PAD = 4;
const SEGMENT_GAP = 4;

export default function CreateMatchScreen() {
  usePortrait();
  const { t } = useTranslation(["match", "common"]);
  const locale = useGameStore((s) => s.locale);
  const [gameMode, setGameMode] = useState<GameMode>("solo");
  const [shellWidth, setShellWidth] = useState(0);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  // Animated sliding segmented pill position: 0 = solo, 1 = splitscreen
  const tabProgress = useSharedValue(0);

  useEffect(() => {
    tabProgress.value = withTiming(gameMode === "solo" ? 0 : 1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [gameMode, tabProgress]);

  const slotWidth =
    shellWidth > 0 ? (shellWidth - SEGMENT_PAD * 2 - SEGMENT_GAP) / 2 : 0;

  const sliderAnimatedStyle = useAnimatedStyle(() => ({
    width: slotWidth,
    transform: [
      { translateX: tabProgress.value * (slotWidth + SEGMENT_GAP) },
    ],
  }));

  const soloLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      tabProgress.value,
      [0, 1],
      ["#FFFFFF", UI_COLORS.textSecondary],
    ),
  }));

  const splitLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      tabProgress.value,
      [0, 1],
      [UI_COLORS.textSecondary, "#FFFFFF"],
    ),
  }));

  const handleSubjectPress = (subject: string) => {
    hapticsService.medium();
    if (gameMode === "solo") {
      router.push({ pathname: "/match/solo", params: { subject } });
    } else {
      router.push({ pathname: "/match/split" as any, params: { subject } });
    }
  };

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
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: contentTop },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.mainColumn}>
          {/* Editorial Title & Subtitle matching design system */}
          <View style={styles.heroSection}>
            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {t("match:create.title")}
            </Text>
            <Text style={styles.subheading}>{t("match:create.subtitle")}</Text>
          </View>

          {/* Animated Segmented Game Mode Selector */}
          <View style={styles.modeSection}>
            <Text style={styles.sectionLabel}>
              {t("match:create.modeLabel")}
            </Text>
            <View
              style={styles.segmentedShell}
              onLayout={(e) => setShellWidth(e.nativeEvent.layout.width)}
            >
              {slotWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.slidingPill, sliderAnimatedStyle]}
                />
              ) : null}

              <TouchableOpacity
                onPress={() => {
                  if (gameMode !== "solo") {
                    hapticsService.selection();
                    setGameMode("solo");
                  }
                }}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: gameMode === "solo" }}
                style={styles.segmentButton}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={
                    gameMode === "solo" ? "#FFFFFF" : UI_COLORS.textSecondary
                  }
                />
                <Animated.Text
                  style={[
                    styles.segmentLabel,
                    gameMode === "solo" && styles.segmentLabelBold,
                    soloLabelStyle,
                  ]}
                  numberOfLines={1}
                >
                  {t("match:create.solo")}
                </Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (gameMode !== "splitscreen") {
                    hapticsService.selection();
                    setGameMode("splitscreen");
                  }
                }}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: gameMode === "splitscreen" }}
                style={styles.segmentButton}
              >
                <Ionicons
                  name="people-outline"
                  size={17}
                  color={
                    gameMode === "splitscreen"
                      ? "#FFFFFF"
                      : UI_COLORS.textSecondary
                  }
                />
                <Animated.Text
                  style={[
                    styles.segmentLabel,
                    gameMode === "splitscreen" && styles.segmentLabelBold,
                    splitLabelStyle,
                  ]}
                  numberOfLines={1}
                >
                  {t("match:create.splitScreen")}
                </Animated.Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Full-Pill Subject Stack */}
          <View style={styles.subjectSection}>
            <Text style={styles.sectionLabel}>
              {t("match:selectors.subject", "Subject")}
            </Text>
            <View style={styles.subjectList}>
              {SUBJECTS.map((subject) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  selected={false}
                  onPress={handleSubjectPress}
                />
              ))}
            </View>
          </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  heroSection: {
    marginBottom: 22,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 0.4,
    paddingTop: 2,
    color: UI_COLORS.textPrimary,
  },
  subheading: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  modeSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  segmentedShell: {
    flexDirection: "row",
    position: "relative",
    backgroundColor: "#161221",
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: SEGMENT_PAD,
    gap: SEGMENT_GAP,
  },
  slidingPill: {
    position: "absolute",
    top: SEGMENT_PAD,
    left: SEGMENT_PAD,
    height: 44,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.primary,
  },
  segmentButton: {
    flex: 1,
    height: 44,
    borderRadius: UI_RADII.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  segmentLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },
  segmentLabelBold: {
    fontFamily: FONTS.bodyBlack,
  },
  subjectSection: {
    width: "100%",
  },
  subjectList: {
    gap: 10,
  },
});
