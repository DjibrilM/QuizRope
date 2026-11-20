import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";
import { apiService } from "../../src/services/api";
import * as guestDb from "../../src/services/guestDb";
import { useGameStore } from "../../src/stores/gameStore";
import { AnimatedLoader } from "../../src/components/common";
import { PillButton } from "../../src/components/ui";
import { FONTS, UI_COLORS, UI_RADII, UI_SHADOWS } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import {
  getDailyCount,
  incrementDailyCount,
  UPLOAD_LIMIT,
} from "../../src/hooks/useHomeworkLimit";
import { hapticsService } from "../../src/services/haptics";

// 1024px maximum dimension keeps Gemini multimodal vision within 1 tile (~258 tokens) while preserving math/handwriting clarity
const MAX_DIMENSION = 1024;

async function compressForAnalysis(
  uri: string,
): Promise<{ uri: string; base64: string }> {
  const imageRef = await ImageManipulator.manipulate(uri)
    .resize({ width: MAX_DIMENSION })
    .renderAsync();
  const result = await imageRef.saveAsync({
    compress: 0.65,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64! };
}

export default function CaptureScreen() {
  const { t } = useTranslation(["homework", "common"]);
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const { userRole, parentUser, guestProfile, locale } = useGameStore();
  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();
  const userId =
    parentUser?._id ?? parentUser?.id ?? guestProfile?.guestId ?? "anonymous";

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const processImage = async (uri: string) => {
    setCompressing(true);
    try {
      const compressed = await compressForAnalysis(uri);
      setCapturedUri(compressed.uri);
      setCapturedBase64(compressed.base64);
    } catch {
      Alert.alert(t("common:errors.error"), t("errors.processFailed"));
    } finally {
      setCompressing(false);
    }
  };

  const handleCapture = async () => {
    hapticsService.medium();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    hapticsService.selection();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const handleRetake = () => {
    hapticsService.selection();
    setCapturedUri(null);
    setCapturedBase64(null);
  };

  const handleSubmit = async () => {
    if (!capturedUri) return;
    hapticsService.medium();

    if (!__DEV__) {
      const count = await getDailyCount(userId);
      if (count >= UPLOAD_LIMIT) {
        Alert.alert(
          t("errors.limitReached"),
          t("errors.limitDesc", { limit: UPLOAD_LIMIT }),
        );
        return;
      }
    }

    setUploading(true);
    try {
      if (userRole === "guest") {
        const result = await apiService.analyzeGuestHomework(capturedUri);
        const sessionId = Crypto.randomUUID();
        await guestDb.saveHomeworkSession({
          id: sessionId,
          title: result.title,
          subject: result.subject,
          status: result.status as any,
          topics: result.topics,
          answersMarkdown: result.answersMarkdown,
          imageBase64: capturedBase64 ?? "",
          imageMimeType: "image/jpeg",
          quizTaken: false,
          linkedMatchIds: [],
          createdAt: Date.now(),
        });
        await incrementDailyCount(userId);
        router.replace(`/homework/session/${sessionId}` as any);
      } else {
        const session = await apiService.analyzeHomework(
          capturedUri,
          undefined,
          childId,
        );
        await incrementDailyCount(userId);
        router.replace(`/homework/processing?sessionId=${session._id}` as any);
      }
    } catch (err: any) {
      console.error("🚨 [Homework Capture Upload Error]:", err);
      setUploading(false);
      Alert.alert(
        t("errors.uploadFailed"),
        err?.message ?? t("common:buttons.tryAgain"),
      );
    }
  };

  if (!permission) {
    return (
      <View style={styles.root}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerStyle: { backgroundColor: "transparent" },
            headerShadowVisible: false,
            title: "",
            headerBackVisible: true,
            headerBackButtonDisplayMode: "minimal",
            headerTintColor: "#FFFFFF",
          }}
        />
      </View>
    );
  }

  if (compressing) {
    return (
      <SafeAreaView style={styles.centerRoot}>
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
        <View style={styles.preparingCard}>
          <AnimatedLoader size="lg" color={UI_COLORS.primary} />
          <Text style={styles.preparingText}>{t("capture.preparing")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Photo review before upload ──────────────────────────────────────────────
  if (capturedUri) {
    const stageHeight = Math.max(
      320,
      winH - insets.top - Math.max(insets.bottom, 12) - 164,
    );

    return (
      <View style={styles.root}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerStyle: { backgroundColor: "transparent" },
            headerShadowVisible: false,
            title: t("session.reviewTitle"),
            headerTitleStyle: {
              fontFamily: headingFont,
              fontSize: 18,
              color: "#FFFFFF",
            },
            headerBackVisible: true,
            headerBackButtonDisplayMode: "minimal",
            headerTintColor: "#FFFFFF",
          }}
        />

        {/* Ambient blurred edge-to-edge backdrop so non-portrait sheets blend smoothly */}
        <Image
          source={{ uri: capturedUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={34}
        />
        <View style={styles.backdropScrim} pointerEvents="none" />

        {/* Edge-to-edge pinch-zoomable photo stage */}
        <ScrollView
          style={styles.previewStage}
          contentContainerStyle={[
            styles.previewStageContent,
            {
              paddingTop: insets.top + 54,
              paddingBottom: Math.max(insets.bottom, 12) + 96,
            },
          ]}
          maximumZoomScale={3}
          minimumZoomScale={1}
          centerContent
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Image
            source={{ uri: capturedUri }}
            style={{ width: winW, height: stageHeight }}
            resizeMode="contain"
          />
        </ScrollView>

        {/* Top header contrast scrim */}
        <LinearGradient
          colors={[
            "rgba(13, 11, 20, 0.85)",
            "rgba(13, 11, 20, 0.42)",
            "rgba(13, 11, 20, 0)",
          ]}
          locations={[0, 0.55, 1]}
          style={[styles.topScrim, { height: insets.top + 78 }]}
          pointerEvents="none"
        />

        {/* Bottom action overlay dock with smooth gradient */}
        <LinearGradient
          colors={[
            "rgba(13, 11, 20, 0)",
            "rgba(13, 11, 20, 0.86)",
            UI_COLORS.bg,
          ]}
          locations={[0, 0.35, 1]}
          style={[
            styles.bottomReviewDock,
            { paddingBottom: Math.max(insets.bottom, 14) + 8 },
          ]}
        >
          <View style={styles.previewDock}>
            <View style={styles.actionSlot}>
              <PillButton
                variant="secondary"
                size="lg"
                label={t("actions.retake")}
                icon={<Ionicons name="refresh" size={17} color="#FFFFFF" />}
                onPress={handleRetake}
                disabled={uploading}
                style={styles.retakePill}
              />
            </View>
            <View style={styles.actionSlot}>
              <PillButton
                variant="primary"
                size="lg"
                label={t("actions.analyze")}
                rightSlot={
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                }
                loading={uploading}
                onPress={handleSubmit}
                style={styles.analyzePill}
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── Camera viewfinder & capture dock ────────────────────────────────────────
  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          title: "",
          headerBackVisible: true,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: "#FFFFFF",
        }}
      />

      {permission.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : null}

      {permission.granted ? (
        <View
          pointerEvents="none"
          style={[
            styles.reticleArea,
            {
              paddingTop: insets.top + 68,
              paddingBottom: Math.max(insets.bottom, 14) + 92,
            },
          ]}
        >
          <View style={styles.reticleFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.permissionWrap,
            {
              paddingTop: insets.top + 68,
              paddingBottom: Math.max(insets.bottom, 14) + 92,
            },
          ]}
        >
          <View style={styles.permissionCard}>
            <View style={styles.permissionHalo}>
              <Ionicons
                name="camera-outline"
                size={28}
                color="#A78BFA"
              />
            </View>
            <Text style={styles.permissionText}>
              {t("capture.allowAccess")}
            </Text>
          </View>
        </View>
      )}

      <View
        style={[
          styles.bottomFloatingDock,
          { paddingBottom: Math.max(insets.bottom, 14) + 8 },
        ]}
      >
        <View style={styles.previewDock}>
          <View style={styles.actionSlot}>
            <PillButton
              variant="secondary"
              size="lg"
              label={t("actions.library")}
              icon={
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={UI_COLORS.textPrimary}
                />
              }
              onPress={handlePickFromGallery}
              style={styles.retakePill}
            />
          </View>
          <View style={styles.actionSlot}>
            <PillButton
              variant="primary"
              size="lg"
              label={t("actions.takePhoto")}
              icon={<Ionicons name="camera" size={18} color="#FFFFFF" />}
              onPress={permission.granted ? handleCapture : requestPermission}
              style={styles.analyzePill}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  centerRoot: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  preparingCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 14,
  },
  preparingText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  backdropScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13, 11, 20, 0.56)",
  },
  previewStage: {
    flex: 1,
  },
  previewStageContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottomReviewDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  bottomFloatingDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  reticleArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  reticleFrame: {
    width: "100%",
    maxWidth: 420,
    flex: 1,
    maxHeight: "92%",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "rgba(255, 255, 255, 0.72)",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 16,
  },
  permissionWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 12,
    maxWidth: 340,
  },
  permissionHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(108, 92, 231, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  previewDock: {
    backgroundColor: "rgba(22, 18, 33, 0.92)",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    padding: 6,
    flexDirection: "row",
    gap: 8,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  actionSlot: {
    flex: 1,
  },
  retakePill: {
    backgroundColor: UI_COLORS.surfaceElevated,
  },
  analyzePill: {
    ...UI_SHADOWS.primaryGlow,
  },
});
