import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePortrait } from "../src/hooks/useOrientation";
import { apiService } from "../src/services/api";
import { hapticsService } from "../src/services/haptics";
import { useGameStore } from "../src/stores/gameStore";
import {
  AnimatedLoader,
  ScreenHeader,
  StaggeredList,
} from "../src/components/common";
import { QRCodeDisplay, SessionCodeDisplay } from "../src/components/device";
import {
  AddChildForm,
  ChildCard,
  EmptyChildrenState,
} from "../src/components/children";
import { PillButton } from "../src/components/ui";
import { FONTS, UI_COLORS } from "../src/constants/theme";
import { getHeadingFont } from "../src/utils/fontForLocale";

type Status =
  | "loading"
  | "select-child"
  | "adding-child"
  | "authorizing"
  | "showing-code"
  | "error";

interface ChildProfile {
  id: string;
  _id?: string;
  displayName: string;
  grade: string;
  avatarUrl?: string;
}

export default function ConnectDeviceScreen() {
  const { t } = useTranslation(["device", "common", "children"]);
  usePortrait();
  const locale = useGameStore((s) => s.locale);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildName, setSelectedChildName] = useState("");
  const [isCreatingChild, setIsCreatingChild] = useState(false);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initialize = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const [sessionResult, childrenResult] = await Promise.all([
        apiService.createQRSession(),
        apiService.getChildren(),
      ]);
      if (!mountedRef.current) return;
      setSessionToken(sessionResult.sessionToken);
      setChildren(
        childrenResult.map((c: any) => ({ ...c, id: c._id || c.id })),
      );
      setStatus("select-child");
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message || "Failed to set up session");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleSelectChild = useCallback(
    async (child: ChildProfile) => {
      setStatus("authorizing");
      setSelectedChildName(child.displayName);
      try {
        await apiService.authorizeChildSession(
          sessionToken,
          child._id || child.id,
        );
        hapticsService.success();
        setStatus("showing-code");
      } catch (err: any) {
        setError(err.message || "Failed to authorize session");
        setStatus("error");
      }
    },
    [sessionToken],
  );

  const handleAddChild = useCallback(
    async (data: {
      displayName: string;
      grade: string;
      avatarUrl: string;
    }) => {
      setIsCreatingChild(true);
      setSelectedChildName(data.displayName);
      try {
        const newChild = await apiService.createChild(data);
        setStatus("authorizing");
        await apiService.authorizeChildSession(sessionToken, newChild._id);
        hapticsService.success();
        setStatus("showing-code");
      } catch (err: any) {
        setError(err.message || "Failed to create child or authorize session");
        setStatus("error");
      } finally {
        setIsCreatingChild(false);
      }
    },
    [sessionToken],
  );

  const visibleChildren = children.filter((c) => c?.displayName);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <ScreenHeader title={t("device:connectDevice.title")} />

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {status === "loading" ? (
            <View style={styles.centerBlock}>
              <AnimatedLoader
                size="lg"
                message={t("device:connectDevice.loadingMessage")}
              />
            </View>
          ) : null}

          {status === "select-child" ? (
            <View style={styles.sectionBlock}>
              <View style={styles.heroBlock}>
                <Text style={[styles.heading, { fontFamily: headingFont }]}>
                  {t("device:connectDevice.selectChildTitle")}
                </Text>
                <Text style={styles.subheading}>
                  {t("device:connectDevice.selectChildInstruction")}
                </Text>
              </View>

              {visibleChildren.length === 0 ? (
                <EmptyChildrenState />
              ) : (
                <View style={styles.listShell}>
                  <StaggeredList staggerMs={50}>
                    {visibleChildren.map((child, idx) => (
                      <View
                        key={child.id}
                        style={
                          idx < visibleChildren.length - 1
                            ? styles.cardGap
                            : undefined
                        }
                      >
                        <ChildCard
                          displayName={child.displayName}
                          grade={child.grade}
                          avatarUrl={child.avatarUrl}
                          onPress={() => {
                            void handleSelectChild(child);
                          }}
                        />
                      </View>
                    ))}
                  </StaggeredList>
                </View>
              )}

              <View style={styles.addBtnWrap}>
                <PillButton
                  label={t("children:addNewPlayer")}
                  onPress={() => setStatus("adding-child")}
                  size="lg"
                  icon={<Ionicons name="add" size={18} color="#FFFFFF" />}
                />
              </View>
            </View>
          ) : null}

          {status === "adding-child" ? (
            <View style={styles.sectionBlock}>
              <Text
                style={[
                  styles.heading,
                  styles.sectionTitleSpacing,
                  { fontFamily: headingFont },
                ]}
              >
                {t("device:connectDevice.newPlayerTitle")}
              </Text>
              <AddChildForm
                onSave={(data) => {
                  void handleAddChild(data);
                }}
                onCancel={() => setStatus("select-child")}
                loading={isCreatingChild}
              />
            </View>
          ) : null}

          {status === "authorizing" ? (
            <View style={styles.centerBlock}>
              <AnimatedLoader
                size="lg"
                message={t("device:connectDevice.settingUpSession", {
                  name: selectedChildName,
                })}
              />
            </View>
          ) : null}

          {status === "showing-code" ? (
            <View style={styles.codeBlock}>
              <View style={styles.heroBlock}>
                <Text style={[styles.headingCenter, { fontFamily: headingFont }]}>
                  {t("device:connectDevice.showCodeTitle")}
                </Text>
                <Text style={styles.subheadingCenter}>
                  {t("device:connectDevice.showCodeInstruction", {
                    name: selectedChildName,
                  })}
                </Text>
              </View>

              <QRCodeDisplay sessionToken={sessionToken} status="waiting" />
              <SessionCodeDisplay
                code={sessionToken}
                shareMessage={t("children:linkCode.shareMessage", {
                  code: sessionToken,
                  name: selectedChildName,
                })}
              />
            </View>
          ) : null}

          {status === "error" ? (
            <View style={styles.stateCard}>
              <View style={styles.errorHalo}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color={UI_COLORS.coral}
                />
              </View>
              <Text style={styles.stateTitle}>
                {t("device:connectDevice.errorTitle")}
              </Text>
              <Text style={styles.stateSub}>{error}</Text>
              <PillButton
                label={t("common:buttons.tryAgain")}
                onPress={() => {
                  void initialize();
                }}
                size="default"
                style={styles.retryBtn}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
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
    paddingTop: 14,
    paddingBottom: 36,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    flexGrow: 1,
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  sectionBlock: {
    width: "100%",
  },
  heroBlock: {
    marginBottom: 20,
  },
  sectionTitleSpacing: {
    marginBottom: 18,
  },
  heading: {
    fontSize: 28,
    lineHeight: 35,
    color: UI_COLORS.textPrimary,
  },
  headingCenter: {
    fontSize: 26,
    lineHeight: 33,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  subheading: {
    marginTop: 5,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
  },
  subheadingCenter: {
    marginTop: 5,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  listShell: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    padding: 5,
  },
  cardGap: {
    marginBottom: 6,
  },
  addBtnWrap: {
    marginTop: 18,
  },
  codeBlock: {
    alignItems: "center",
    paddingTop: 6,
  },
  stateCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  errorHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(232, 93, 117, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  stateSub: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    minWidth: 160,
  },
});
