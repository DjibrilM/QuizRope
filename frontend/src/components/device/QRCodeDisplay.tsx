import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCodeStyled from "react-native-qrcode-styled";
import { useTranslation } from "react-i18next";
import { FONTS, UI_COLORS } from "../../constants/theme";

interface QRCodeDisplayProps {
  sessionToken: string;
  status: "generating" | "ready" | "linked" | "waiting" | "expired";
  linkedLabel?: string;
}

export function QRCodeDisplay({
  sessionToken,
  status,
  linkedLabel,
}: QRCodeDisplayProps) {
  const { t } = useTranslation("common");

  return (
    <View
      style={[
        styles.qrCard,
        status === "linked" && styles.qrCardDarkState,
      ]}
    >
      {status === "generating" ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={UI_COLORS.primary} />
          <Text style={styles.stateHint}>{t("labels.generating")}</Text>
        </View>
      ) : status === "expired" ? (
        <View style={styles.stateBox}>
          <Text style={styles.expiredTitle}>{t("labels.codeExpired")}</Text>
          <Text style={styles.stateHint}>{t("labels.generateNewBelow")}</Text>
        </View>
      ) : status === "linked" ? (
        <View style={styles.stateBox}>
          <View style={styles.linkedHalo}>
            <Ionicons
              name="checkmark-circle"
              size={40}
              color={UI_COLORS.mint}
            />
          </View>
          <Text style={styles.linkedTitle}>{t("labels.linked")}</Text>
          {linkedLabel ? (
            <Text style={styles.linkedSubtitle}>{linkedLabel}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.qrInner}>
          <QRCodeStyled
            data={sessionToken}
            style={{ backgroundColor: "#FFFFFF" }}
            padding={22}
            size={200}
            pieceScale={1.03}
            pieceBorderRadius="42%"
            isPiecesGlued
            color="#161221"
            outerEyesOptions={{
              borderRadius: "28%",
              color: "#161221",
            }}
            innerEyesOptions={{
              borderRadius: "50%",
              color: UI_COLORS.primary,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  qrCard: {
    width: 244,
    height: 244,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  qrCardDarkState: {
    backgroundColor: UI_COLORS.surface,
  },
  qrInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  stateBox: {
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  stateHint: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: "#6B7280",
    textAlign: "center",
  },
  expiredTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 17,
    color: UI_COLORS.coral,
  },
  linkedHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(52, 211, 153, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  linkedTitle: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 20,
    color: UI_COLORS.mint,
    textAlign: "center",
  },
  linkedSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
});
