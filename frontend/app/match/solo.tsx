import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";
import { MatchStatus } from "@shared/types/match.types";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { useToast } from "../../src/context/ToastContext";
import { AvatarIcon } from "../../src/components/common/AvatarIcons";
import {
  DifficultySelector,
  MatchStartDock,
  PracticeContextField,
  RoundsSelector,
} from "../../src/components/match";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

export default function SoloMatchScreen() {
  usePortrait();
  const { showError } = useToast();
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [context, setContext] = useState("");
  const [contextError, setContextError] = useState("");
  const { t } = useTranslation(["match", "common"]);
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const { setCurrentMatch, children, childSession, locale, userRole } =
    useGameStore();
  const [difficulty, setDifficulty] = useState("EASY");
  const [maxRounds, setMaxRounds] = useState(10);
  // Pre-select the child if playing from their own device
  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    childSession?.childId ?? null,
  );

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const handleStart = async () => {
    setContextError("");
    try {
      setCreatingMatch(true);
      hapticsService.medium();

      const teams = [
        { name: t("common:teams.redTeam"), color: "#EF4444", side: "LEFT" },
        { name: t("common:teams.blueTeam"), color: "#3B82F6", side: "RIGHT" },
      ];

      let match: any;

      if (userRole === "guest") {
        const { questions } = await apiService.generateGuestMatch({
          subject: subject!,
          difficulty,
          maxRounds,
          context: context.trim() || undefined,
          language: locale,
        });
        const matchId = Crypto.randomUUID();
        const now = Date.now();
        await guestDb.saveMatch({
          _id: matchId,
          subject: subject!,
          difficulty,
          gameMode: "solo",
          maxRounds,
          status: "IN_PROGRESS",
          roundsPlayed: 0,
          createdAt: now,
          context: context.trim() || undefined,
          language: locale,
          scoreLeft: 0,
          scoreRight: 0,
        });

        await guestDb.saveQuestions(
          matchId,
          questions.map((q, i) => ({ ...q, id: `${matchId}-q${i}` })),
        );
        match = {
          _id: matchId,
          id: matchId,
          subject: subject!,
          difficulty,
          gameMode: "solo" as const,
          maxRounds,
          questions: questions.map((q, i) => ({
            ...q,
            id: `${matchId}-q${i}`,
          })),
          teams: teams.map((t, i) => ({ id: `team-${i}`, ...t, players: [] })),
          ropePosition: 0,
          currentQuestionIndex: 0,
          status: MatchStatus.IN_PROGRESS,
          rounds: 0,
          createdAt: new Date(now),
        };
      } else {
        const created = await apiService.createMatch({
          subject: subject!,
          difficulty,
          maxRounds,
          gameMode: "solo",
          context: context.trim() || undefined,
          teams,
          childIds: selectedChildId ? [selectedChildId] : [],
          language: locale,
        });
        match = {
          ...(created as any),
          id: (created as any)._id || (created as any).id,
          gameMode: "solo" as const,
          teams: ((created as any).teams || teams).map((t: any, i: number) => ({
            id: t._id || t.id || `team-${i}`,
            name: t.name,
            color: t.color,
            side: t.side,
            players: t.players || [],
          })),
          ropePosition: (created as any).ropePosition || 0,
          currentQuestionIndex: (created as any).currentQuestionIndex || 0,
          status: MatchStatus.IN_PROGRESS,
          rounds: (created as any).rounds || 0,
          maxRounds,
          createdAt: (created as any).createdAt || new Date(),
        };
      }

      // Solo mode runs entirely offline — no socket needed.
      // Connecting the socket causes startTimer in game.tsx to bail out early.
      setCurrentMatch(match);
      router.replace({
        pathname: "/match/game",
        params: {
          matchId: match.id,
          ...(selectedChildId ? { p1Id: selectedChildId } : {}),
        },
      });
    } catch (error: any) {
      console.error("🚨 [SoloMatch Create Error]:", error);
      setCreatingMatch(false);
      if (error?.message === "CONTEXT_NOT_RELATED") {
        setContextError(t("match:solo.contextNotRelated"));
      } else {
        showError(
          t("common:errors.somethingWentWrong"),
          error?.message || t("match:create.createFailed"),
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={[]}>
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: contentTop },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainColumn}>
            {/* Editorial Title & Subtitle */}
            <View style={styles.heroSection}>
              <Text style={[styles.heading, { fontFamily: headingFont }]}>
                {t("match:solo.setupTitle")}
              </Text>
              <Text style={styles.subheading}>
                {t("match:solo.setupSubtitle")}
              </Text>
            </View>

            <DifficultySelector
              selected={difficulty}
              onSelect={setDifficulty}
            />

            <RoundsSelector selected={maxRounds} onSelect={setMaxRounds} />

            {/* Optional Child Picker */}
            {children.length > 0 && (
              <View style={styles.childSection}>
                <Text style={styles.sectionLabel}>
                  {t("match:solo.playingAs")}
                </Text>
                <View style={styles.childChipsRow}>
                  {children.map((c) => {
                    const cId = c.id || (c as any)._id;
                    const active = selectedChildId === cId;
                    return (
                      <Pressable
                        key={cId}
                        onPress={() => {
                          hapticsService.selection();
                          setSelectedChildId(active ? null : cId);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.childChip,
                          active
                            ? styles.childChipActive
                            : styles.childChipDefault,
                        ]}
                      >
                        <AvatarIcon avatarId={c.avatarUrl} size={22} />
                        <Text
                          style={[
                            styles.childChipText,
                            active && styles.childChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {c.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <PracticeContextField
              label={t("match:solo.contextLabel")}
              value={context}
              onChangeText={(v) => {
                setContext(v);
                if (contextError) setContextError("");
              }}
              placeholder={t("match:solo.contextPlaceholder")}
              hint={t("match:solo.contextHint")}
              error={contextError}
            />
          </View>
        </ScrollView>

        <MatchStartDock
          label={t("match:solo.startButton")}
          loading={creatingMatch}
          onPress={handleStart}
        />
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  childSection: {
    width: "100%",
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
  childChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  childChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
  },
  childChipDefault: {
    backgroundColor: "#1A1520",
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  childChipActive: {
    backgroundColor: UI_COLORS.primary,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  childChipText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: UI_COLORS.textSecondary,
    maxWidth: 140,
  },
  childChipTextActive: {
    color: "#FFFFFF",
  },
});
