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
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePortrait } from "../src/hooks/useOrientation";
import { useGameStore } from "../src/stores/gameStore";
import { apiService } from "../src/services/api";
import {
  LanguageSelector,
  AnimatedLoader,
  TermsSheet,
} from "../src/components/common";
import { BrainMascot } from "../src/components/common/Mascots";
import {
  LanguagePill,
  PillButton,
  SelectionCard,
  type FloatingBottomSheetRef,
} from "../src/components/ui";
import {
  ParentIcon,
  StudentIcon,
  GuestIcon,
} from "../src/components/icons";
import { FONTS, UI_COLORS, UI_RADII } from "../src/constants/theme";
import { getHeadingFont } from "../src/utils/fontForLocale";

type RoleChoice = "parent" | "player";

export default function RoleSelectScreen() {
  const { t } = useTranslation(["auth", "common"]);
  const langSheetRef = useRef<FloatingBottomSheetRef>(null);
  const termsSheetRef = useRef<FloatingBottomSheetRef>(null);
  const { guestProfile, loginAsGuest, _hasHydrated, isAuthenticated, locale } =
    useGameStore();
  usePortrait();

  const [selectedRole, setSelectedRole] = useState<RoleChoice>("parent");

  // Re-compute on locale change so Latin vs non-Latin scripts pick the right title font
  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  if (!_hasHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <AnimatedLoader size="lg" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <View style={styles.root} />;
  }

  const handleContinue = () => {
    if (selectedRole === "parent") {
      router.push("/auth/login");
    } else if (selectedRole === "player") {
      router.push("/auth/child-join");
    }
  };

  const handleGuestPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (guestProfile) {
      const state = useGameStore.getState();
      if (state.ghostToken) {
        apiService.setGhostToken(state.ghostToken);
      }
      loginAsGuest();
      router.replace("/home");
    } else {
      router.push("/auth/guest-setup");
    }
  };

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
              <LanguagePill
                transparent
                onPress={() => langSheetRef.current?.present()}
              />
            ),
          }}
        />
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, Platform.OS === "ios" && styles.topBarIOS]}>
        <BrainMascot size={46} variant="floatUp" interactive />

        {Platform.OS !== "ios" && (
          <LanguagePill onPress={() => langSheetRef.current?.present()} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.mainColumn}>
          {/* Editorial Heading */}
          <View style={styles.heroSection}>
            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {t("auth:roleSelect.heading", "Choose your profile")}
            </Text>
            <Text style={styles.subheading}>
              {t(
                "auth:roleSelect.subheading",
                "Pick Parent to guide kids, or Player to jump into a quiz.",
              )}
            </Text>
          </View>

          {/* Selectable Parent / Player Role Cards */}
          <View style={styles.cardStack}>
            <SelectionCard
              title={t("auth:roleSelect.parent", "I'm a Parent")}
              description={t(
                "auth:roleSelect.parentDesc",
                "Manage kids, homework help, and track learning progress",
              )}
              selected={selectedRole === "parent"}
              onPress={() => setSelectedRole("parent")}
              renderIcon={(selected) => (
                <ParentIcon size={28} selected={selected} />
              )}
            />

            <SelectionCard
              title={t("auth:roleSelect.player", "I'm a Player")}
              description={t(
                "auth:roleSelect.playerDesc",
                "Link with your parent's code and start playing quizzes",
              )}
              selected={selectedRole === "player"}
              onPress={() => setSelectedRole("player")}
              renderIcon={(selected) => (
                <StudentIcon size={28} selected={selected} />
              )}
            />
          </View>

          {/* Primary CTA */}
          <View style={styles.ctaWrap}>
            <PillButton
              label={t("common:buttons.continue", "Continue")}
              onPress={handleContinue}
              disabled={!selectedRole}
              size="lg"
            />
          </View>

          {/* Hairline "or" Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>
              {t("auth:roleSelect.or", "or")}
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest Quick-Play Option */}
          {guestProfile ? (
            <TouchableOpacity
              onPress={handleGuestPress}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={t("auth:roleSelect.continueAsGuest", {
                name: guestProfile.displayName,
              })}
              style={styles.returningGuestPill}
            >
              <View style={styles.guestAvatarWell}>
                <GuestIcon
                  avatarId={guestProfile.avatarId}
                  size={guestProfile.avatarId ? 46 : 28}
                />
              </View>
              <View style={styles.returningGuestText}>
                <Text style={styles.returningGuestTitle} numberOfLines={1}>
                  {t("auth:roleSelect.continueAsGuest", {
                    name: guestProfile.displayName,
                  })}
                </Text>
                <Text style={styles.returningGuestSub} numberOfLines={1}>
                  {t(
                    "auth:roleSelect.continueAsGuestDesc",
                    "Jump back in where you left off",
                  )}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={UI_COLORS.textMuted}
              />
            </TouchableOpacity>
          ) : (
            <PillButton
              variant="secondary"
              size="lg"
              label={t("auth:roleSelect.guestPlay", "Play without account")}
              onPress={handleGuestPress}
            />
          )}
        </View>

        {/* Grounded Legal Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => termsSheetRef.current?.present()}
            activeOpacity={0.75}
            style={styles.legalButton}
            accessibilityRole="button"
          >
            <Text style={styles.legalText}>
              {t("auth:roleSelect.legalText")}{" "}
              <Text style={styles.legalLink}>{t("auth:roleSelect.terms")}</Text>{" "}
              &{" "}
              <Text style={styles.legalLink}>
                {t("auth:roleSelect.privacy")}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LanguageSelector ref={langSheetRef} />

      <TermsSheet ref={termsSheetRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: "space-between",
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
    marginTop: 6,
    paddingTop: 2,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 0.4,
    color: UI_COLORS.textPrimary,
  },
  subheading: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  cardStack: {
    gap: 12,
  },
  ctaWrap: {
    marginTop: 20,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: UI_COLORS.borderSubtle,
  },
  dividerText: {
    marginHorizontal: 14,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    textTransform: "lowercase",
  },
  returningGuestPill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1A1520",
    borderRadius: UI_RADII.pill,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 16,
  },
  guestAvatarWell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#241D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  returningGuestText: {
    flex: 1,
    gap: 1,
  },
  returningGuestTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: UI_COLORS.textPrimary,
  },
  returningGuestSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  footer: {
    paddingTop: 24,
    alignItems: "center",
  },
  legalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legalText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
    color: UI_COLORS.textMuted,
    textAlign: "center",
  },
  legalLink: {
    fontFamily: FONTS.bodySemiBold,
    color: UI_COLORS.textSecondary,
    textDecorationLine: "underline",
  },
});
