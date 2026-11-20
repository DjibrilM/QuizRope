import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import { useGameStore } from "../../src/stores/gameStore";
import {
  AnimatedLoader,
  AvatarIcon,
  LanguageSelector,
} from "../../src/components/common";
import { QRScanner } from "../../src/components/device";
import {
  AppInput,
  LanguagePill,
  PillButton,
  type FloatingBottomSheetRef,
} from "../../src/components/ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import * as guestDb from "../../src/services/guestDb";
import { NotificationService } from "../../src/services/NotificationService";

type Status = "idle" | "scanning" | "loading" | "error";

export function extractCodeFromScan(data: string): string {
  if (!data) return "";
  const trimmed = data.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.token && typeof parsed.token === "string") {
      return parsed.token.trim().toUpperCase();
    }
    if (parsed.code && typeof parsed.code === "string") {
      return parsed.code.trim().toUpperCase();
    }
    if (parsed.sessionToken && typeof parsed.sessionToken === "string") {
      return parsed.sessionToken.trim().toUpperCase();
    }
  } catch {}

  const paramMatch = trimmed.match(/[?&](?:code|token)=([A-Za-z0-9]+)/i);
  if (paramMatch) return paramMatch[1].toUpperCase();

  const eightMatch = trimmed.match(/\b([A-Za-z0-9]{8})\b/);
  if (eightMatch) return eightMatch[1].toUpperCase();

  const sixMatch = trimmed.match(/\b([A-Za-z0-9]{6})\b/);
  if (sixMatch) return sixMatch[1].toUpperCase();

  return trimmed.toUpperCase();
}

export default function ChildJoinScreen() {
  const { t } = useTranslation(["device", "common", "auth"]);
  usePortrait();
  const [status, setStatus] = useState<Status>("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [linkInfo, setLinkInfo] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const scanEnabled = useRef(true);
  const langSheetRef = useRef<FloatingBottomSheetRef>(null);
  const { setChildSession, locale } = useGameStore();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 16;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  // Look up child info when a 4-7 char code is entered
  useEffect(() => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length >= 4 && cleanCode.length <= 7) {
      const timer = setTimeout(async () => {
        setIsLookingUp(true);
        try {
          const info = await apiService.getLinkInfo(cleanCode);
          setLinkInfo(info);
          setError("");
        } catch {
          setLinkInfo(null);
        } finally {
          setIsLookingUp(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setLinkInfo(null);
    }
  }, [code]);

  const handleJoin = useCallback(
    async (rawCode: string) => {
      setStatus("loading");
      setError("");
      try {
        const cleanCode = extractCodeFromScan(rawCode);

        const result =
          cleanCode.length === 6
            ? await apiService.redeemGuestCode(cleanCode)
            : await apiService.getChildToken(cleanCode);

        apiService.setToken(result.token);

        try {
          const me = (await apiService.getMe()) as any;
          if (me) {
            useGameStore.getState().setChildProfile({
              displayName: me.displayName ?? "",
              avatarUrl: me.avatarUrl ?? "",
              grade: me.grade ?? "",
            });
          }
        } catch (e) {
          console.warn("Failed to fetch fresh profile immediately:", e);
        }

        try {
          const payload = await guestDb.getAllDataForMigration();
          if (
            payload.matches.length > 0 ||
            payload.homeworkSessions.length > 0
          ) {
            await apiService.migrateLocalGuestData(payload, result.token);
            await guestDb.clearAllGuestData();
            useGameStore.getState().clearGuestProfile();
          }
          await apiService.syncBackendDataToLocal();
        } catch (migErr) {
          console.error("Migration/Sync failed (non-fatal):", migErr);
        }

        setChildSession({
          sessionToken: cleanCode,
          parentId: result.parentId,
          childId: result.childId || null,
          jwtToken: result.token,
        });
        NotificationService.sendSignInNotification();
        router.replace("/home");
      } catch (err) {
        console.error("Join failed:", err);
        setError(t("device:childJoin.invalidCode"));
        setStatus("idle");
      }
    },
    [setChildSession, t],
  );

  const handleScan = useCallback(
    (data: string) => {
      if (!scanEnabled.current) return;
      scanEnabled.current = false;
      handleJoin(data);
    },
    [handleJoin],
  );

  const handleSubmitCode = () => {
    if (code.trim()) {
      handleJoin(code);
    }
  };

  const nativeHeader = (
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
        headerRight: () => (
          <LanguagePill
            transparent={Platform.OS === "ios"}
            onPress={() => langSheetRef.current?.present()}
          />
        ),
      }}
    />
  );

  if (status === "loading") {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        {nativeHeader}
        <View style={styles.centerState}>
          <AnimatedLoader size="lg" color={UI_COLORS.primary} />
          <Text style={[styles.loadingTitle, { fontFamily: headingFont }]}>
            {t("common:labels.connecting", "Connecting...")}
          </Text>
        </View>
        <LanguageSelector ref={langSheetRef} />
      </SafeAreaView>
    );
  }

  if (status === "scanning") {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        {nativeHeader}
        <View style={[styles.scannerContainer, { paddingTop: contentTop }]}>
          <Text style={[styles.heading, { fontFamily: headingFont }]}>
            {t("device:childJoin.scanQR", "Scan QR Code")}
          </Text>
          <Text style={styles.subheading}>
            {t(
              "device:childJoin.scanInstruction",
              "Point your camera at the QR code on your parent's device.",
            )}
          </Text>

          <View style={styles.scannerCard}>
            <View style={styles.scannerInner}>
              <QRScanner onScan={handleScan} enabled={scanEnabled.current} />
            </View>
          </View>

          <View style={styles.scannerAction}>
            <PillButton
              variant="secondary"
              size="lg"
              label={t("device:childJoin.enterCodeInstead", "Enter code instead")}
              onPress={() => {
                scanEnabled.current = true;
                setStatus("idle");
              }}
            />
          </View>
        </View>
        <LanguageSelector ref={langSheetRef} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {nativeHeader}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: contentTop },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.mainColumn}>
            {/* Hero */}
            <View style={styles.heroSection}>
              <Text style={[styles.heading, { fontFamily: headingFont }]}>
                {t("device:childJoin.connectAccount", "Connect Account")}
              </Text>
              <Text style={styles.subheading}>
                {t("device:childJoin.instruction")}
              </Text>
            </View>

            {/* Code input (twende-passengers rounded matte input style) */}
            <AppInput
              value={code}
              onChangeText={(v) => {
                setCode(v);
                if (error) setError("");
              }}
              placeholder={t("device:childJoin.codeInputPlaceholder")}
              error={error}
              success={Boolean(linkInfo) && !isLookingUp && error === ""}
              leftIcon={
                <Ionicons
                  name="key-outline"
                  size={18}
                  color={
                    error
                      ? UI_COLORS.coral
                      : linkInfo
                        ? UI_COLORS.mint
                        : UI_COLORS.textSecondary
                  }
                />
              }
              inputStyle={{
                letterSpacing: code.length > 0 ? 3.5 : 0.2,
                fontSize: code.length > 0 ? 17 : 15,
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleSubmitCode}
            />

            {isLookingUp && (
              <View style={styles.lookupLoader}>
                <AnimatedLoader size="sm" color={UI_COLORS.primary} />
              </View>
            )}

            {/* Resolved profile preview pill matching SelectionCard */}
            {!isLookingUp && linkInfo && (
              <View style={styles.previewPill}>
                <View style={styles.previewBall}>
                  <AvatarIcon avatarId={linkInfo.avatarUrl} size={46} />
                </View>
                <View style={styles.previewTextCol}>
                  <Text style={styles.previewLabel}>Linking to</Text>
                  <Text
                    style={[styles.previewName, { fontFamily: headingFont }]}
                    numberOfLines={1}
                  >
                    {linkInfo.displayName}
                  </Text>
                </View>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={UI_COLORS.mint}
                />
              </View>
            )}

            {/* Primary CTA */}
            <View style={styles.ctaWrap}>
              <PillButton
                label={t("common:buttons.link", "Link")}
                onPress={handleSubmitCode}
                disabled={!code.trim()}
                size="lg"
              />
            </View>

            {/* Hairline divider matching index.tsx */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {t("auth:roleSelect.or", "or")}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Secondary QR CTA */}
            <PillButton
              variant="secondary"
              size="lg"
              label={t("device:childJoin.scanQR", "Scan QR Code")}
              icon={
                <Ionicons
                  name="qr-code-outline"
                  size={18}
                  color={UI_COLORS.textPrimary}
                />
              }
              onPress={() => {
                scanEnabled.current = true;
                setStatus("scanning");
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LanguageSelector ref={langSheetRef} />
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
    paddingTop: 20,
    paddingBottom: 24,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  heroSection: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 0.4,
    paddingTop: 2,
    color: UI_COLORS.textPrimary,
  },
  subheading: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  lookupLoader: {
    alignItems: "center",
    marginTop: 14,
  },
  previewPill: {
    marginTop: 14,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1520",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 16,
    gap: 12,
  },
  previewBall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#241D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  previewTextCol: {
    flex: 1,
    gap: 1,
  },
  previewLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: UI_COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewName: {
    fontSize: 17,
    lineHeight: 22,
    color: UI_COLORS.textPrimary,
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
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 18,
  },
  loadingTitle: {
    fontSize: 22,
    color: UI_COLORS.textPrimary,
    letterSpacing: 0.4,
  },
  scannerContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 16,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  scannerCard: {
    flex: 1,
    width: "100%",
    marginTop: 18,
    marginBottom: 18,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 6,
  },
  scannerInner: {
    flex: 1,
    borderRadius: 24,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  scannerAction: {
    paddingTop: 2,
  },
});
