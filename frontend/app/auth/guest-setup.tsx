import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import {
  Blur,
  Canvas,
  Group,
  Image as SkiaImage,
  Skia,
  useImage,
} from "@shopify/react-native-skia";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import { apiService } from "../../src/services/api";
import { hapticsService } from "../../src/services/haptics";
import { AVATARS } from "../../src/config/avatars";
import {
  AvatarIcon,
  getAvatarSource,
} from "../../src/components/common/AvatarIcons";
import { AvatarPicker } from "../../src/components/children";
import { AppInput, PillButton } from "../../src/components/ui";
import { FONTS, UI_COLORS } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";

const HERO_INNER_SIZE = 98;

const getRandomAvatar = (exclude?: string) => {
  const pool = exclude
    ? AVATARS.filter((item) => item.id !== exclude)
    : AVATARS;
  return pool[Math.floor(Math.random() * pool.length)].id;
};

function BlurRevealAvatar({
  avatarId,
  size,
}: {
  avatarId: string;
  size: number;
}) {
  const source = getAvatarSource(avatarId);
  const skImage = useImage(source ?? null);
  const blurRadius = useSharedValue(18);
  const revealOpacity = useSharedValue(0.35);
  const revealScale = useSharedValue(0.95);

  const clipPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(size / 2, size / 2, size / 2);
    return path;
  }, [size]);

  useEffect(() => {
    blurRadius.value = 18;
    revealOpacity.value = 0.45;
    revealScale.value = 0.95;

    blurRadius.value = withTiming(0, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    revealOpacity.value = withTiming(1, {
      duration: 320,
      easing: Easing.out(Easing.quad),
    });
    revealScale.value = withTiming(1, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
  }, [avatarId, blurRadius, revealOpacity, revealScale]);

  const animatedWrapStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }],
  }));

  if (!source) {
    return <AvatarIcon avatarId={avatarId} size={size} />;
  }

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: "#1D172B",
        },
        animatedWrapStyle,
      ]}
    >
      {/* Frame-0 placeholder while Skia decodes decoded texture */}
      {!skImage ? (
        <Image
          source={source}
          resizeMode="cover"
          blurRadius={12}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Canvas style={{ width: size, height: size }}>
          <Group clip={clipPath}>
            <SkiaImage
              image={skImage}
              x={0}
              y={0}
              width={size}
              height={size}
              fit="cover"
            >
              <Blur blur={blurRadius} mode="clamp" />
            </SkiaImage>
          </Group>
        </Canvas>
      )}
    </Animated.View>
  );
}

export default function GuestSetupScreen() {
  const { t } = useTranslation(["common", "auth", "children"]);
  usePortrait();

  const { setGuestProfile, setGhostToken, locale } = useGameStore();
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(() => getRandomAvatar());
  const [nameError, setNameError] = useState("");
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const contentTop = Math.max(headerHeight, insets.top + 52) + 8;

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const handleShuffle = () => {
    hapticsService.selection();
    setSelectedAvatar((prev) => getRandomAvatar(prev));
  };

  const handleStart = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("common:errors.nameRequired"));
      return;
    }
    if (trimmed.length > 20) {
      setNameError(t("common:errors.nameTooLong"));
      return;
    }

    hapticsService.success();

    const guestId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `guest-${Date.now()}-${Math.random()}`,
    ).then((h) => h.slice(0, 16));

    setGuestProfile({
      guestId,
      displayName: trimmed,
      avatarId: selectedAvatar,
    });

    apiService
      .registerGhost(guestId, trimmed)
      .then(({ token }) => {
        setGhostToken(token);
        apiService.setGhostToken(token);
      })
      .catch(() => {});

    router.replace("/home");
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          title: "",
          headerBackVisible: true,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: UI_COLORS.textPrimary,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: contentTop },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.mainColumn}>
            {/* Editorial Heading */}
            <View style={styles.heroSection}>
              <Text style={[styles.heading, { fontFamily: headingFont }]}>
                {t("auth:guest.setupTitle")}
              </Text>
              <Text style={styles.subheading}>
                {t("auth:guest.setupSubtitle")}
              </Text>
            </View>

            {/* Clean circular preview with GPU blur-reveal animation */}
            <View style={styles.previewWrap}>
              <View style={styles.previewBall}>
                <BlurRevealAvatar
                  avatarId={selectedAvatar}
                  size={HERO_INNER_SIZE}
                />
              </View>
            </View>

            {/* Avatar Grid */}
            <View style={styles.pickerSection}>
              <AvatarPicker
                selected={selectedAvatar}
                onSelect={setSelectedAvatar}
                tileSize={64}
                rightAction={
                  <TouchableOpacity
                    onPress={handleShuffle}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Randomize avatar"
                    style={styles.shufflePill}
                  >
                    <Ionicons
                      name="shuffle"
                      size={14}
                      color={UI_COLORS.textPrimary}
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            {/* Twende-style Player Name Input */}
            <View style={styles.inputGroup}>
              <AppInput
                label={t("auth:guest.nameLabel")}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (nameError) setNameError("");
                }}
                placeholder={t("auth:guest.namePlaceholder")}
                maxLength={20}
                error={nameError}
                leftIcon={
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={
                      nameError ? UI_COLORS.coral : UI_COLORS.textSecondary
                    }
                  />
                }
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleStart();
                }}
              />
            </View>

            {/* Primary CTA */}
            <PillButton
              label={t("auth:guest.startButton", "Let's Play!")}
              onPress={() => {
                void handleStart();
              }}
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 28,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  heroSection: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 0.4,
    paddingTop: 2,
    color: UI_COLORS.textPrimary,
  },
  subheading: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  previewWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  previewBall: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#1D172B",
    borderWidth: 2.5,
    borderColor: UI_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pickerSection: {
    marginBottom: 24,
  },
  shufflePill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1A1520",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 22,
  },
});
