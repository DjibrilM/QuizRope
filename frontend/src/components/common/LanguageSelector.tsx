import React, { forwardRef, useCallback } from "react";
import {
  Alert,
  I18nManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, UI_COLORS } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";
import { useConcentricSheetRadius } from "../../utils/screenRounding";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import type { SupportedLanguage } from "../../i18n";
import { useGameStore } from "../../stores/gameStore";
import {
  CollapsibleBottomSheet,
  FloatingBottomSheetScrollView,
  type CollapsibleBottomSheetRef,
} from "../ui/collapsible-bottom-sheet";

export const LanguageSelector = forwardRef<CollapsibleBottomSheetRef>(
  (_props, ref) => {
    const { t } = useTranslation(["common", "auth"]);
    const { locale, setLocale } = useGameStore();
    const insets = useSafeAreaInsets();
    const headingFont = getHeadingFont();
    const sheetRadius = useConcentricSheetRadius(8);
    const innerRowRadius = Math.max(26, Math.round(sheetRadius - 10));

    const dismiss = useCallback(() => {
      if (ref && "current" in ref && ref.current) {
        ref.current.dismiss();
      }
    }, [ref]);

    const handleSelect = useCallback(
      (lang: SupportedLanguage) => {
        Haptics.selectionAsync();
        const needsRtlChange =
          SUPPORTED_LANGUAGES[lang].rtl !== I18nManager.isRTL;

        setLocale(lang);
        dismiss();

        if (needsRtlChange) {
          Alert.alert(
            "",
            "Please restart the app for the layout direction change to take effect.",
            [{ text: t("common:buttons.ok") }],
          );
        }
      },
      [setLocale, dismiss, t],
    );

    const listBottomPad = Math.max(12, Math.round(insets.bottom * 0.45));

    return (
      <CollapsibleBottomSheet
        ref={ref}
        snapPoints={["78%", "88%"]}
        enableDynamicSizing={false}
        horizontalMargin={8}
      >
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={[styles.headerTitle, { fontFamily: headingFont }]}>
              {t("common:labels.language", "Language")}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t("common:labels.selectLanguage", "Select preferred language")}
            </Text>
          </View>

          <TouchableOpacity
            onPress={dismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("common:accessibility.closeModal")}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={UI_COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <FloatingBottomSheetScrollView
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {(Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]).map(
            (lang) => {
              const { label, nativeLabel } = SUPPORTED_LANGUAGES[lang];
              const isSelected = locale === lang;

              return (
                <TouchableOpacity
                  key={lang}
                  onPress={() => handleSelect(lang)}
                  activeOpacity={0.82}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.row,
                    { borderRadius: innerRowRadius },
                    isSelected ? styles.rowSelected : styles.rowUnselected,
                  ]}
                >
                  <View style={styles.labelGroup}>
                    <Text
                      style={[
                        styles.nativeLabel,
                        {
                          color: isSelected
                            ? UI_COLORS.textOnPrimary
                            : UI_COLORS.textPrimary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {nativeLabel}
                    </Text>
                    <Text
                      style={[
                        styles.englishLabel,
                        {
                          color: isSelected
                            ? UI_COLORS.textSubtleOnPrimary
                            : UI_COLORS.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radioOuter,
                      isSelected
                        ? styles.radioOuterSelected
                        : styles.radioOuterUnselected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInnerDot} />}
                  </View>
                </TouchableOpacity>
              );
            },
          )}
        </FloatingBottomSheetScrollView>
      </CollapsibleBottomSheet>
    );
  },
);

LanguageSelector.displayName = "LanguageSelector";

const styles = StyleSheet.create({
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    paddingTop: 2,
    color: UI_COLORS.textPrimary,
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: UI_COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#241D2E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 10,
    gap: 6,
  },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 16,
    height: 52,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  rowUnselected: {
    backgroundColor: "#211A2B",
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  rowSelected: {
    backgroundColor: UI_COLORS.primary,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  labelGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    marginRight: 12,
    gap: 8,
  },
  nativeLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },
  englishLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterUnselected: {
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  radioOuterSelected: {
    borderColor: "#FFFFFF",
  },
  radioInnerDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
});
