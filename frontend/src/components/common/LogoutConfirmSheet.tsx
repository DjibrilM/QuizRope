import React, { useCallback, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { firebaseAuthService } from "../../services/firebase";
import { apiService } from "../../services/api";
import * as guestDb from "../../services/guestDb";
import { useGameStore } from "../../stores/gameStore";
import {
  FloatingBottomSheet,
  FloatingBottomSheetView,
  PillButton,
  type FloatingBottomSheetRef,
} from "../ui";
import { FONTS, UI_COLORS } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";

export function useAccountLogout() {
  const { logout } = useGameStore();
  const queryClient = useQueryClient();
  const logoutSheetRef = useRef<FloatingBottomSheetRef>(null);

  const openLogoutConfirm = useCallback(() => {
    logoutSheetRef.current?.present();
  }, []);

  const executeLogout = useCallback(async () => {
    logoutSheetRef.current?.dismiss();
    try {
      await firebaseAuthService.signOut();
    } catch {
      // non-critical for guest/child
    }
    guestDb.clearAllGuestData().catch(() => {});
    apiService.clearToken();
    logout();
    queryClient.clear();
    router.replace("/");
  }, [logout, queryClient]);

  return { logoutSheetRef, openLogoutConfirm, executeLogout };
}

export function LogoutConfirmSheet({
  sheetRef,
  onConfirm,
}: {
  sheetRef: React.RefObject<FloatingBottomSheetRef | null>;
  onConfirm: () => Promise<void> | void;
}) {
  const { t } = useTranslation(["auth", "common"]);
  const locale = useGameStore((s) => s.locale);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  return (
    <FloatingBottomSheet ref={sheetRef} enableDynamicSizing>
      <FloatingBottomSheetView style={styles.sheetContent}>
        <View style={styles.sheetIconBall}>
          <Ionicons name="log-out-outline" size={26} color={UI_COLORS.coral} />
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
              onPress={() => sheetRef.current?.dismiss()}
            />
          </View>
          <View style={styles.sheetActionSlot}>
            <PillButton
              label={t("auth:logout.button")}
              size="lg"
              onPress={() => {
                void onConfirm();
              }}
              style={styles.logoutConfirmButton}
            />
          </View>
        </View>
      </FloatingBottomSheetView>
    </FloatingBottomSheet>
  );
}

const styles = StyleSheet.create({
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
