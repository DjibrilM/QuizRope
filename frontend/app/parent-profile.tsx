import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../src/hooks/useOrientation";
import {
  LogoutConfirmSheet,
  ScreenHeader,
  useAccountLogout,
} from "../src/components/common";
import { ParentProfileView } from "../src/components/children/ParentProfileView";
import { UI_COLORS } from "../src/constants/theme";

export default function ParentProfileScreen() {
  usePortrait();
  const { t } = useTranslation(["common"]);
  const { logoutSheetRef, openLogoutConfirm, executeLogout } =
    useAccountLogout();

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <ScreenHeader title={t("common:parentProfile.title")} />

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          <ParentProfileView onLogout={openLogoutConfirm} />
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
});
