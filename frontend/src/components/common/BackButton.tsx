import React from "react";
import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BackButtonProps {
  absolute?: boolean;
  onPress?: () => void;
}

export function BackButton({ absolute = false, onPress }: BackButtonProps) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();

  return (
    <View
      style={
        absolute
          ? { position: "absolute", top: insets.top + 8, left: 16, zIndex: 10 }
          : undefined
      }
    >
      <TouchableOpacity
        onPress={onPress || (() => router.back())}
        activeOpacity={0.75}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
        }}
        accessibilityRole="button"
        accessibilityLabel={t("accessibility.goBack")}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 19l-7-7 7-7"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}
