import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import { apiService } from "../../services/api";
import { hapticsService } from "../../services/haptics";
import { socketService } from "../../services/socket";
import { useGameStore } from "../../stores/gameStore";
import { AnimatedLoader, AvatarIcon } from "../common";
import { QRCodeDisplay, SessionCodeDisplay } from "../device";
import {
  FloatingBottomSheet,
  FloatingBottomSheetView,
  PillButton,
  type FloatingBottomSheetRef,
} from "../ui";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";
import { getHeadingFont } from "../../utils/fontForLocale";

export interface ParentDeviceLinkTarget {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isLinked?: boolean;
}

export interface ParentDeviceLinkSheetRef {
  openForChild: (child: ParentDeviceLinkTarget) => void;
  openFamilyInvite: (displayLabel?: string) => void;
  dismiss: () => void;
}

interface ParentDeviceLinkSheetProps {
  onStatusChange?: () => void;
}

type SheetMode = "manage" | "code" | "confirm-unlink";

/**
 * Parent invitation & device management modal:
 * - Generates 1-minute (60s) QR + 6-character invitation codes (either for a
 *   specific child profile OR as a general Family Hub invite for an offline guest)
 * - Auto-rotates to a fresh code cleanly when the 60s TTL reaches 0 while open
 * - Shows live Socket.IO confirmation ("Linked!") when the kid joins
 * - Allows viewing linked status and unlinking a device safely without losing data
 */
export const ParentDeviceLinkSheet = forwardRef<
  ParentDeviceLinkSheetRef,
  ParentDeviceLinkSheetProps
>(function ParentDeviceLinkSheet({ onStatusChange }, ref) {
  const { t } = useTranslation(["children", "common"]);
  const { showError } = useToast();
  const locale = useGameStore((s) => s.locale);
  const sheetRef = useRef<FloatingBottomSheetRef>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSheetOpenRef = useRef(false);
  const autoRefreshingRef = useRef(false);

  const [targetChild, setTargetChild] = useState<ParentDeviceLinkTarget | null>(
    null,
  );
  const [mode, setMode] = useState<SheetMode>("code");
  const [codeResult, setCodeResult] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoRefreshFailed, setAutoRefreshFailed] = useState(false);
  const [codeLinked, setCodeLinked] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const headingFont = (() => {
    void locale;
    return getHeadingFont();
  })();

  const generateCode = useCallback(
    async (childId?: string, silent = false) => {
      if (!silent) {
        setIsGenerating(true);
      }
      setMode("code");
      setCodeLinked(false);
      setAutoRefreshFailed(false);
      if (!silent) {
        setCodeResult(null);
      }
      try {
        const result = await apiService.generateGuestLinkCode(childId);
        if (!isSheetOpenRef.current) return;
        setCodeResult(result);
        if (!silent) {
          hapticsService.success();
        }
      } catch {
        if (!isSheetOpenRef.current) return;
        if (silent) {
          setAutoRefreshFailed(true);
        } else {
          showError(
            t("children:linkCode.errorBody"),
            t("children:linkCode.errorTitle"),
          );
          sheetRef.current?.dismiss();
        }
      } finally {
        setIsGenerating(false);
        autoRefreshingRef.current = false;
      }
    },
    [showError, t],
  );

  useImperativeHandle(
    ref,
    () => ({
      openForChild: (child: ParentDeviceLinkTarget) => {
        isSheetOpenRef.current = true;
        autoRefreshingRef.current = false;
        setTargetChild(child);
        setCodeLinked(false);
        setAutoRefreshFailed(false);
        setIsUnlinking(false);
        if (child.isLinked) {
          setCodeResult(null);
          setMode("manage");
          sheetRef.current?.present();
        } else {
          sheetRef.current?.present();
          void generateCode(child.id, false);
        }
      },
      openFamilyInvite: () => {
        isSheetOpenRef.current = true;
        autoRefreshingRef.current = false;
        setTargetChild(null);
        setCodeLinked(false);
        setAutoRefreshFailed(false);
        setIsUnlinking(false);
        sheetRef.current?.present();
        void generateCode(undefined, false);
      },
      dismiss: () => {
        isSheetOpenRef.current = false;
        sheetRef.current?.dismiss();
      },
    }),
    [generateCode],
  );

  // 1-minute countdown & automatic code rotation when TTL expires while sheet is open
  useEffect(() => {
    if (!codeResult || mode !== "code" || codeLinked) return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(codeResult.expiresAt).getTime() - Date.now()) / 1000,
        ),
      );
      setSecondsLeft(remaining);

      if (
        remaining <= 0 &&
        isSheetOpenRef.current &&
        !autoRefreshingRef.current &&
        !autoRefreshFailed
      ) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        autoRefreshingRef.current = true;
        void generateCode(targetChild?.id, true);
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [
    codeResult,
    mode,
    codeLinked,
    autoRefreshFailed,
    targetChild?.id,
    generateCode,
  ]);

  // Real-time Socket.IO listener + fallback status poll while waiting
  useEffect(() => {
    if (
      mode !== "code" ||
      !codeResult?.code ||
      codeLinked ||
      secondsLeft <= 0
    ) {
      return;
    }

    const code = codeResult.code;
    const socket = socketService.connect();

    const joinCodeRoom = () => {
      socket.emit("session:watch", { sessionToken: code });
    };

    const markLinked = () => {
      setCodeLinked((prev) => {
        if (!prev) {
          hapticsService.success();
          onStatusChange?.();
        }
        return true;
      });
    };

    joinCodeRoom();
    socket.on("connect", joinCodeRoom);
    socket.on("guest-link:redeemed", markLinked);
    socket.on("session:authorized", markLinked);

    const pollTimer = setInterval(async () => {
      try {
        const res = await apiService.getGuestLinkStatus(code);
        if (res.used) {
          markLinked();
        }
      } catch {
        // Ignore transient poll errors while waiting
      }
    }, 3500);

    return () => {
      socket.off("connect", joinCodeRoom);
      socket.off("guest-link:redeemed", markLinked);
      socket.off("session:authorized", markLinked);
      clearInterval(pollTimer);
    };
  }, [mode, codeResult?.code, codeLinked, secondsLeft, onStatusChange]);

  const handleConfirmUnlink = useCallback(async () => {
    if (!targetChild) return;
    setIsUnlinking(true);
    try {
      await apiService.unlinkChild(targetChild.id);
      hapticsService.success();
      onStatusChange?.();
      sheetRef.current?.dismiss();
    } catch {
      hapticsService.error();
      showError(
        t("children:linkCode.unlinkError"),
        t("common:errors.error"),
      );
    } finally {
      setIsUnlinking(false);
    }
  }, [targetChild, onStatusChange, showError, t]);

  const handleDismiss = useCallback(() => {
    isSheetOpenRef.current = false;
    autoRefreshingRef.current = false;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCodeResult(null);
    setCodeLinked(false);
    setAutoRefreshFailed(false);
    setIsGenerating(false);
    setIsUnlinking(false);
  }, []);

  const codeTitle = targetChild
    ? t("children:linkCode.title", { name: targetChild.displayName })
    : t("children:linkCode.familyInviteTitle");

  const shareText = targetChild
    ? t("children:linkCode.shareMessage", {
        code: codeResult?.code ?? "",
        name: targetChild.displayName,
      })
    : codeResult?.code;

  return (
    <FloatingBottomSheet
      ref={sheetRef}
      enableDynamicSizing
      onDismiss={handleDismiss}
    >
      <FloatingBottomSheetView style={styles.sheetBody}>
        {mode === "manage" && targetChild ? (
          <View style={styles.centerBlock}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={[styles.title, { fontFamily: headingFont }]}>
                {t("children:linkCode.manageTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => sheetRef.current?.dismiss()}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t("common:buttons.close")}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={UI_COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePill}>
              <View style={styles.avatarRing}>
                <AvatarIcon avatarId={targetChild.avatarUrl} size={46} />
              </View>
              <View style={styles.profileCol}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {targetChild.displayName}
                </Text>
                <View style={styles.linkedBadge}>
                  <Ionicons
                    name="phone-portrait"
                    size={11}
                    color={UI_COLORS.mint}
                  />
                  <Text style={styles.linkedBadgeText}>
                    {t("children:linkCode.linkedStatus")}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.manageSubtitle}>
              {t("children:linkCode.manageSubtitle", {
                name: targetChild.displayName,
              })}
            </Text>

            <View style={styles.actionsStack}>
              <PillButton
                label={t("children:linkCode.getNewCode")}
                onPress={() => {
                  void generateCode(targetChild.id, false);
                }}
                size="lg"
              />
              <PillButton
                variant="secondary"
                label={t("children:linkCode.unlinkDevice")}
                onPress={() => {
                  hapticsService.selection();
                  setMode("confirm-unlink");
                }}
                size="lg"
                icon={
                  <Ionicons
                    name="unlink-outline"
                    size={18}
                    color={UI_COLORS.coral}
                  />
                }
                style={styles.unlinkOutlineBtn}
              />
            </View>
          </View>
        ) : null}

        {mode === "confirm-unlink" && targetChild ? (
          <View style={styles.centerBlock}>
            <View style={styles.unlinkHalo}>
              <Ionicons
                name="unlink-outline"
                size={26}
                color={UI_COLORS.coral}
              />
            </View>
            <Text style={[styles.title, { fontFamily: headingFont }]}>
              {t("children:linkCode.unlinkConfirmTitle", {
                name: targetChild.displayName,
              })}
            </Text>
            <Text style={styles.confirmSubtitle}>
              {t("children:linkCode.unlinkConfirmBody")}
            </Text>
            <View style={styles.confirmActions}>
              <View style={styles.confirmSlot}>
                <PillButton
                  label={t("common:buttons.cancel")}
                  variant="secondary"
                  size="lg"
                  onPress={() => setMode("manage")}
                  disabled={isUnlinking}
                />
              </View>
              <View style={styles.confirmSlot}>
                <PillButton
                  label={
                    isUnlinking
                      ? t("children:linkCode.unlinking")
                      : t("children:linkCode.unlinkConfirmCta")
                  }
                  size="lg"
                  loading={isUnlinking}
                  onPress={() => {
                    void handleConfirmUnlink();
                  }}
                  style={styles.unlinkConfirmBtn}
                />
              </View>
            </View>
          </View>
        ) : null}

        {mode === "code" ? (
          <View style={styles.centerBlock}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text
                style={[styles.title, { fontFamily: headingFont }]}
                numberOfLines={1}
              >
                {codeTitle}
              </Text>
              <TouchableOpacity
                onPress={() => sheetRef.current?.dismiss()}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t("common:buttons.close")}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={UI_COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {isGenerating || !codeResult ? (
              <View style={styles.loadingBox}>
                <AnimatedLoader size="lg" />
              </View>
            ) : codeLinked ? (
              <>
                <QRCodeDisplay
                  sessionToken={codeResult.code}
                  status="linked"
                  linkedLabel={
                    targetChild
                      ? t("children:linkCode.connectedDevice", {
                          name: targetChild.displayName,
                        })
                      : t("children:linkCode.connectedGuest")
                  }
                />
                <PillButton
                  label={t("common:buttons.done")}
                  onPress={() => sheetRef.current?.dismiss()}
                  size="lg"
                  style={styles.fullWidthBtn}
                />
              </>
            ) : autoRefreshFailed && secondsLeft <= 0 ? (
              <>
                <Text style={[styles.countdownText, styles.countdownWarn]}>
                  {t("children:linkCode.expired")}
                </Text>
                <QRCodeDisplay
                  sessionToken={codeResult.code}
                  status="expired"
                />
                <PillButton
                  label={t("children:linkCode.generateNew")}
                  onPress={() => {
                    void generateCode(targetChild?.id, false);
                  }}
                  loading={isGenerating}
                  size="lg"
                  style={styles.fullWidthBtn}
                />
              </>
            ) : (
              <>
                <Text
                  style={[
                    styles.countdownText,
                    secondsLeft <= 15 && styles.countdownWarn,
                  ]}
                >
                  {secondsLeft <= 0
                    ? t("children:linkCode.autoRefreshing")
                    : t("children:linkCode.expiresSeconds", {
                        seconds: secondsLeft,
                      })}
                </Text>

                <QRCodeDisplay
                  sessionToken={codeResult.code}
                  status="waiting"
                />
                <SessionCodeDisplay
                  code={codeResult.code}
                  shareMessage={shareText || codeResult.code}
                />
                <View style={styles.stepsCard}>
                  <Text style={styles.stepText}>
                    {t("children:linkCode.stepOne")}
                  </Text>
                  <Text style={styles.stepText}>
                    {t("children:linkCode.stepTwo")}
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : null}
      </FloatingBottomSheetView>
    </FloatingBottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 6,
  },
  centerBlock: {
    alignItems: "center",
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  headerSpacer: {
    width: 34,
  },
  title: {
    flex: 1,
    color: UI_COLORS.textPrimary,
    fontSize: 21,
    lineHeight: 27,
    textAlign: "center",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  profilePill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    padding: 12,
    gap: 12,
    marginTop: 8,
    marginBottom: 14,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#141020",
    borderWidth: 1.5,
    borderColor: "rgba(108, 92, 231, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileCol: {
    flex: 1,
    alignItems: "flex-start",
    gap: 5,
  },
  profileName: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 16,
    color: UI_COLORS.textPrimary,
  },
  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.28)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: UI_RADII.pill,
  },
  linkedBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: UI_COLORS.mint,
  },
  manageSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  actionsStack: {
    width: "100%",
    gap: 10,
  },
  unlinkOutlineBtn: {
    borderColor: "rgba(232, 93, 117, 0.28)",
  },
  unlinkHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(232, 93, 117, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    marginTop: 6,
  },
  confirmSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 22,
  },
  confirmActions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  confirmSlot: {
    flex: 1,
  },
  unlinkConfirmBtn: {
    backgroundColor: UI_COLORS.coral,
  },
  loadingBox: {
    paddingVertical: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13.5,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 14,
  },
  countdownWarn: {
    color: UI_COLORS.coral,
  },
  stepsCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    marginTop: 4,
  },
  stepText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    color: UI_COLORS.textSecondary,
  },
  fullWidthBtn: {
    width: "100%",
    marginTop: 6,
  },
});
