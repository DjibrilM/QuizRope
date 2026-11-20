import React, { useEffect, useRef } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { MatchStatus } from "@shared/types/match.types";
import { usePortrait } from "../src/hooks/useOrientation";
import { useGameStore } from "../src/stores/gameStore";
import { apiService } from "../src/services/api";
import { hapticsService } from "../src/services/haptics";
import { getFallbackParentAvatarId } from "../src/config/avatars";
import { AvatarIcon } from "../src/components/common/AvatarIcons";
import {
  HomeChildrenIcon,
  HomeControllerIcon,
  HomeHistoryIcon,
  HomeHomeworkIcon,
  HomeLeaderboardIcon,
  HomeQuickPlayIcon,
} from "../src/components/icons";
import {
  BouncePress,
  LanguageSelector,
  StaggeredList,
} from "../src/components/common";
import { BrainMascot } from "../src/components/common/Mascots";
import {
  LanguagePill,
  type FloatingBottomSheetRef,
} from "../src/components/ui";
import { FONTS, UI_COLORS, UI_RADII } from "../src/constants/theme";
import { getHeadingFont } from "../src/utils/fontForLocale";

interface HomeActionPillProps {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
  rightBadge?: string;
  accessibilityLabel?: string;
}

/**
 * Full-pill action row aligned with SelectionCard and the matte obsidian theme.
 */
function HomeActionPill({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  highlight = false,
  rightBadge,
  accessibilityLabel,
}: HomeActionPillProps) {
  const locale = useGameStore((s) => s.locale);
  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  return (
    <BouncePress
      onPress={() => {
        hapticsService.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title}. ${subtitle}`}
      style={[
        styles.actionPill,
        highlight ? styles.actionPillHighlight : styles.actionPillDefault,
      ]}
    >
      <View
        style={[
          styles.actionIconBall,
          highlight ? styles.iconBallHighlight : styles.iconBallDefault,
          iconBg ? { backgroundColor: iconBg } : null,
        ]}
      >
        {icon}
      </View>

      <View style={styles.actionTextBlock}>
        <Text
          style={[
            styles.actionTitle,
            {
              fontFamily: headingFont,
              color: highlight ? UI_COLORS.textOnPrimary : UI_COLORS.textPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.actionSubtitle,
            {
              color: highlight
                ? UI_COLORS.textSubtleOnPrimary
                : UI_COLORS.textSecondary,
            },
          ]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>

      {rightBadge ? (
        <View
          style={[
            styles.countBadge,
            highlight && styles.countBadgeHighlight,
          ]}
        >
          <Text
            style={[
              styles.countBadgeText,
              highlight && styles.countBadgeTextHighlight,
            ]}
          >
            {rightBadge}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.chevronWell,
          highlight && styles.chevronWellHighlight,
        ]}
      >
        <Ionicons
          name="chevron-forward"
          size={16}
          color={highlight ? "#FFFFFF" : UI_COLORS.textMuted}
        />
      </View>
    </BouncePress>
  );
}

export default function HomeScreen() {
  usePortrait();
  const { t } = useTranslation(["home", "auth", "common"]);
  const {
    parentUser,
    isMockMode,
    userRole,
    guestProfile,
    childProfile,
    setCurrentMatch,
    setChildren,
    children,
    locale,
  } = useGameStore();

  const isGuest = userRole === "guest";
  const isChild = userRole === "child";
  const languageSheetRef = useRef<FloatingBottomSheetRef>(null);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  useEffect(() => {
    if (userRole === "child" && apiService.hasToken()) {
      apiService.syncBackendDataToLocal().catch(() => {});
    }

    if (userRole !== "child" && userRole !== "guest" && apiService.hasToken()) {
      apiService
        .getChildren()
        .then((data) => {
          if (Array.isArray(data)) {
            setChildren(
              data
                .filter(Boolean)
                .map((c: any) => ({ ...c, id: c._id || c.id })),
            );
          }
        })
        .catch(() => {});
    }
  }, [userRole, setChildren]);

  const parentFallbackAvatar = getFallbackParentAvatarId(
    parentUser?.email || parentUser?.id || "parent",
  );
  const activeAvatar = isGuest
    ? guestProfile?.avatarId
    : isChild
      ? childProfile?.avatarUrl
      : parentUser?.avatarUrl || parentFallbackAvatar;

  const handleQuickPlay = () => {
    const match = {
      id: "quick-play-" + Date.now(),
      hostParentId: "mock-parent",
      subject: "MATH",
      difficulty: "EASY",
      maxRounds: 10,
      teams: [
        {
          id: "team-red",
          name: "Red Team",
          color: "#EF4444",
          side: "LEFT" as const,
          players: [],
        },
        {
          id: "team-blue",
          name: "Blue Team",
          color: "#3B82F6",
          side: "RIGHT" as const,
          players: [],
        },
      ],
      ropePosition: 0,
      currentQuestionIndex: 0,
      status: MatchStatus.WAITING,
      rounds: 0,
      createdAt: new Date(),
    };
    setCurrentMatch(match as any);
    router.push({ pathname: "/match/game", params: { matchId: match.id } });
  };

  const activeName = isGuest
    ? guestProfile?.displayName
    : isChild
      ? childProfile?.displayName
      : parentUser?.displayName;

  const firstName = activeName?.trim().split(/\s+/)[0];

  const greetingLine = firstName
    ? `${t("home:welcomeBack")}, ${firstName}`
    : t("home:welcomeBack");

  const renderRightAccessory = (inLiquidGlass: boolean) => (
    <TouchableOpacity
      onPress={() => {
        hapticsService.selection();
        router.push(
          (isChild || isGuest ? "/kid-profile" : "/parent-profile") as any,
        );
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={
        isChild || isGuest
          ? t("leaderboard:yourProfile", "Your Profile")
          : t("common:parentProfile.title")
      }
      style={[
        styles.avatarHeaderButton,
        inLiquidGlass && styles.avatarHeaderButtonBare,
      ]}
    >
      <AvatarIcon
        avatarId={activeAvatar}
        fallbackAvatarId={parentFallbackAvatar}
        size={28}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {Platform.OS === "ios" && (
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerStyle: { backgroundColor: "transparent" },
            headerShadowVisible: false,
            headerBackVisible: false,
            title: "",
            headerRight: () => (
              <View style={styles.iosHeaderRight}>
                <LanguagePill
                  transparent
                  onPress={() => languageSheetRef.current?.present()}
                />
                <View style={styles.iosHeaderDivider} />
                {renderRightAccessory(true)}
              </View>
            ),
          }}
        />
      )}

      {/* Top Bar matching RoleSelectScreen */}
      <View style={[styles.topBar, Platform.OS === "ios" && styles.topBarIOS]}>
        <BrainMascot size={46} variant="floatUp" interactive />

        {Platform.OS !== "ios" && (
          <View style={styles.androidTopRight}>
            <LanguagePill
              onPress={() => languageSheetRef.current?.present()}
            />
            {renderRightAccessory(false)}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Hero Title & Personalized Greeting */}
          <View style={styles.heroSection}>
            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {t("home:appName")}
            </Text>
            <Text style={styles.subheading}>{greetingLine}</Text>
          </View>

          {/* Featured Primary Action Frame (concentric outer shell) */}
          <View
            style={[
              styles.featuredShell,
              __DEV__ && isMockMode && !isGuest && styles.featuredShellStacked,
            ]}
          >
            {__DEV__ && isMockMode && !isGuest && (
              <HomeActionPill
                highlight
                icon={<HomeQuickPlayIcon size={28} />}
                title={t("home:menu.quickPlay")}
                subtitle={t("home:menu.quickPlayDesc")}
                onPress={handleQuickPlay}
              />
            )}

            {isGuest && (
              <HomeActionPill
                highlight
                icon={<HomeControllerIcon size={29} />}
                title={t("home:menu.soloPlay")}
                subtitle={t("home:menu.soloPlayDesc")}
                onPress={() => router.push("/match/create")}
              />
            )}

            {!isGuest && (
              <HomeActionPill
                highlight
                icon={<HomeControllerIcon size={29} />}
                title={t("home:menu.startNewGame")}
                subtitle={t("home:menu.startNewGameDesc")}
                onPress={() => router.push("/match/create")}
              />
            )}
          </View>

          {/* Secondary Action Stack */}
          <StaggeredList staggerMs={65}>
            <HomeActionPill
              icon={<HomeHomeworkIcon size={28} />}
              iconBg={UI_COLORS.primarySoft}
              title={t("home:menu.homeworkAssist")}
              subtitle={t("home:menu.homeworkAssistDesc")}
              onPress={() => router.push("/homework" as any)}
            />

            {userRole !== "child" && !isGuest && (
              <HomeActionPill
                icon={<HomeChildrenIcon size={28} />}
                iconBg="rgba(167, 139, 250, 0.14)"
                title={t("home:menu.myChildren")}
                subtitle={t("home:menu.myChildrenDesc")}
                rightBadge={
                  Array.isArray(children) && children.length > 0
                    ? String(children.length)
                    : undefined
                }
                onPress={() => router.push("/child")}
              />
            )}

            <HomeActionPill
              icon={<HomeHistoryIcon size={28} />}
              iconBg="rgba(251, 113, 133, 0.14)"
              title={t("home:menu.matchHistory")}
              subtitle={t("home:menu.matchHistoryDesc")}
              onPress={() => router.push("/match/history" as any)}
            />

            {!isGuest && !isChild && (
              <HomeActionPill
                icon={<HomeLeaderboardIcon size={28} />}
                iconBg="rgba(251, 191, 36, 0.14)"
                title={t("home:menu.leaderboard")}
                subtitle={t("home:menu.leaderboardDesc")}
                onPress={() => router.push("/leaderboard" as any)}
              />
            )}

            {isGuest && (
              <HomeActionPill
                icon={
                  <Ionicons
                    name="link-outline"
                    size={22}
                    color="#A29BFE"
                  />
                }
                title={t("home:guest.linkMenuItem")}
                subtitle={t("home:guest.linkMenuItemDesc")}
                onPress={() => router.push("/child/link-to-parent")}
              />
            )}
          </StaggeredList>
        </View>
      </ScrollView>

      <LanguageSelector ref={languageSheetRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topBarIOS: {
    paddingTop: 0,
    minHeight: 44,
  },
  iosHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  iosHeaderDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  androidTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarHeaderButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(108, 92, 231, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHeaderButtonBare: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
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
    marginTop: 4,
    paddingTop: 2,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0.4,
    color: UI_COLORS.textPrimary,
  },
  subheading: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  featuredShell: {
    backgroundColor: "#161221",
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    gap: 8,
    marginBottom: 14,
  },
  featuredShellStacked: {
    borderRadius: 38,
    borderCurve: "continuous",
  },
  actionPill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
    gap: 12,
  },
  actionPillDefault: {
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 10,
  },
  actionPillHighlight: {
    backgroundColor: UI_COLORS.primary,
  },
  actionIconBall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBallDefault: {
    backgroundColor: "#241D2E",
  },
  iconBallHighlight: {
    backgroundColor: "#5746CE",
  },
  actionTextBlock: {
    flex: 1,
    gap: 1,
  },
  actionTitle: {
    fontSize: 16,
    lineHeight: 20,
    paddingTop: 1,
    letterSpacing: 0.4,
  },
  actionSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: UI_RADII.pill,
    backgroundColor: "rgba(108, 92, 231, 0.16)",
  },
  countBadgeHighlight: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  countBadgeText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 12,
    color: "#A29BFE",
  },
  countBadgeTextHighlight: {
    color: "#FFFFFF",
  },
  chevronWell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  chevronWellHighlight: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
