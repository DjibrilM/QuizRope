import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../hooks/useOrientation";
import { useGameStore } from "../../stores/gameStore";
import { hapticsService } from "../../services/haptics";
import { AnimatedLoader, AvatarIcon } from "../common";
import { AppInput, PillButton } from "../ui";
import { QRScanner } from "./QRScanner";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import {
  extractCodeFromScan,
  redeemAccountLinkCode,
  sanitizeLinkCodeInput,
  useLinkInfoPreview,
} from "../../utils/accountLinking";

type Status = "idle" | "scanning" | "loading";

interface LinkAccountFlowProps {
  heading: string;
  subtitle: string;
  ctaLabel: string;
  hintText?: string;
  invalidCodeError: string;
  lengthError: string;
  headerRight?: React.ReactNode;
  footerExtra?: React.ReactNode;
}

/**
 * Shared child/guest account linking screen body with normalized uppercase input,
 * one-tap clipboard paste, debounced live child preview, and QR camera scanning.
 */
export function LinkAccountFlow({
  heading,
  subtitle,
  ctaLabel,
  hintText,
  invalidCodeError,
  lengthError,
  headerRight,
  footerExtra,
}: LinkAccountFlowProps) {
  const { t } = useTranslation(["device", "common", "auth"]);
  usePortrait();

  const locale = useGameStore((s) => s.locale);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 16;

  const [status, setStatus] = useState<Status>("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const scanEnabled = useRef(true);

  const { linkInfo, isLookingUp, clearLinkInfo } = useLinkInfoPreview(code);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const handleJoin = useCallback(
    async (rawCode: string) => {
      const extracted = extractCodeFromScan(rawCode);
      if (extracted.length !== 6 && extracted.length !== 8) {
        hapticsService.error();
        setError(lengthError);
        scanEnabled.current = true;
        return;
      }

      setStatus("loading");
      setError("");

      try {
        await redeemAccountLinkCode(extracted);
        hapticsService.success();
        router.replace("/home");
      } catch (err: any) {
        hapticsService.error();
        scanEnabled.current = true;
        setError(
          err?.message === "INVALID_CODE_LENGTH"
            ? lengthError
            : invalidCodeError,
        );
        setStatus("idle");
      }
    },
    [invalidCodeError, lengthError],
  );

  const handleScan = useCallback(
    (data: string) => {
      if (!scanEnabled.current) return;
      scanEnabled.current = false;
      const clean = extractCodeFromScan(data);
      setCode(clean);
      void handleJoin(clean);
    },
    [handleJoin],
  );

  const handleSubmitCode = () => {
    if (code.trim()) {
      void handleJoin(code);
    }
  };

  const handlePaste = useCallback(async () => {
    const pasted = await Clipboard.getStringAsync();
    const cleaned = extractCodeFromScan(pasted);
    if (!cleaned) return;
    hapticsService.selection();
    setCode(sanitizeLinkCodeInput(cleaned));
    if (error) setError("");
  }, [error]);

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
        ...(headerRight && { headerRight: () => headerRight }),
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
            {t("common:labels.connecting")}
          </Text>
        </View>
        {footerExtra}
      </SafeAreaView>
    );
  }

  if (status === "scanning") {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        {nativeHeader}
        <View style={[styles.scannerContainer, { paddingTop: contentTop }]}>
          <Text style={[styles.heading, { fontFamily: headingFont }]}>
            {t("device:childJoin.scanQR")}
          </Text>
          <Text style={styles.subheading}>
            {t("device:childJoin.scanInstruction")}
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
              label={t("device:childJoin.enterCodeInstead")}
              onPress={() => {
                scanEnabled.current = true;
                setStatus("idle");
              }}
            />
          </View>
        </View>
        {footerExtra}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {nativeHeader}

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
          bounces={false}
        >
          <View style={styles.mainColumn}>
            <View style={styles.heroSection}>
              <Text style={[styles.heading, { fontFamily: headingFont }]}>
                {heading}
              </Text>
              <Text style={styles.subheading}>{subtitle}</Text>
            </View>

            <AppInput
              value={code}
              onChangeText={(v) => {
                const next = sanitizeLinkCodeInput(v);
                setCode(next);
                if (error) setError("");
                if (next.length < 6) clearLinkInfo();
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
              rightSlot={
                code.length === 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      void handlePaste();
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:buttons.paste")}
                    style={styles.pastePill}
                  >
                    <Ionicons
                      name="clipboard-outline"
                      size={13}
                      color={UI_COLORS.textSecondary}
                    />
                    <Text style={styles.pasteText}>
                      {t("common:buttons.paste")}
                    </Text>
                  </TouchableOpacity>
                ) : undefined
              }
              inputStyle={{
                letterSpacing: code.length > 0 ? 3.5 : 0.2,
                fontSize: code.length > 0 ? 17 : 15,
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={handleSubmitCode}
            />

            {isLookingUp ? (
              <View style={styles.lookupLoader}>
                <AnimatedLoader size="sm" color={UI_COLORS.primary} />
              </View>
            ) : null}

            {!isLookingUp && linkInfo ? (
              <View style={styles.previewPill}>
                <View style={styles.previewBall}>
                  <AvatarIcon avatarId={linkInfo.avatarUrl} size={46} />
                </View>
                <View style={styles.previewTextCol}>
                  <Text style={styles.previewLabel}>
                    {linkInfo.isFamilyInvite
                      ? t("device:childJoin.joiningFamily")
                      : t("device:childJoin.linkingTo")}
                  </Text>
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
            ) : null}

            <View style={styles.ctaWrap}>
              <PillButton
                label={ctaLabel}
                onPress={handleSubmitCode}
                disabled={!code.trim()}
                size="lg"
              />
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("auth:roleSelect.or")}</Text>
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
                setStatus("scanning");
              }}
            />

            {hintText ? <Text style={styles.hintText}>{hintText}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {footerExtra}
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
  pastePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pasteText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
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
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.28)",
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
    color: UI_COLORS.mint,
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
  hintText: {
    marginTop: 20,
    fontFamily: FONTS.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: UI_COLORS.textMuted,
    textAlign: "center",
    paddingHorizontal: 8,
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
