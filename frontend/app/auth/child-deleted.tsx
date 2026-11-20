import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { PillButton } from "../../src/components/ui";
import { FONTS, UI_COLORS } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";

export default function ChildDeletedScreen() {
  const { t } = useTranslation(["auth", "common"]);
  const headingFont = getHeadingFont();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconBall}>
          <Ionicons
            name="person-remove-outline"
            size={40}
            color={UI_COLORS.coral}
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { fontFamily: headingFont }]}>
            {t("auth:childDeleted.title", "Profile Removed")}
          </Text>
          <Text style={styles.subtitle}>
            {t(
              "auth:childDeleted.subtitle",
              "Your profile and data have been safely deleted by your parent.",
            )}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <PillButton
            label={t("common:buttons.backToLogin", "Back to Start")}
            onPress={() => router.replace("/")}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  iconBall: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 36,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  buttonContainer: {
    width: "100%",
  },
});
