import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export function ScreenHeader({
  title,
  showBack = true,
  rightElement,
}: ScreenHeaderProps) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();

  if (Platform.OS === "ios") {
    return (
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackVisible: showBack,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: "#FFFFFF",
          ...(rightElement && { headerRight: () => rightElement }),
        }}
      />
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        paddingHorizontal: 16,
        minHeight: 54 + insets.top,
      }}
    >
      <View style={{ width: 48, alignItems: "flex-start" }}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
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
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          style={{
            fontSize: 20,
            color: "#FFFFFF",
            fontFamily: "LuckiestGuy_400Regular",
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      <View style={{ minWidth: 48, alignItems: "flex-end" }}>{rightElement}</View>
    </View>
  );
}
