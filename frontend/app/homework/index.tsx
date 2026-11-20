import React, { useState } from "react";
import {
  RefreshControl,
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
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { HomeworkSession } from "@shared/types/homework.types";
import type { Child } from "@shared/types/user.types";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useHomeworkLimit } from "../../src/hooks/useHomeworkLimit";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { useGameStore } from "../../src/stores/gameStore";
import {
  AnimatedLoader,
  AvatarIcon,
  BouncePress,
} from "../../src/components/common";
import { PillButton } from "../../src/components/ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getSubjectTheme } from "../../src/config/subjectThemes";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { hapticsService } from "../../src/services/haptics";

function StatusBadge({ status }: { status: HomeworkSession["status"] }) {
  const { t } = useTranslation("homework");

  if (status === "READY") {
    return (
      <View style={[styles.statusPill, styles.statusReadyBg]}>
        <Ionicons name="checkmark-circle" size={12} color={UI_COLORS.mint} />
        <Text style={[styles.statusText, { color: UI_COLORS.mint }]}>
          {t("status.ready")}
        </Text>
      </View>
    );
  }

  if (status === "PROCESSING") {
    return (
      <View style={[styles.statusPill, styles.statusProcessingBg]}>
        <AnimatedLoader size="sm" color={UI_COLORS.amber} />
        <Text style={[styles.statusText, { color: UI_COLORS.amber }]}>
          {t("status.analyzing")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.statusPill, styles.statusFailedBg]}>
      <Ionicons name="close-circle" size={12} color="#EF4444" />
      <Text style={[styles.statusText, { color: "#EF4444" }]}>
        {t("status.failed")}
      </Text>
    </View>
  );
}

function NewScanCard({ childId }: { childId: string | null }) {
  const { t } = useTranslation("homework");
  const locale = useGameStore((s) => s.locale);
  const { remaining, limit, loading } = useHomeworkLimit();

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const subtitle = loading
    ? t("actions.scanNewDesc")
    : __DEV__
      ? t("actions.unlimitedScans")
      : t("actions.scansRemaining", { remaining, limit });

  return (
    <View style={styles.featuredShell}>
      <BouncePress
        onPress={() => {
          hapticsService.medium();
          router.push({
            pathname: "/homework/capture" as any,
            params: childId ? { childId } : {},
          });
        }}
        accessibilityRole="button"
        style={styles.featuredPill}
      >
        <View style={styles.featuredIconBall}>
          <Ionicons name="camera" size={24} color="#FFFFFF" />
        </View>

        <View style={styles.featuredTextCol}>
          <Text
            style={[styles.featuredTitle, { fontFamily: headingFont }]}
            numberOfLines={1}
          >
            {t("actions.scanNew")}
          </Text>
          <Text style={styles.featuredSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.featuredChevronWell}>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </View>
      </BouncePress>
    </View>
  );
}

function ChildFilterChips({
  items,
  selected,
  onSelect,
}: {
  items: Child[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useTranslation("homework");
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterRow}
    >
      <TouchableOpacity
        onPress={() => {
          hapticsService.selection();
          onSelect(null);
        }}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: selected === null }}
        style={[
          styles.filterChip,
          selected === null ? styles.filterChipActive : styles.filterChipDefault,
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            selected === null && styles.filterChipTextActive,
          ]}
        >
          {t("filters.all")}
        </Text>
      </TouchableOpacity>

      {items.map((child) => {
        const childId = child.id || (child as any)._id?.toString();
        const isSelected = !!childId && selected === childId;
        return (
          <TouchableOpacity
            key={childId || child.displayName}
            onPress={() => {
              hapticsService.selection();
              onSelect(isSelected ? null : (childId ?? null));
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.filterChip,
              isSelected ? styles.filterChipActive : styles.filterChipDefault,
            ]}
          >
            <AvatarIcon avatarId={child.avatarUrl} size={20} />
            <Text
              style={[
                styles.filterChipText,
                isSelected && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {child.displayName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SessionCard({
  session,
  onPress,
}: {
  session: HomeworkSession;
  onPress: () => void;
}) {
  const { t } = useTranslation(["homework", "common"]);
  const locale = useGameStore((s) => s.locale);
  const subjectKey = (session.subject || "SCIENCE").toUpperCase();
  const theme = getSubjectTheme(subjectKey);
  const subjectLabel = t(`common:subjects.${subjectKey}`, {
    defaultValue: theme.label,
  });

  const date = new Date(session.createdAt).toLocaleDateString(
    locale || undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <BouncePress
      onPress={() => {
        hapticsService.selection();
        onPress();
      }}
      accessibilityRole="button"
      style={styles.sessionCard}
    >
      {/* Top Meta Row */}
      <View style={styles.sessionTopRow}>
        <View style={styles.subjectPill}>
          <Text style={styles.subjectPillText} numberOfLines={1}>
            {subjectLabel}
          </Text>
        </View>

        <View style={styles.badgesGroup}>
          {session.quizTaken ? (
            <View style={styles.quizDonePill}>
              <Ionicons name="checkmark" size={11} color="#A78BFA" />
              <Text style={styles.quizDoneText}>{t("session.quizDone")}</Text>
            </View>
          ) : null}
          <StatusBadge status={session.status} />
        </View>
      </View>

      {/* Session Title */}
      <Text style={styles.sessionTitle} numberOfLines={2}>
        {session.title || t("session.defaultTitle")}
      </Text>

      {/* Topics Pills */}
      {session.topics && session.topics.length > 0 ? (
        <View style={styles.topicsWrap}>
          {session.topics.slice(0, 3).map((topic) => (
            <View key={topic} style={styles.topicPill}>
              <Text style={styles.topicText} numberOfLines={1}>
                {topic}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer Row */}
      <View style={styles.sessionFooter}>
        <Text style={styles.sessionDate}>{date}</Text>
        <Ionicons
          name="chevron-forward"
          size={15}
          color={UI_COLORS.textMuted}
        />
      </View>
    </BouncePress>
  );
}

export default function HomeworkIndexScreen() {
  usePortrait();
  const { t } = useTranslation("homework");
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const { userRole, parentUser, guestProfile, locale } = useGameStore();
  const isGuest = userRole === "guest";
  const uid = parentUser?._id ?? parentUser?.id ?? guestProfile?.guestId ?? null;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<HomeworkSession[]>({
    queryKey: ["homeworkSessions", uid],
    queryFn: async () => {
      const local = await guestDb.getHomeworkSessions();
      if (isGuest) return local as unknown as HomeworkSession[];

      try {
        const remote = await apiService.getHomeworkSessions();
        guestDb
          .syncFromBackend({ matches: [], homeworkSessions: remote })
          .catch(console.error);
        return remote;
      } catch (err) {
        if (local.length > 0) return local as unknown as HomeworkSession[];
        throw err;
      }
    },
  });

  const { data: children = [] } = useQuery<Child[]>({
    queryKey: ["children", uid],
    queryFn: () => apiService.getChildren(),
    staleTime: 60_000,
    enabled: !isGuest && userRole !== "child",
  });

  const filteredSessions =
    selectedChildId === null
      ? sessions
      : sessions.filter((s) => s.childId === selectedChildId);

  const selectedChildName =
    children.find(
      (c) => (c.id || (c as any)._id?.toString()) === selectedChildId,
    )?.displayName ?? "";

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
            paddingBottom: Math.max(insets.bottom, 20) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#A78BFA"
          />
        }
      >
        <View style={styles.mainColumn}>
          {/* Editorial Header */}
          <View style={styles.heroSection}>
            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {t("title")}
            </Text>
            <Text style={styles.subheading}>{t("subtitle")}</Text>
          </View>

          {/* Featured Concentric Scan Action */}
          <NewScanCard childId={selectedChildId} />

          {/* Optional Child Filter Chips */}
          <ChildFilterChips
            items={children}
            selected={selectedChildId}
            onSelect={setSelectedChildId}
          />

          {/* History Section Header */}
          <Text style={styles.sectionLabel}>
            {selectedChildId
              ? t("history.childSessions", { name: selectedChildName })
              : t("history.recent")}
          </Text>

          {isLoading ? (
            <View style={styles.stateCard}>
              <AnimatedLoader size="lg" />
            </View>
          ) : isError ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconHalo}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color="#EF4444"
                />
              </View>
              <Text style={styles.stateTitle}>{t("errors.loadFailed")}</Text>
              <Text style={styles.stateSub}>{t("errors.pullToRetry")}</Text>
              <PillButton
                variant="secondary"
                size="default"
                label={t("common:buttons.tryAgain", "Try Again")}
                onPress={() => refetch()}
                style={styles.retryBtn}
              />
            </View>
          ) : filteredSessions.length === 0 ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconHalo}>
                <Ionicons
                  name="book-outline"
                  size={26}
                  color={UI_COLORS.textSecondary}
                />
              </View>
              <Text style={styles.stateTitle}>
                {selectedChildId
                  ? t("empty.noSessionsForChild")
                  : t("empty.noHomeworkYet")}
              </Text>
              <Text style={styles.stateSub}>
                {selectedChildId
                  ? t("empty.assignToChild")
                  : t("empty.getStarted")}
              </Text>
            </View>
          ) : (
            <View style={styles.sessionsList}>
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  onPress={() => {
                    if (session.status === "READY") {
                      router.push(`/homework/session/${session._id}` as any);
                    } else if (session.status === "PROCESSING") {
                      router.push({
                        pathname: "/homework/processing" as any,
                        params: { sessionId: session._id },
                      });
                    }
                  }}
                />
              ))}
            </View>
          )}
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  heroSection: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    color: UI_COLORS.textPrimary,
    paddingTop: 2,
  },
  subheading: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  featuredShell: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    marginBottom: 22,
  },
  featuredPill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI_COLORS.primary,
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    gap: 12,
  },
  featuredIconBall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#5746CE",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredTextCol: {
    flex: 1,
    gap: 1,
  },
  featuredTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: "#FFFFFF",
  },
  featuredSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    lineHeight: 16,
    color: UI_COLORS.textSubtleOnPrimary,
  },
  featuredChevronWell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 18,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
  },
  filterChipDefault: {
    backgroundColor: UI_COLORS.surface,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: UI_COLORS.primary,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  filterChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: UI_COLORS.textSecondary,
  },
  filterChipTextActive: {
    fontFamily: FONTS.bodyBold,
    color: "#FFFFFF",
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
  sessionsList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 16,
    gap: 10,
  },
  sessionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  subjectPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI_COLORS.surfaceSubtle,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: UI_RADII.pill,
    flexShrink: 1,
  },
  subjectPillText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11.5,
    color: UI_COLORS.textPrimary,
  },
  badgesGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quizDonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(108, 92, 231, 0.16)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
  },
  quizDoneText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: "#A78BFA",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
  },
  statusReadyBg: {
    backgroundColor: "rgba(52, 211, 153, 0.14)",
  },
  statusProcessingBg: {
    backgroundColor: "rgba(251, 191, 36, 0.14)",
  },
  statusFailedBg: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  statusText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11,
  },
  sessionTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
    lineHeight: 22,
    color: UI_COLORS.textPrimary,
  },
  topicsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  topicPill: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
  },
  topicText: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: UI_COLORS.textSecondary,
  },
  sessionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  sessionDate: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  stateCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  stateIconHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: UI_COLORS.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  stateSub: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    minWidth: 160,
  },
});
