import React, { useCallback, useEffect, useRef, useState } from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { hapticsService } from "../../services/haptics";

interface SessionCodeDisplayProps {
  code: string;
  shareMessage?: string;
}

export function SessionCodeDisplay({
  code,
  shareMessage,
}: SessionCodeDisplayProps) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopied(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    hapticsService.selection();
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }, [code]);

  const handleShare = useCallback(async () => {
    hapticsService.selection();
    try {
      await Share.share({
        message: shareMessage || code,
      });
    } catch {
      // User dismissed share sheet
    }
  }, [code, shareMessage]);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => {
          void handleCopy();
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("buttons.copy")}
        style={styles.codeArea}
      >
        <Text style={styles.label}>{t("labels.sessionCode")}</Text>
        <Text style={styles.code}>{code}</Text>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() => {
            void handleCopy();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={copied ? t("buttons.copied") : t("buttons.copy")}
          style={[styles.actionPill, copied && styles.actionPillCopied]}
        >
          <Ionicons
            name={copied ? "checkmark" : "copy-outline"}
            size={14}
            color={copied ? UI_COLORS.mint : UI_COLORS.textPrimary}
          />
          <Text style={[styles.actionText, copied && styles.actionTextCopied]}>
            {copied ? t("buttons.copied") : t("buttons.copy")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            void handleShare();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("buttons.share")}
          style={styles.actionPill}
        >
          <Ionicons
            name="share-outline"
            size={14}
            color={UI_COLORS.textPrimary}
          />
          <Text style={styles.actionText}>{t("buttons.share")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  codeArea: {
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: UI_COLORS.textMuted,
    textTransform: "uppercase",
  },
  code: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 28,
    letterSpacing: 8,
    color: "#E2D9F3",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: UI_COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  actionPillCopied: {
    backgroundColor: "rgba(52, 211, 153, 0.14)",
    borderColor: "rgba(52, 211, 153, 0.35)",
  },
  actionText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    color: UI_COLORS.textPrimary,
  },
  actionTextCopied: {
    color: UI_COLORS.mint,
  },
});
