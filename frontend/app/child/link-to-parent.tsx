import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { hapticsService } from "../../src/services/haptics";
import { ScreenHeader } from "../../src/components/common";
import { QRScanner } from "../../src/components/device";
import { AppInput, PillButton } from "../../src/components/ui";
import { FONTS, UI_COLORS } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { extractCodeFromScan } from "../auth/child-join";

export default function LinkToParentScreen() {
  const { t } = useTranslation(["auth", "common", "device"]);
  usePortrait();

  const {
    setChildSession,
    clearGuestProfile,
    setChildProfile,
    setChildren,
    locale,
  } = useGameStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanEnabled = useRef(true);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const handleLink = useCallback(
    async (rawCode: string) => {
      const cleanCode = extractCodeFromScan(rawCode);
      if (cleanCode.length !== 6 && cleanCode.length !== 8) {
        setError(t("auth:guest.linkCodeLengthError"));
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result =
          cleanCode.length === 6
            ? await apiService.redeemGuestCode(cleanCode)
            : await apiService.getChildToken(cleanCode);

        apiService.setToken(result.token);
        useGameStore.setState({ parentUser: null, children: [] });

        setChildSession({
          sessionToken: cleanCode,
          parentId: result.parentId,
          childId: result.childId || null,
          jwtToken: result.token,
        });

        try {
          const payload = await guestDb.getAllDataForMigration();
          if (
            payload.matches.length > 0 ||
            payload.homeworkSessions.length > 0
          ) {
            await apiService.migrateLocalGuestData(payload, result.token);
          }
          await guestDb.clearAllGuestData();
        } catch {
          // Non-blocking
        }

        const me = (await apiService.getMe()) as any;
        setChildProfile({
          displayName: me?.displayName ?? (result as any).displayName ?? "",
          avatarUrl: me?.avatarUrl ?? (result as any).avatarUrl ?? "",
          grade: me?.grade ?? "",
        });

        clearGuestProfile();
        setSuccess(true);
        hapticsService.success();
        setChildren([]);
        router.replace("/home");
      } catch {
        hapticsService.error();
        setError(t("auth:guest.linkCodeInvalidError"));
        scanEnabled.current = true;
      } finally {
        setLoading(false);
      }
    },
    [setChildSession, clearGuestProfile, setChildProfile, setChildren, t],
  );

  const handleScan = useCallback(
    (data: string) => {
      if (!scanEnabled.current) return;
      scanEnabled.current = false;
      setScanning(false);
      const clean = extractCodeFromScan(data);
      setCode(clean);
      void handleLink(clean);
    },
    [handleLink],
  );

  const handleSubmit = () => void handleLink(code);

  if (scanning) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <ScreenHeader title={t("device:childJoin.title")} />
        <View style={styles.scannerContainer}>
          <View style={styles.scannerCard}>
            <View style={styles.scannerInner}>
              <QRScanner onScan={handleScan} enabled={scanEnabled.current} />
            </View>
          </View>
          <PillButton
            variant="secondary"
            size="lg"
            label={t("device:childJoin.enterCodeInstead")}
            onPress={() => {
              scanEnabled.current = true;
              setScanning(false);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScreenHeader title={t("device:connectDevice.title")} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.mainColumn}>
            <View style={styles.heroIconBall}>
              <Ionicons
                name="link-outline"
                size={32}
                color={UI_COLORS.primary}
              />
            </View>

            <Text style={[styles.heading, { fontFamily: headingFont }]}>
              {t("auth:guest.linkTitle")}
            </Text>
            <Text style={styles.subheading}>{t("auth:guest.linkSubtitle")}</Text>

            <AppInput
              value={code}
              onChangeText={(v) => {
                setCode(
                  v
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8),
                );
                if (error) setError("");
              }}
              placeholder="AB12CD"
              error={error}
              success={success}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              leftIcon={
                <Ionicons
                  name="key-outline"
                  size={18}
                  color={error ? UI_COLORS.coral : UI_COLORS.textSecondary}
                />
              }
              inputStyle={{
                letterSpacing: code.length > 0 ? 4 : 0.4,
                fontSize: code.length > 0 ? 18 : 15,
              }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {success ? (
              <Text style={styles.successText}>
                {t("auth:guest.linkSuccess")}
              </Text>
            ) : null}

            <View style={styles.ctaWrap}>
              <PillButton
                label={
                  success
                    ? t("auth:guest.linked")
                    : t("auth:guest.linkButton")
                }
                onPress={handleSubmit}
                loading={loading}
                disabled={loading || success || code.trim().length === 0}
                size="lg"
              />
            </View>

            {!success ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>
                    {t("auth:roleSelect.or", "or")}
                  </Text>
                  <View style={styles.dividerLine} />
                </View>

                <PillButton
                  variant="secondary"
                  size="lg"
                  label={t("device:childJoin.scanQR")}
                  icon={
                    <Ionicons
                      name="qr-code-outline"
                      size={18}
                      color={UI_COLORS.textPrimary}
                    />
                  }
                  onPress={() => {
                    scanEnabled.current = true;
                    setScanning(true);
                  }}
                />
              </>
            ) : null}

            <Text style={styles.hintText}>{t("auth:guest.linkHint")}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  scannerContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  scannerCard: {
    flex: 1,
    width: "100%",
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    alignItems: "center",
  },
  heroIconBall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  subheading: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  successText: {
    marginTop: 12,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI_COLORS.mint,
    textAlign: "center",
  },
  ctaWrap: {
    width: "100%",
    marginTop: 20,
  },
  dividerRow: {
    width: "100%",
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
  hintText: {
    marginTop: 22,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
    color: UI_COLORS.textMuted,
    textAlign: "center",
  },
});
