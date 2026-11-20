import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortrait } from "../../src/hooks/useOrientation";
import { useGameStore } from "../../src/stores/gameStore";
import {
  AnimatedLoader,
  ScreenHeader,
  StaggeredList,
} from "../../src/components/common";
import {
  AddChildForm,
  ChildCard,
  EmptyChildrenState,
  ParentDeviceLinkSheet,
  type ParentDeviceLinkSheetRef,
  type ParentDeviceLinkTarget,
} from "../../src/components/children";
import {
  FloatingBottomSheet,
  FloatingBottomSheetScrollView,
  FloatingBottomSheetView,
  PillButton,
  type FloatingBottomSheetRef,
} from "../../src/components/ui";
import { useTranslation } from "react-i18next";
import { FONTS, UI_COLORS, UI_RADII } from "../../src/constants/theme";
import { getHeadingFont } from "../../src/utils/fontForLocale";
import { apiService } from "../../src/services/api";
import { hapticsService } from "../../src/services/haptics";
import * as LocalAuthentication from "expo-local-authentication";

export default function ChildrenScreen() {
  usePortrait();
  const { t } = useTranslation(["children", "common"]);
  const { setChildren } = useGameStore();
  const queryClient = useQueryClient();
  const bottomSheetRef = useRef<FloatingBottomSheetRef>(null);
  const confirmSheetRef = useRef<FloatingBottomSheetRef>(null);
  const selectChildSheetRef = useRef<FloatingBottomSheetRef>(null);
  const linkSheetRef = useRef<ParentDeviceLinkSheetRef>(null);
  const [removingChild, setRemovingChild] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const {
    data: children = [],
    isLoading,
    isFetched,
    error,
  } = useQuery({
    queryKey: ["children"],
    queryFn: () => apiService.getChildren(),
    select: (data) =>
      data.filter(Boolean).map((c: any) => ({ ...c, id: c._id || c.id })),
  });

  useEffect(() => {
    if (isFetched) {
      setChildren(children);
    }
  }, [isFetched, children, setChildren]);

  const addMutation = useMutation({
    mutationFn: (data: {
      displayName: string;
      grade: string;
      avatarUrl: string;
    }) => apiService.createChild(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      bottomSheetRef.current?.dismiss();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteChild(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      hapticsService.success();
      confirmSheetRef.current?.dismiss();
      setRemovingChild(null);
    },
    onError: () => {
      confirmSheetRef.current?.dismiss();
      setRemovingChild(null);
    },
  });

  const errorMessage =
    (error instanceof Error ? error.message : null) ||
    (addMutation.error instanceof Error ? addMutation.error.message : null) ||
    (deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : null);

  const handleOpenSheet = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleCloseSheet = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleAdd = (data: {
    displayName: string;
    grade: string;
    avatarUrl: string;
  }) => {
    addMutation.mutate(data);
  };

  const handleRemovePress = useCallback(
    (child: { id: string; displayName: string }) => {
      setRemovingChild(child);
      confirmSheetRef.current?.present();
    },
    [],
  );

  const handleConfirmRemove = async () => {
    if (!removingChild) return;

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t(
          "remove.biometricPrompt",
          "Authenticate to delete profile",
        ),
        fallbackLabel: t("remove.usePasscode", "Use Passcode"),
        disableDeviceFallback: false,
      });

      if (!result.success) {
        return;
      }
    }

    deleteMutation.mutate(removingChild.id);
  };

  const handleCancelRemove = useCallback(() => {
    confirmSheetRef.current?.dismiss();
    setRemovingChild(null);
  }, []);

  const openLinkSheetForChild = useCallback(
    (child: ParentDeviceLinkTarget) => {
      selectChildSheetRef.current?.dismiss();
      linkSheetRef.current?.openForChild(child);
    },
    [],
  );

  const visibleChildren = children.filter((c: any) => c?.displayName);
  const hasChildren = visibleChildren.length > 0;

  const handleGetCodePress = useCallback(() => {
    hapticsService.selection();
    if (visibleChildren.length === 0) {
      linkSheetRef.current?.openFamilyInvite();
      return;
    }
    selectChildSheetRef.current?.present();
  }, [visibleChildren.length]);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.root}>
      <ScreenHeader
        title={t("title")}
        rightElement={
          <TouchableOpacity
            onPress={() => {
              hapticsService.selection();
              handleOpenSheet();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("addNewPlayer")}
            style={[
              styles.headerAddPill,
              Platform.OS === "ios" && styles.headerAddPillBare,
            ]}
          >
            <Ionicons name="add" size={16} color={UI_COLORS.textPrimary} />
            <Text style={styles.headerAddText}>{t("addButton")}</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 116 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={17} color={UI_COLORS.coral} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {isLoading && children.length === 0 ? (
            <View style={styles.loaderWrap}>
              <AnimatedLoader size="lg" />
            </View>
          ) : !hasChildren ? (
            <EmptyChildrenState />
          ) : (
            <View style={styles.listShell}>
              <StaggeredList staggerMs={55}>
                {visibleChildren.map((child: any, idx: number) => (
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
                      isLinked={Boolean(child.isLinked)}
                      onLink={() =>
                        openLinkSheetForChild({
                          id: child.id,
                          displayName: child.displayName,
                          avatarUrl: child.avatarUrl,
                          isLinked: Boolean(child.isLinked),
                        })
                      }
                      onPress={() => {
                        router.push({
                          pathname: "/child/stats" as any,
                          params: {
                            childId: child.id,
                            childName: child.displayName,
                            avatarUrl: child.avatarUrl,
                          },
                        });
                      }}
                      onRemove={() =>
                        handleRemovePress({
                          id: child.id,
                          displayName: child.displayName,
                        })
                      }
                    />
                  </View>
                ))}
              </StaggeredList>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Link Guest / Kid bottom bar */}
      <View style={styles.bottomBar}>
        <PillButton
          label={t("linkCode.getCode")}
          onPress={handleGetCodePress}
          size="lg"
        />
      </View>

      {/* Add child bottom sheet */}
      <FloatingBottomSheet
        ref={bottomSheetRef}
        snapPoints={["88%"]}
        enableDynamicSizing={false}
      >
        <FloatingBottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.addSheetScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.addSheetHeader}>
            <Text style={[styles.addSheetTitle, { fontFamily: getHeadingFont() }]}>
              {t("addNewPlayer")}
            </Text>
            <TouchableOpacity
              onPress={handleCloseSheet}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Ionicons
                name="close"
                size={18}
                color={UI_COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <AddChildForm
            onSave={handleAdd}
            onCancel={handleCloseSheet}
            loading={addMutation.isPending}
          />
        </FloatingBottomSheetScrollView>
      </FloatingBottomSheet>

      {/* Remove confirmation bottom sheet */}
      <FloatingBottomSheet ref={confirmSheetRef} enableDynamicSizing>
        <FloatingBottomSheetView style={styles.confirmSheetBody}>
          <View style={styles.removeIconBall}>
            <Ionicons
              name="trash-outline"
              size={25}
              color={UI_COLORS.coral}
            />
          </View>
          <Text style={[styles.confirmTitle, { fontFamily: getHeadingFont() }]}>
            {t("remove.title")}
          </Text>
          <Text style={styles.confirmMessage}>
            {t("remove.message", { name: removingChild?.displayName })}
          </Text>
          <View style={styles.confirmActions}>
            <View style={styles.confirmSlot}>
              <PillButton
                label={t("remove.cancel")}
                variant="secondary"
                size="lg"
                onPress={handleCancelRemove}
              />
            </View>
            <View style={styles.confirmSlot}>
              <PillButton
                label={
                  deleteMutation.isPending
                    ? t("remove.removing")
                    : t("remove.confirm")
                }
                size="lg"
                onPress={handleConfirmRemove}
                loading={deleteMutation.isPending}
                style={styles.removeConfirmBtn}
              />
            </View>
          </View>
        </FloatingBottomSheetView>
      </FloatingBottomSheet>

      {/* Select child or new guest invite bottom sheet */}
      <FloatingBottomSheet ref={selectChildSheetRef} enableDynamicSizing>
        <FloatingBottomSheetView style={styles.sheetBody}>
          <Text style={[styles.sheetHeading, { fontFamily: getHeadingFont() }]}>
            {t("linkCode.selectChild")}
          </Text>
          <View style={styles.sheetList}>
            <TouchableOpacity
              onPress={() => {
                hapticsService.selection();
                selectChildSheetRef.current?.dismiss();
                linkSheetRef.current?.openFamilyInvite();
              }}
              activeOpacity={0.82}
              style={styles.inviteGuestCard}
              accessibilityRole="button"
            >
              <View style={styles.inviteGuestIcon}>
                <Ionicons
                  name="person-add-outline"
                  size={20}
                  color={UI_COLORS.mint}
                />
              </View>
              <View style={styles.inviteGuestTextCol}>
                <Text style={styles.inviteGuestTitle}>
                  {t("linkCode.inviteGuestTitle")}
                </Text>
                <Text style={styles.inviteGuestDesc}>
                  {t("linkCode.inviteGuestDesc")}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={UI_COLORS.textMuted}
              />
            </TouchableOpacity>

            {visibleChildren.map((child: any) => (
              <ChildCard
                key={child.id}
                displayName={child.displayName}
                grade={child.grade}
                avatarUrl={child.avatarUrl}
                isLinked={Boolean(child.isLinked)}
                onPress={() =>
                  openLinkSheetForChild({
                    id: child.id,
                    displayName: child.displayName,
                    avatarUrl: child.avatarUrl,
                    isLinked: Boolean(child.isLinked),
                  })
                }
              />
            ))}
          </View>
        </FloatingBottomSheetView>
      </FloatingBottomSheet>

      {/* Parent Device Link / Unlink Sheet */}
      <ParentDeviceLinkSheet
        ref={linkSheetRef}
        onStatusChange={() => {
          void queryClient.invalidateQueries({ queryKey: ["children"] });
        }}
      />
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
    paddingTop: 12,
  },
  mainColumn: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(232, 93, 117, 0.12)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(232, 93, 117, 0.28)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#F2A7B5",
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
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
  headerAddPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: UI_RADII.pill,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerAddPillBare: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerAddText: {
    color: UI_COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 14,
    backgroundColor: "rgba(13, 11, 20, 0.94)",
    borderTopWidth: 1,
    borderTopColor: UI_COLORS.borderSubtle,
  },
  addSheetScroll: {
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  addSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingTop: 4,
  },
  addSheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: UI_COLORS.textPrimary,
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
  confirmSheetBody: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingBottom: 24,
    paddingTop: 8,
  },
  removeIconBall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(232, 93, 117, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    color: UI_COLORS.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
    marginBottom: 6,
  },
  confirmMessage: {
    color: UI_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: FONTS.body,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  confirmSlot: {
    flex: 1,
  },
  removeConfirmBtn: {
    backgroundColor: UI_COLORS.coral,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  sheetHeading: {
    color: UI_COLORS.textPrimary,
    fontSize: 21,
    lineHeight: 27,
    textAlign: "center",
    marginBottom: 16,
  },
  sheetList: {
    gap: 8,
  },
  inviteGuestCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 211, 153, 0.08)",
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.24)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 4,
  },
  inviteGuestIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(52, 211, 153, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteGuestTextCol: {
    flex: 1,
    gap: 2,
  },
  inviteGuestTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  inviteGuestDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
    color: UI_COLORS.textSecondary,
  },
});
