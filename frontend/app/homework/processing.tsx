import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiService } from "../../src/services/api";
import { AnimatedLoader } from "../../src/components/common";
import { useGameStore } from "../../src/stores/gameStore";
import { FONTS, UI_COLORS } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";

export default function HomeworkProcessingScreen() {
  const { t } = useTranslation(["homework", "common"]);
  const locale = useGameStore((s) => s.locale);
  const STEPS = t("processing.steps", { returnObjects: true }) as string[];
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [stepIndex, setStepIndex] = useState(0);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, Math.max(0, STEPS.length - 1)));
    }, 5000);

    const pollInterval = setInterval(async () => {
      try {
        const session = await apiService.getHomeworkSession(sessionId);
        if (session.status === "READY") {
          clearInterval(pollInterval);
          clearInterval(stepInterval);
          router.replace(`/homework/session/${sessionId}` as any);
        } else if (session.status === "FAILED") {
          console.error("🚨 [Homework Processing Failed]:", session.errorMessage);
          clearInterval(pollInterval);
          clearInterval(stepInterval);
          Alert.alert(
            t("errors.analysisFailed"),
            session.errorMessage ?? t("errors.analysisFailedDesc"),
            [{ text: t("common:buttons.ok"), onPress: () => router.back() }],
          );
        }
      } catch {
        // network blip — keep polling
      }
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      clearInterval(stepInterval);
    };
  }, [STEPS.length, sessionId, t]);

  return (
    <SafeAreaView style={styles.root}>
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

      <View style={styles.center}>
        <View style={styles.shell}>
          <View style={styles.heroTile}>
            <View style={styles.loaderHalo}>
              <AnimatedLoader size="lg" color={UI_COLORS.primary} />
            </View>
            <Text style={[styles.title, { fontFamily: headingFont }]}>
              {t("processing.title")}
            </Text>
            <Text style={styles.hint}>{t("processing.hint")}</Text>
          </View>

          <View style={styles.stepsTile}>
            {STEPS.map((label, idx) => {
              const isDone = idx < stepIndex;
              const isActive = idx === stepIndex;

              return (
                <View key={idx} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      isDone && styles.stepDotDone,
                      isActive && styles.stepDotActive,
                    ]}
                  >
                    {isDone ? (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={UI_COLORS.mint}
                      />
                    ) : isActive ? (
                      <View style={styles.stepPulseCore} />
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.stepLabel,
                      isDone && styles.stepLabelDone,
                      isActive && styles.stepLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  shell: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: UI_COLORS.surface,
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 5,
    gap: 6,
  },
  heroTile: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 25,
    borderCurve: "continuous",
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  loaderHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: UI_COLORS.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  stepsTile: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 25,
    borderCurve: "continuous",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: UI_COLORS.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    backgroundColor: "rgba(52, 211, 153, 0.16)",
  },
  stepDotActive: {
    backgroundColor: "rgba(108, 92, 231, 0.24)",
  },
  stepPulseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI_COLORS.primary,
  },
  stepLabel: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: UI_COLORS.textMuted,
  },
  stepLabelDone: {
    fontFamily: FONTS.bodySemiBold,
    color: UI_COLORS.mint,
  },
  stepLabelActive: {
    fontFamily: FONTS.bodyBold,
    color: UI_COLORS.textPrimary,
  },
});
