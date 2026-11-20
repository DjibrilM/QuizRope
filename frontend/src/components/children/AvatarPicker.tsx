import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AVATARS, type Avatar } from "../../config/avatars";
import { hapticsService } from "../../services/haptics";
import { AvatarIcon } from "../common/AvatarIcons";
import { FONTS, UI_COLORS } from "../../constants/theme";

interface AvatarTileProps {
  avatarId: string;
  selected: boolean;
  tileSize: number;
  accessibilityLabel: string;
  onSelect: (avatarId: string) => void;
}

function AvatarTile({
  avatarId,
  selected,
  tileSize,
  accessibilityLabel,
  onSelect,
}: AvatarTileProps) {
  const pressScale = useSharedValue(1);
  const checkOpacity = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    checkOpacity.value = withTiming(selected ? 1 : 0, {
      duration: 160,
      easing: Easing.out(Easing.quad),
    });
  }, [selected, checkOpacity]);

  const tileAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: 0.85 + checkOpacity.value * 0.15 }],
  }));

  const innerSize = tileSize - 6;

  return (
    <View style={[styles.tileWrapper, { width: tileSize, height: tileSize }]}>
      <Animated.View style={tileAnimatedStyle}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPressIn={() => {
            pressScale.value = withTiming(0.95, { duration: 90 });
          }}
          onPressOut={() => {
            pressScale.value = withTiming(1, { duration: 140 });
          }}
          onPress={() => {
            hapticsService.selection();
            onSelect(avatarId);
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.tileCircle,
            {
              width: tileSize,
              height: tileSize,
              borderRadius: tileSize / 2,
            },
            selected ? styles.tileCircleSelected : styles.tileCircleDefault,
          ]}
        >
          <AvatarIcon avatarId={avatarId} size={innerSize} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.checkBadge, checkAnimatedStyle]}
      >
        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

interface AvatarPickerProps {
  selected: string;
  onSelect: (avatarId: string) => void;
  avatars?: Avatar[];
  tileSize?: number;
  showTitle?: boolean;
  rightAction?: React.ReactNode;
}

export function AvatarPicker({
  selected,
  onSelect,
  avatars = AVATARS,
  tileSize = 62,
  showTitle = true,
  rightAction,
}: AvatarPickerProps) {
  const { t } = useTranslation(["children", "common"]);

  return (
    <View style={styles.container}>
      {showTitle ? (
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("children:chooseAvatar")}</Text>
          {rightAction}
        </View>
      ) : null}

      <View style={styles.grid}>
        {avatars.map((avatar) => (
          <AvatarTile
            key={avatar.id}
            avatarId={avatar.id}
            selected={selected === avatar.id}
            tileSize={tileSize}
            accessibilityLabel={t("common:accessibility.avatarLabel", {
              name: t(`common:avatars.${avatar.id}`, {
                defaultValue: avatar.label,
              }),
            })}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: UI_COLORS.textSecondary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  tileWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  tileCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1520",
  },
  tileCircleDefault: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tileCircleSelected: {
    borderWidth: 2.5,
    borderColor: UI_COLORS.primary,
  },
  checkBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: UI_COLORS.primary,
    borderWidth: 2,
    borderColor: UI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
