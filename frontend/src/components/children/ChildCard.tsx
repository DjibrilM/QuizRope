import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AvatarIcon } from "../common/AvatarIcons";
import { BouncePress } from "../common/BouncePress";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { hapticsService } from "../../services/haptics";

interface ChildCardProps {
  displayName: string;
  grade: string;
  avatarUrl?: string;
  isLinked?: boolean;
  onLink?: () => void;
  onRemove?: () => void;
  onPress?: () => void;
}

export function ChildCard({
  displayName,
  grade,
  avatarUrl,
  isLinked,
  onLink,
  onRemove,
  onPress,
}: ChildCardProps) {
  const { t } = useTranslation("children");

  const statusPillNode =
    typeof isLinked === "boolean" ? (
      <View
        style={[
          styles.statusPill,
          isLinked
            ? styles.statusPillLinked
            : onLink
              ? styles.statusPillInteractive
              : styles.statusPillUnlinked,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isLinked
              ? styles.statusTextLinked
              : onLink
                ? styles.statusTextInteractive
                : styles.statusTextUnlinked,
          ]}
          numberOfLines={1}
        >
          {isLinked ? t("linkCode.linkedStatus") : t("linkCode.unlinkedStatus")}
        </Text>
      </View>
    ) : null;

  const cardInner = (
    <View
      style={styles.card}
      accessibilityLabel={`${displayName}, ${grade}`}
    >
      <AvatarIcon avatarId={avatarUrl} size={40} />

      <View style={styles.infoCol}>
        <Text style={styles.nameText} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.gradeText} numberOfLines={1}>
          {grade}
        </Text>
      </View>

      <View style={styles.rightCluster}>
        {statusPillNode && onLink ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              hapticsService.selection();
              onLink();
            }}
            hitSlop={8}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t("linkCode.linkChildAccessibility", {
              name: displayName,
            })}
          >
            {statusPillNode}
          </TouchableOpacity>
        ) : (
          statusPillNode
        )}

        {onRemove ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              hapticsService.selection();
              onRemove();
            }}
            hitSlop={10}
            activeOpacity={0.75}
            style={styles.removeBtn}
            accessibilityRole="button"
            accessibilityLabel={t("removeAccessibility", { name: displayName })}
          >
            <Ionicons
              name="trash-outline"
              size={15}
              color="rgba(232, 93, 117, 0.8)"
            />
          </TouchableOpacity>
        ) : null}

        {onPress ? (
          <Ionicons
            name="chevron-forward"
            size={15}
            color={UI_COLORS.textMuted}
          />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <BouncePress
        onPress={() => {
          hapticsService.selection();
          onPress();
        }}
        accessibilityRole="button"
      >
        {cardInner}
      </BouncePress>
    );
  }

  return cardInner;
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 23,
    borderCurve: "continuous",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  gradeText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    borderRadius: UI_RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillLinked: {
    backgroundColor: "rgba(52, 211, 153, 0.14)",
  },
  statusPillInteractive: {
    backgroundColor: UI_COLORS.primarySoft,
  },
  statusPillUnlinked: {
    backgroundColor: UI_COLORS.surfaceElevated,
  },
  statusText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
  },
  statusTextLinked: {
    color: UI_COLORS.mint,
  },
  statusTextInteractive: {
    color: "#C4B5FD",
  },
  statusTextUnlinked: {
    color: UI_COLORS.textSecondary,
  },
  removeBtn: {
    padding: 4,
  },
});
