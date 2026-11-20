import React, { useRef, useState } from "react";
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { apiService } from "../../src/services/api";
import { firebaseAuthService } from "../../src/services/firebase";
import { useGameStore } from "../../src/stores/gameStore";
import { NotificationService } from "../../src/services/NotificationService";
import { useToast } from "../../src/context/ToastContext";
import { TermsSheet } from "../../src/components/common";
import { LoginButton } from "../../src/components/auth";
import type { FloatingBottomSheetRef } from "../../src/components/ui";
import { FONTS, UI_COLORS } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";

const LOGIN_BG = require("../../assets/login-bg.jpg");

export default function LoginScreen() {
  const { t } = useTranslation(["auth", "common"]);
  const [loading, setLoading] = useState(false);
  const termsSheetRef = useRef<FloatingBottomSheetRef>(null);
  const { setAuth, locale } = useGameStore();
  const { showApiError } = useToast();
  usePortrait();

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const handleLogin = async (
    idToken: string,
    profile?: { photoUrl?: string | null; displayName?: string | null },
  ) => {
    const result = await apiService.login(idToken, profile);
    apiService.setToken(result.token);
    const user = result.user as unknown as Record<string, unknown>;
    setAuth(
      { ...result.user, ...user },
      result.mockMode ?? false,
      result.token,
    );

    NotificationService.sendSignInNotification(result.user.displayName);
    router.replace("/home");
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (!firebaseAuthService.isGoogleConfigured()) {
        throw new Error("Google Sign-In is not configured for this build.");
      }
      const { idToken, user } = await firebaseAuthService.signInWithGoogle();
      await handleLogin(idToken, {
        photoUrl: user?.photoURL,
        displayName: user?.displayName,
      });
    } catch (err: any) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
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

      {/* Full-bleed angled card collage background — no blur filter */}
      <ImageBackground
        source={LOGIN_BG}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />

      {/* Cinematic dark vignette overlay across the collage + fade into CTA stage */}
      <LinearGradient
        colors={[
          "rgba(13, 11, 20, 0.54)",
          "rgba(13, 11, 20, 0.38)",
          "rgba(13, 11, 20, 0.86)",
          "rgba(13, 11, 20, 0.99)",
        ]}
        locations={[0, 0.34, 0.62, 0.84]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.stage}>
          <View style={styles.actionWrap}>
            <View style={styles.parentPromptWrap}>
              <Text style={[styles.parentTitle, { fontFamily: headingFont }]}>
                {t("auth:login.continueAsParent", "Continue as parent")}
              </Text>
              <Text style={styles.parentDescription}>
                {t(
                  "auth:login.parentDescription",
                  "Sign in with your Google account to manage kid profiles and track progress.",
                )}
              </Text>
            </View>

            <LoginButton
              onPress={handleGoogleSignIn}
              loading={loading}
              label={t("auth:login.continueWithGoogle", "Continue with Google")}
            />
          </View>
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
      </SafeAreaView>

      <TermsSheet ref={termsSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  safeArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  stage: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 22,
    paddingBottom: 20,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  actionWrap: {
    width: "100%",
  },
  parentPromptWrap: {
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  parentTitle: {
    fontSize: 22,
    lineHeight: 28,
    paddingTop: 2,
    color: "#FFFFFF",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  parentDescription: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.74)",
    textAlign: "center",
  },
  footer: {
    paddingBottom: 10,
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
    color: "rgba(255, 255, 255, 0.65)",
    textAlign: "center",
  },
  legalLink: {
    fontFamily: FONTS.bodySemiBold,
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
});
