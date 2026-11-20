import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiService } from "../../services/api";
import { useGameStore } from "../../stores/gameStore";
import { useToast } from "../../context/ToastContext";
import { hapticsService } from "../../services/haptics";
import {
  getFallbackParentAvatarId,
  PARENT_AVATARS,
} from "../../config/avatars";
import { AvatarIcon } from "../common/AvatarIcons";
import { AvatarPicker } from "./AvatarPicker";
import { ChildCard } from "./ChildCard";
import {
  FloatingBottomSheet,
  FloatingBottomSheetScrollView,
  PillButton,
  type FloatingBottomSheetRef,
} from "../ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";

export function ParentProfileView({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation(["common", "children", "home", "auth"]);
  const { parentUser, children, updateParentUser, setChildren, locale } =
    useGameStore();
  const { showApiError } = useToast();
  const avatarSheetRef = useRef<FloatingBottomSheetRef>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const parentId = parentUser?.id || parentUser?._id || "";
  const fallbackAvatar = getFallbackParentAvatarId(
    parentUser?.email || parentId || "parent",
  );
  const activeAvatar = parentUser?.avatarUrl || fallbackAvatar;
  const googlePhotoUrl = parentUser?.googlePhotoUrl;

  const { data: fetchedChildren } = useQuery({
    queryKey: ["children", parentId],
    queryFn: async () => {
      const data = await apiService.getChildren();
      const mapped = Array.isArray(data)
        ? data.filter(Boolean).map((c: any) => ({ ...c, id: c._id || c.id }))
        : [];
      setChildren(mapped);
      return mapped;
    },
    enabled: !!parentId,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["parentMatchesCount", parentId],
    queryFn: () => apiService.getMatches(),
    enabled: !!parentId,
  });

  const { data: homeworkSessions = [] } = useQuery({
    queryKey: ["parentHomeworkCount", parentId],
    queryFn: () => apiService.getHomeworkSessions(),
    enabled: !!parentId,
  });

  const kidsList = fetchedChildren ?? children ?? [];
  const displayName =
    parentUser?.displayName ||
    parentUser?.email?.split("@")[0] ||
    t("common:parentProfile.title");

  const handleOpenAvatarPicker = useCallback(() => {
    hapticsService.selection();
    avatarSheetRef.current?.present();
  }, []);

  const handleSelectAvatar = useCallback(
    async (nextAvatarId: string) => {
      if (savingAvatar) return;
      const previousAvatar = parentUser?.avatarUrl;
      updateParentUser({ avatarUrl: nextAvatarId });
      setSavingAvatar(true);
      try {
        const updated = await apiService.updateParentProfile({
          avatarUrl: nextAvatarId,
        });
        updateParentUser(updated);
        hapticsService.success();
        avatarSheetRef.current?.dismiss();
      } catch (err) {
        updateParentUser({ avatarUrl: previousAvatar });
        showApiError(err);
      } finally {
        setSavingAvatar(false);
      }
    },
    [parentUser?.avatarUrl, savingAvatar, showApiError, updateParentUser],
  );

  return (
    <View style={styles.root}>
      {/* Hero Avatar & Account Info */}
      <View style={styles.headerBlock}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenAvatarPicker}
          accessibilityRole="button"
          accessibilityLabel={t("common:parentProfile.tapAvatarHint")}
          style={styles.avatarTouchable}
        >
          <View style={styles.avatarRing}>
            <AvatarIcon
              avatarId={activeAvatar}
              fallbackAvatarId={fallbackAvatar}
              size={96}
            />
          </View>
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        <Text
          style={[styles.displayName, { fontFamily: headingFont }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>

        {parentUser?.email ? (
          <Text style={styles.emailText} numberOfLines={1}>
            {parentUser.email}
          </Text>
        ) : null}
      </View>

      {/* Family Overview Concentric Stats Module */}
      <Text style={styles.sectionLabel}>
        {t("common:parentProfile.familyOverview")}
      </Text>
      <View style={styles.statsShell}>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text
              style={[
                styles.statValue,
                { fontFamily: headingFont, color: UI_COLORS.mint },
              ]}
              numberOfLines={1}
            >
              {kidsList.length}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t("common:parentProfile.kids")}
            </Text>
          </View>

          <View style={styles.statTile}>
            <Text
              style={[styles.statValue, { fontFamily: headingFont }]}
              numberOfLines={1}
            >
              {Array.isArray(matches) ? matches.length : 0}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t("common:parentProfile.quizzes")}
            </Text>
          </View>

          <View style={styles.statTile}>
            <Text
              style={[
                styles.statValue,
                { fontFamily: headingFont, color: "#A78BFA" },
              ]}
              numberOfLines={1}
            >
              {Array.isArray(homeworkSessions) ? homeworkSessions.length : 0}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t("common:parentProfile.homework")}
            </Text>
          </View>
        </View>
      </View>

      {/* Kids Summary (links & full management live on My Children) */}
      <Text style={styles.sectionLabel}>{t("children:title")}</Text>
      <View style={styles.listShell}>
        {kidsList.length === 0 ? (
          <TouchableOpacity
            onPress={() => {
              hapticsService.selection();
              router.push("/child" as any);
            }}
            activeOpacity={0.8}
            style={styles.kidRow}
          >
            <View style={styles.emptyIconWell}>
              <Ionicons name="people-outline" size={18} color="#A78BFA" />
            </View>
            <View style={styles.kidTextCol}>
              <Text style={styles.kidName}>
                {t("common:parentProfile.noKidsYet")}
              </Text>
              <Text style={styles.kidMeta}>
                {t("common:parentProfile.manageKids")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={UI_COLORS.textMuted}
            />
          </TouchableOpacity>
        ) : (
          <>
            {kidsList.map((child) => (
              <ChildCard
                key={child.id}
                displayName={child.displayName}
                grade={child.grade}
                avatarUrl={child.avatarUrl}
                isLinked={Boolean(child.isLinked)}
                onPress={() => {
                  router.push("/child" as any);
                }}
              />
            ))}

            <TouchableOpacity
              onPress={() => {
                hapticsService.selection();
                router.push("/child" as any);
              }}
              activeOpacity={0.8}
              style={styles.manageRow}
            >
              <Text style={styles.manageRowText}>
                {t("common:parentProfile.manageKids")}
              </Text>
              <Ionicons name="arrow-forward" size={15} color="#A78BFA" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Sign Out CTA */}
      <PillButton
        label={t("auth:logout.button", "Log out")}
        variant="primary"
        onPress={onLogout}
        size="lg"
        icon={<Ionicons name="log-out-outline" size={18} color="#FFFFFF" />}
        style={styles.logoutButton}
      />

      {/* Avatar Picker Sheet */}
      <FloatingBottomSheet
        ref={avatarSheetRef}
        snapPoints={["62%"]}
        enableDynamicSizing={false}
      >
        <FloatingBottomSheetScrollView contentContainerStyle={styles.sheetScroll}>
          <Text style={[styles.sheetHeading, { fontFamily: headingFont }]}>
            {t("children:chooseAvatar")}
          </Text>

          {googlePhotoUrl ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => handleSelectAvatar(googlePhotoUrl)}
              style={[
                styles.googlePhotoPill,
                activeAvatar === googlePhotoUrl && styles.googlePhotoPillActive,
              ]}
            >
              <AvatarIcon
                avatarId={googlePhotoUrl}
                fallbackAvatarId={fallbackAvatar}
                size={36}
              />
              <Text style={styles.googlePhotoText}>
                {t("common:parentProfile.useGooglePhoto")}
              </Text>
              {activeAvatar === googlePhotoUrl ? (
                <Ionicons name="checkmark-circle" size={18} color="#A78BFA" />
              ) : null}
            </TouchableOpacity>
          ) : null}

          <AvatarPicker
            selected={activeAvatar}
            onSelect={handleSelectAvatar}
            avatars={PARENT_AVATARS}
            showTitle={false}
            tileSize={64}
          />
        </FloatingBottomSheetScrollView>
      </FloatingBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  headerBlock: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  avatarTouchable: {
    position: "relative",
    marginBottom: 14,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(108, 92, 231, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: UI_COLORS.primary,
    borderWidth: 2.5,
    borderColor: UI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  displayName: {
    fontSize: 28,
    lineHeight: 34,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  emailText: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: UI_COLORS.textSecondary,
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
  statsShell: {
    backgroundColor: "#161221",
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 6,
  },
  statTile: {
    flex: 1,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 23,
    borderCurve: "continuous",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    color: UI_COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11.5,
    color: UI_COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listShell: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    gap: 6,
    marginBottom: 26,
  },
  kidRow: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 23,
    borderCurve: "continuous",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyIconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(108, 92, 231, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  kidTextCol: {
    flex: 1,
    gap: 2,
  },
  kidName: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  kidMeta: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: UI_COLORS.textSecondary,
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 20,
  },
  manageRowText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    color: "#A78BFA",
  },
  logoutButton: {
    backgroundColor: "#EF4444",
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 28,
  },
  sheetHeading: {
    fontSize: 22,
    lineHeight: 28,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  googlePhotoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 16,
    marginBottom: 16,
  },
  googlePhotoPillActive: {
    borderColor: UI_COLORS.primary,
    backgroundColor: "rgba(108, 92, 231, 0.14)",
  },
  googlePhotoText: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: UI_COLORS.textPrimary,
  },
});
