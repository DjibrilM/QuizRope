import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../src/hooks/useOrientation";
import { apiService } from "../src/services/api";
import { useGameStore } from "../src/stores/gameStore";
import * as guestDb from "../src/services/guestDb";
import {
  AnimatedLoader,
  EmptyState,
  LogoutConfirmSheet,
  ScreenHeader,
  useAccountLogout,
} from "../src/components/common";
import { KidProfileView } from "../src/components/children/KidProfileView";
import { PillButton } from "../src/components/ui";
import { UI_COLORS } from "../src/constants/theme";

export default function KidProfileScreen() {
  usePortrait();
  const { t } = useTranslation(["leaderboard", "common", "auth"]);
  const { userRole, guestProfile, childSession } = useGameStore();
  const isGuest = userRole === "guest";
  const isChild = userRole === "child";
  const uid = isChild
    ? childSession?.parentId ?? null
    : guestProfile?.guestId ?? null;

  const { logoutSheetRef, openLogoutConfirm, executeLogout } =
    useAccountLogout();

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

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <ScreenHeader title={t("leaderboard:yourProfile")} />

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {isLoading ? (
            <View style={styles.loaderWrap}>
              <AnimatedLoader
                size="lg"
                message={isChild ? t("leaderboard:loadingMessage") : undefined}
              />
            </View>
          ) : null}

          {isGuest && !isLoading && guestEntry ? (
            <KidProfileView entry={guestEntry} onLogout={openLogoutConfirm} />
          ) : null}

          {isChild && !isLoading && myChildEntry ? (
            <KidProfileView entry={myChildEntry} onLogout={openLogoutConfirm} />
          ) : null}

          {isChild && !isLoading && !myChildEntry ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                illustration="noRankings"
                title={t("leaderboard:emptyTitle")}
                subtitle={t("leaderboard:emptySubtitleChild")}
              />
              <View style={styles.emptyLogoutWrap}>
                <PillButton
                  label={t("auth:logout.button")}
                  onPress={openLogoutConfirm}
                  size="lg"
                  style={styles.logoutConfirmButton}
                />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <LogoutConfirmSheet sheetRef={logoutSheetRef} onConfirm={executeLogout} />
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
  logoutConfirmButton: {
    backgroundColor: UI_COLORS.coral,
  },
});
