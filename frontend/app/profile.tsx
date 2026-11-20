import React, { useCallback, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../src/hooks/useOrientation";
import { apiService } from "../src/services/api";
import { useGameStore } from "../src/stores/gameStore";
import { firebaseAuthService } from "../src/services/firebase";
import * as guestDb from "../src/services/guestDb";
import { AnimatedLoader, EmptyState, ScreenHeader } from "../src/components/common";
import { KidProfileView } from "../src/components/children/KidProfileView";
import {
  FloatingBottomSheet,
  FloatingBottomSheetView,
  PillButton,
  type FloatingBottomSheetRef,
} from "../src/components/ui";
import { FONTS, UI_COLORS } from "../src/constants/theme";
import { getHeadingFont } from "../src/utils/fontForLocale";

export default function ProfileScreen() {
  usePortrait();
  const { t } = useTranslation(["leaderboard", "common", "auth", "profile"]);
  const { userRole, parentUser, guestProfile, childSession, logout, locale } =
    useGameStore();
  const queryClient = useQueryClient();
  const isGuest = userRole === "guest";
  const isChild = userRole === "child";
  const uid = isChild
    ? childSession?.parentId
    : parentUser?._id ?? parentUser?.id ?? guestProfile?.guestId ?? null;
  const logoutSheetRef = useRef<FloatingBottomSheetRef>(null);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const { data: rawEntries = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ["leaderboard", uid],
    queryFn: () => apiService.getLeaderboard(),
    enabled: isChild,
  });

  const { data: cachedChildProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["cachedChildProfile", childSession?.childId],
    queryFn: () => guestDb.getChildProfile(childSession!.childId!),
    enabled: isChild && !!childSession?.childId,
  });

  const { data: guestStats, isLoading: guestStatsLoading } = useQuery({
    queryKey: ["guestProfileStats"],
    queryFn: guestDb.getGuestProfileStats,
    enabled: isGuest,
  });

  const isLoading = isChild
    ? leaderboardLoading || profileLoading
    : isGuest
      ? guestStatsLoading
      : false;

  const guestEntry = useMemo(() => {
    if (!isGuest || !guestProfile) return null;
    return {
      playerId: guestProfile.guestId,
      displayName: guestProfile.displayName,
      correctAnswers: guestStats?.correctAnswers ?? 0,
      totalAnswers: guestStats?.totalAnswers ?? 0,
      accuracy: guestStats?.accuracy ?? 0,
      gamesPlayed: guestStats?.gamesPlayed ?? 0,
      avatarUrl: guestProfile.avatarId,
    };
  }, [isGuest, guestProfile, guestStats]);

  const myChildEntry = useMemo(() => {
    if (!isChild || !childSession?.childId) return null;
    const leaderboardEntry = rawEntries.find(
      (e) => e.playerId === childSession.childId,
    );
    if (leaderboardEntry) {
      return {
        ...leaderboardEntry,
        avatarUrl: leaderboardEntry.avatarUrl || cachedChildProfile?.avatarUrl,
        displayName:
          leaderboardEntry.displayName ||
          cachedChildProfile?.displayName ||
          "Kid",
      };
    }
    if (cachedChildProfile) {
      return {
        playerId: childSession.childId,
        displayName: cachedChildProfile.displayName,
        avatarUrl: cachedChildProfile.avatarUrl || undefined,
        correctAnswers: 0,
        totalAnswers: 0,
        accuracy: 0,
        gamesPlayed: 0,
      };
    }
    return null;
  }, [isChild, childSession?.childId, rawEntries, cachedChildProfile]);

  const handleLogout = useCallback(() => {
    logoutSheetRef.current?.present();
  }, []);

  const executeLogout = useCallback(async () => {
    logoutSheetRef.current?.dismiss();
    try {
      await firebaseAuthService.signOut();
    } catch {
      // non-critical
    }
    guestDb.clearAllGuestData().catch(() => {});
    apiService.clearToken();
    logout();
    queryClient.clear();
    router.replace("/");
  }, [logout, queryClient]);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <ScreenHeader title={t("common:profile", "Profile")} />

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {isLoading && isChild && (
            <View style={styles.loaderWrap}>
              <AnimatedLoader
                size="lg"
                message={t("leaderboard:loadingMessage")}
              />
            </View>
          )}

          {isGuest && !isLoading && guestEntry && (
            <KidProfileView entry={guestEntry} onLogout={handleLogout} />
          )}

          {isGuest && isLoading && (
            <View style={styles.loaderWrap}>
              <AnimatedLoader size="lg" />
            </View>
          )}

          {isChild && !isLoading && myChildEntry && (
            <KidProfileView entry={myChildEntry} onLogout={handleLogout} />
          )}

          {isChild && !isLoading && !myChildEntry && (
            <View style={styles.emptyWrap}>
              <EmptyState
                illustration="noRankings"
                title={t("leaderboard:emptyTitle")}
                subtitle={t("leaderboard:emptySubtitleChild")}
              />
              <View style={styles.emptyLogoutWrap}>
                <PillButton
                  label={t("auth:logout.button")}
                  onPress={handleLogout}
                  size="lg"
                  style={styles.logoutConfirmButton}
                />
              </View>
            </View>
          )}

          {!isGuest && !isChild && (
            <EmptyState
              illustration="error"
              title="Parent Profile"
              subtitle="Please use the parent dashboard to manage your account."
            />
          )}
        </View>
      </ScrollView>

      {/* Sign Out Confirmation Bottom Sheet */}
      <FloatingBottomSheet ref={logoutSheetRef} enableDynamicSizing>
        <FloatingBottomSheetView style={styles.sheetContent}>
          <View style={styles.sheetIconBall}>
            <Ionicons
              name="log-out-outline"
              size={26}
              color={UI_COLORS.coral}
            />
          </View>
          <Text style={[styles.sheetTitle, { fontFamily: headingFont }]}>
            {t("auth:logout.title")}
          </Text>
          <Text style={styles.sheetBody}>{t("auth:logout.confirmation")}</Text>

          <View style={styles.sheetActions}>
            <View style={styles.sheetActionSlot}>
              <PillButton
                label={t("common:buttons.cancel")}
                variant="secondary"
                size="lg"
                onPress={() => logoutSheetRef.current?.dismiss()}
              />
            </View>
            <View style={styles.sheetActionSlot}>
              <PillButton
                label={t("auth:logout.button")}
                size="lg"
                onPress={() => {
                  void executeLogout();
                }}
                style={styles.logoutConfirmButton}
              />
            </View>
          </View>
        </FloatingBottomSheetView>
      </FloatingBottomSheet>
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
    paddingTop: 12,
    paddingBottom: 36,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  loaderWrap: {
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyWrap: {
    alignItems: "center",
  },
  emptyLogoutWrap: {
    width: "100%",
    marginTop: 16,
  },
  sheetContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sheetIconBall: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(232, 93, 117, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  sheetBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  sheetActions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  sheetActionSlot: {
    flex: 1,
  },
  logoutConfirmButton: {
    backgroundColor: UI_COLORS.coral,
  },
});
