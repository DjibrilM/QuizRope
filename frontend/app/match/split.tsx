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
import { AppInput } from "../../src/components/ui";
import {
  DifficultySelector,
  IconKids,
  IconTeens,
  IconYoungAdults,
  MatchStartDock,
  PracticeContextField,
  RoundsSelector,
  type DifficultyOption,
} from "../../src/components/match";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

export default function SplitMatchScreen() {
  const { t } = useTranslation(["match", "common"]);
  usePortrait();
  const { showError } = useToast();

  const [creatingMatch, setCreatingMatch] = useState(false);
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [context, setContext] = useState("");
  const [contextError, setContextError] = useState("");

  const { subject } = useLocalSearchParams<{ subject: string }>();
  const { setCurrentMatch, children, childSession, locale, userRole } =
    useGameStore();
  const [player1Id, setPlayer1Id] = useState<string | null>(
    childSession?.childId ?? null,
  );
  const [player2Id, setPlayer2Id] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<"EASY" | "MEDIUM" | "HARD">(
    "MEDIUM",
  );
  const [maxRounds, setMaxRounds] = useState(10);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const ageGroupOptions: DifficultyOption[] = [
    {
      id: "EASY",
      label: t("split.ageGroups.EASY.label"),
      description: t("split.ageGroups.EASY.age"),
      tint: "rgba(16, 185, 129, 0.14)",
      Icon: IconKids,
    },
    {
      id: "MEDIUM",
      label: t("split.ageGroups.MEDIUM.label"),
      description: t("split.ageGroups.MEDIUM.age"),
      tint: "rgba(245, 158, 11, 0.14)",
      Icon: IconTeens,
    },
    {
      id: "HARD",
      label: t("split.ageGroups.HARD.label"),
      description: t("split.ageGroups.HARD.age"),
      tint: "rgba(139, 92, 246, 0.16)",
      Icon: IconYoungAdults,
    },
  ];

  const handleStart = async () => {
    setContextError("");
    try {
      setCreatingMatch(true);
      hapticsService.medium();

      const p1 = player1Name.trim() || t("split.redTeamPlaceholder");
      const p2 = player2Name.trim() || t("split.blueTeamPlaceholder");

      const teams = [
        { name: p1, color: "#EF4444", side: "LEFT" },
        { name: p2, color: "#3B82F6", side: "RIGHT" },
      ];

      let match: any;

      if (userRole === "guest") {
        const { questions } = await apiService.generateGuestMatch({
          subject: subject!,
          difficulty: ageGroup,
          maxRounds,
          context: context.trim() || undefined,
          language: locale,
        });
        const matchId = Crypto.randomUUID();
        const now = Date.now();
        await guestDb.saveMatch({
          _id: matchId,
          subject: subject!,
          difficulty: ageGroup,
          gameMode: "splitscreen",
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
          difficulty: ageGroup,
          gameMode: "splitscreen" as const,
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
          difficulty: ageGroup,
          maxRounds,
          gameMode: "splitscreen",
          context: context.trim() || undefined,
          teams,
          childIds: [player1Id, player2Id].filter(Boolean) as string[],
          language: locale,
        });
        match = {
          ...(created as any),
          id: (created as any)._id || (created as any).id,
          gameMode: "splitscreen" as const,
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

      setCurrentMatch(match);
      router.replace({
        pathname: "/match/game",
        params: {
          matchId: match.id,
          p1Name: p1,
          p2Name: p2,
          ...(player1Id ? { p1Id: player1Id } : {}),
          ...(player2Id ? { p2Id: player2Id } : {}),
        },
      });
    } catch (error: any) {
      console.error("🚨 [SplitMatch Create Error]:", error);
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
                {t("match:split.setupTitle")}
              </Text>
              <Text style={styles.subheading}>{t("split.subtitle")}</Text>
            </View>

            {/* Age Group Pill Selector */}
            <DifficultySelector
              title={t("split.ageGroupLabel")}
              options={ageGroupOptions}
              selected={ageGroup}
              onSelect={(id) =>
                setAgeGroup(id as "EASY" | "MEDIUM" | "HARD")
              }
            />

            <RoundsSelector selected={maxRounds} onSelect={setMaxRounds} />

            {/* Two-player names & optional child assignment */}
            <View style={styles.playersSection}>
              <Text style={styles.sectionLabel}>
                {t("split.playersLabel")}
              </Text>

              <View style={styles.playersGrid}>
                {[
                  {
                    key: "p1",
                    name: player1Name,
                    setName: setPlayer1Name,
                    selectedId: player1Id,
                    setSelectedId: setPlayer1Id,
                    otherId: player2Id,
                    placeholder: t("split.redTeamPlaceholder"),
                    returnKeyType: "next" as const,
                    dotColor: "#EF4444",
                    activeBorderColor: "rgba(239, 68, 68, 0.55)",
                    activeChipStyle: styles.childChipRed,
                  },
                  {
                    key: "p2",
                    name: player2Name,
                    setName: setPlayer2Name,
                    selectedId: player2Id,
                    setSelectedId: setPlayer2Id,
                    otherId: player1Id,
                    placeholder: t("split.blueTeamPlaceholder"),
                    returnKeyType: "done" as const,
                    dotColor: "#3B82F6",
                    activeBorderColor: "rgba(59, 130, 246, 0.55)",
                    activeChipStyle: styles.childChipBlue,
                  },
                ].map((player) => (
                  <View key={player.key} style={styles.playerCol}>
                    <AppInput
                      value={player.name}
                      onChangeText={(v) => {
                        player.setName(v);
                        player.setSelectedId(null);
                      }}
                      placeholder={player.placeholder}
                      maxLength={20}
                      returnKeyType={player.returnKeyType}
                      leftIcon={
                        <View
                          style={[
                            styles.teamDot,
                            { backgroundColor: player.dotColor },
                          ]}
                        />
                      }
                      shellStyle={
                        player.selectedId
                          ? { borderColor: player.activeBorderColor }
                          : undefined
                      }
                    />

                    {children.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.childScroll}
                        contentContainerStyle={styles.childChipsRow}
                      >
                        {children.map((c) => {
                          const cId = c.id || (c as any)._id;
                          const active = player.selectedId === cId;
                          const takenByOther = player.otherId === cId;
                          return (
                            <Pressable
                              key={cId}
                              disabled={takenByOther}
                              onPress={() => {
                                hapticsService.selection();
                                if (active) {
                                  player.setName("");
                                  player.setSelectedId(null);
                                } else {
                                  player.setName(c.displayName);
                                  player.setSelectedId(cId);
                                }
                              }}
                              style={[
                                styles.childChip,
                                active && player.activeChipStyle,
                                takenByOther && styles.childChipDisabled,
                              ]}
                            >
                              <AvatarIcon avatarId={c.avatarUrl} size={18} />
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
                      </ScrollView>
                    )}
                  </View>
                ))}
              </View>
            </View>

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
          label={t("split.startBattle")}
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
  playersSection: {
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
  playersGrid: {
    gap: 10,
  },
  playerCol: {
    width: "100%",
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  childScroll: {
    marginTop: 8,
  },
  childChipsRow: {
    gap: 6,
    paddingHorizontal: 2,
  },
  childChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 5,
    paddingRight: 11,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  childChipRed: {
    backgroundColor: "rgba(239, 68, 68, 0.22)",
    borderColor: "#EF4444",
  },
  childChipBlue: {
    backgroundColor: "rgba(59, 130, 246, 0.22)",
    borderColor: "#3B82F6",
  },
  childChipDisabled: {
    opacity: 0.3,
  },
  childChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
    maxWidth: 120,
  },
  childChipTextActive: {
    color: "#FFFFFF",
  },
});
