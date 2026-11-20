import React, { forwardRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, UI_COLORS } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { TERMS_AND_CONDITIONS } from "../../constants/terms";
import {
  FloatingBottomSheet,
  FloatingBottomSheetScrollView,
  type FloatingBottomSheetRef,
} from "../ui";

/**
 * Shared floating Terms & Privacy bottom sheet used across onboarding/auth screens.
 */
export const TermsSheet = forwardRef<FloatingBottomSheetRef>((_props, ref) => {
  const { t } = useTranslation(["auth", "common"]);
  const headingFont = getHeadingFont();

  const dismiss = () => {
    if (ref && "current" in ref && ref.current) {
      ref.current.dismiss();
    }
  };

  return (
    <FloatingBottomSheet
      ref={ref}
      snapPoints={["86%"]}
      enableDynamicSizing={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: headingFont }]}>
          {t("auth:roleSelect.termsTitle")}
        </Text>
        <TouchableOpacity
          onPress={dismiss}
          activeOpacity={0.8}
          style={styles.closePill}
          accessibilityRole="button"
          accessibilityLabel={t("common:accessibility.closeModal")}
        >
          <Ionicons name="close" size={18} color={UI_COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <FloatingBottomSheetScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Markdown
          mergeStyle={true}
          style={{
            body: {
              color: "#E5E7EB",
              fontFamily: FONTS.body,
              fontSize: 15,
              lineHeight: 24,
            },
            heading1: {
              color: "#FFFFFF",
              fontFamily: headingFont,
              fontSize: 24,
              marginTop: 16,
              marginBottom: 8,
            },
            heading2: {
              color: "#FFFFFF",
              fontFamily: headingFont,
              fontSize: 20,
              marginTop: 16,
              marginBottom: 8,
            },
            heading3: {
              color: "#FFFFFF",
              fontFamily: FONTS.bodyBold,
              fontSize: 17,
              marginTop: 12,
              marginBottom: 6,
            },
            paragraph: { marginBottom: 16 },
            link: { color: "#A78BFA", textDecorationLine: "underline" },
            list_item: { marginBottom: 8 },
            bullet_list: { marginBottom: 16 },
            hr: {
              backgroundColor: UI_COLORS.borderSubtle,
              height: 1,
              marginVertical: 24,
            },
            strong: { fontFamily: FONTS.bodyBold, color: "#FFFFFF" },
          }}
        >
          {TERMS_AND_CONDITIONS}
        </Markdown>
        <View style={{ height: 24 }} />
      </FloatingBottomSheetScrollView>
    </FloatingBottomSheet>
  );
});

TermsSheet.displayName = "TermsSheet";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    paddingTop: 2,
    color: UI_COLORS.textPrimary,
    letterSpacing: 0.4,
  },
  closePill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#241D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
