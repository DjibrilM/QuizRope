import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConcentricSheetRadius } from "../../../utils/screenRounding";
import { FloatingSheetPortal } from "../FloatingSheetPortal";
import { CollapsedHeader, HandleBar } from "./sub-components";
import {
  CollapsibleBottomSheetProps,
  CollapsibleBottomSheetRef,
  DEFAULT_COLLAPSED_HEIGHT,
  HANDLE_BAR_HEIGHT,
} from "./types";

/**
 * Direct port of Twende's custom CollapsibleBottomSheet architecture (no
 * @gorhom/bottom-sheet and no RN <Modal>): pure Reanimated shared values +
 * Gesture Handler pan physics inside a root portal StyleSheet.absoluteFill overlay.
 */
export const CollapsibleBottomSheet = forwardRef<
  CollapsibleBottomSheetRef,
  CollapsibleBottomSheetProps
>(
  (
    {
      children,
      index = 0,
      snapPoints,
      collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
      collapsedHeader,
      collapsedTitle,
      enablePanDownToClose = true,
      enableDynamicSizing = true,
      enableBackdropDismiss = true,
      detached = true,
      horizontalMargin = 8,
      cornerRadius,
      topInset,
      bottomInset,
      backdropOpacity: backdropTargetOpacity = 0.68,
      style,
      handleIndicatorStyle,
      handleComponent: CustomHandle,
      backgroundStyle,
      className,
      contentContainerClassName,
      contentContainerStyle,
      onChange,
      onDismiss,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();

    const [visible, setVisible] = useState(false);
    const [measuredContentHeight, setMeasuredContentHeight] = useState<number | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const resolvedTopInset = topInset ?? (insets.top > 0 ? insets.top + 8 : 24);
    const baseBottomInset = bottomInset ?? 10;
    const resolvedBottomInset =
      keyboardHeight > 0 ? keyboardHeight + 8 : baseBottomInset;
    const resolvedDetached = detached ?? true;
    const syncedDetachedRadius = useConcentricSheetRadius(horizontalMargin);
    const resolvedCornerRadius =
      cornerRadius ?? (resolvedDetached ? syncedDetachedRadius : 28);

    const availableMaxHeight = Math.max(
      200,
      screenHeight - resolvedTopInset - resolvedBottomInset,
    );

    const snapHeights = useMemo(() => {
      if (!snapPoints || snapPoints.length === 0) return null;
      return snapPoints.map((point) => {
        if (typeof point === "number") {
          return Math.min(availableMaxHeight, point);
        }
        if (typeof point === "string" && point.endsWith("%")) {
          const pct = parseFloat(point) / 100;
          return Math.min(availableMaxHeight, Math.round(screenHeight * pct));
        }
        return Math.min(availableMaxHeight, parseFloat(point) || 350);
      });
    }, [availableMaxHeight, screenHeight, snapPoints]);

    const useDynamicHeight = !snapHeights || (enableDynamicSizing && !snapPoints);

    const expandedHeight = useMemo(() => {
      if (snapHeights && snapHeights.length > 0 && !useDynamicHeight) {
        const clampedIdx = Math.max(0, Math.min(index, snapHeights.length - 1));
        return snapHeights[clampedIdx];
      }
      if (measuredContentHeight && measuredContentHeight > 0) {
        const fitted = measuredContentHeight + HANDLE_BAR_HEIGHT;
        return Math.min(Math.max(120, fitted), availableMaxHeight);
      }
      return Math.min(280, availableMaxHeight);
    }, [availableMaxHeight, index, measuredContentHeight, snapHeights, useDynamicHeight]);

    const maxExpandedHeight = useMemo(() => {
      if (snapHeights && snapHeights.length > 0) {
        return Math.min(availableMaxHeight, snapHeights[snapHeights.length - 1]);
      }
      return expandedHeight;
    }, [availableMaxHeight, expandedHeight, snapHeights]);

    const minSnapHeight = useMemo(() => {
      if (snapHeights && snapHeights.length > 0) {
        return Math.min(availableMaxHeight, snapHeights[0]);
      }
      return enablePanDownToClose ? expandedHeight : collapsedHeight;
    }, [availableMaxHeight, collapsedHeight, enablePanDownToClose, expandedHeight, snapHeights]);

    // Track keyboard height cleanly only while visible
    useEffect(() => {
      if (!visible) {
        setKeyboardHeight(0);
        return;
      }
      const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

      const showSub = Keyboard.addListener(showEvent, (e) => {
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
      });
      const hideSub = Keyboard.addListener(hideEvent, () => {
        setKeyboardHeight(0);
      });

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [visible]);

    // ── Shared animation values (Twende CollapsibleBottomSheet mechanics) ──
    const cardHeight = useSharedValue(expandedHeight);
    const startHeight = useSharedValue(expandedHeight);
    const minHeightSV = useSharedValue(minSnapHeight);
    const maxHeightSV = useSharedValue(maxExpandedHeight);
    const translateY = useSharedValue(screenHeight);
    const backdropAlpha = useSharedValue(0);
    const isDragging = useSharedValue(false);
    const isCollapsedSV = useSharedValue(false);
    const currentIndexSV = useSharedValue(0);

    useEffect(() => {
      minHeightSV.value = minSnapHeight;
      maxHeightSV.value = maxExpandedHeight;
    }, [maxExpandedHeight, maxHeightSV, minHeightSV, minSnapHeight]);

    // Synchronize height smoothly when dynamic content or keyboard changes
    useEffect(() => {
      if (!visible || isDragging.value || isCollapsedSV.value) return;

      const targetH = snapHeights && !useDynamicHeight
        ? snapHeights[Math.min(currentIndexSV.value, snapHeights.length - 1)]
        : expandedHeight;

      if (translateY.value > 10) {
        cardHeight.value = targetH;
        startHeight.value = targetH;
      } else {
        cardHeight.value = withTiming(targetH, {
          duration: 240,
          easing: Easing.out(Easing.cubic),
        });
        startHeight.value = targetH;
      }
    }, [
      cardHeight,
      currentIndexSV,
      expandedHeight,
      isCollapsedSV,
      isDragging,
      snapHeights,
      startHeight,
      translateY,
      useDynamicHeight,
      visible,
    ]);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;
    const isDismissingRef = useRef(false);
    const pendingPresentRef = useRef(false);

    const onDismissFinished = useCallback(() => {
      isDismissingRef.current = false;
      setVisible(false);
      setMeasuredContentHeight(null);
      setKeyboardHeight(0);
      onChangeRef.current?.(-1);
      onDismissRef.current?.();
    }, []);

    const notifySnap = useCallback((idx: number) => {
      onChangeRef.current?.(idx);
    }, []);

    const expand = useCallback(() => {
      isCollapsedSV.value = false;
      const targetH = snapHeights && snapHeights.length > 0
        ? snapHeights[snapHeights.length - 1]
        : expandedHeight;
      const nextIdx = snapHeights ? snapHeights.length - 1 : 0;
      currentIndexSV.value = nextIdx;
      startHeight.value = targetH;
      cardHeight.value = withTiming(targetH, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
      onChangeRef.current?.(nextIdx);
    }, [cardHeight, currentIndexSV, expandedHeight, isCollapsedSV, snapHeights, startHeight]);

    const collapse = useCallback(() => {
      isCollapsedSV.value = true;
      startHeight.value = collapsedHeight;
      cardHeight.value = withTiming(collapsedHeight, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    }, [cardHeight, collapsedHeight, isCollapsedSV, startHeight]);

    const snapToIndex = useCallback(
      (targetIndex: number) => {
        if (!snapHeights || snapHeights.length === 0) {
          expand();
          return;
        }
        const bounded = Math.max(0, Math.min(targetIndex, snapHeights.length - 1));
        const targetH = snapHeights[bounded];
        currentIndexSV.value = bounded;
        isCollapsedSV.value = targetH <= collapsedHeight;
        startHeight.value = targetH;
        cardHeight.value = withTiming(targetH, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        });
        onChangeRef.current?.(bounded);
      },
      [cardHeight, collapsedHeight, currentIndexSV, expand, isCollapsedSV, snapHeights, startHeight],
    );

    const dismiss = useCallback(() => {
      if (!visible || isDismissingRef.current) return;
      isDismissingRef.current = true;
      Keyboard.dismiss();

      backdropAlpha.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(
        screenHeight,
        { duration: 220, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(onDismissFinished)();
          }
        },
      );
    }, [backdropAlpha, onDismissFinished, screenHeight, translateY, visible]);

    const runOpenAnimation = useCallback(() => {
      if (!pendingPresentRef.current) return;
      pendingPresentRef.current = false;

      backdropAlpha.value = withTiming(backdropTargetOpacity, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    }, [backdropAlpha, backdropTargetOpacity, translateY]);

    const present = useCallback(() => {
      isDismissingRef.current = false;
      isCollapsedSV.value = false;
      const startIdx = snapHeights
        ? Math.max(0, Math.min(index, snapHeights.length - 1))
        : 0;
      currentIndexSV.value = startIdx;

      const startH = snapHeights && !useDynamicHeight
        ? snapHeights[startIdx]
        : expandedHeight;

      cardHeight.value = startH;
      startHeight.value = startH;
      translateY.value = screenHeight;
      backdropAlpha.value = 0;
      pendingPresentRef.current = true;
      setVisible(true);
      onChangeRef.current?.(startIdx);
    }, [
      backdropAlpha,
      cardHeight,
      currentIndexSV,
      expandedHeight,
      index,
      isCollapsedSV,
      screenHeight,
      snapHeights,
      startHeight,
      translateY,
      useDynamicHeight,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        present,
        dismiss,
        close: dismiss,
        expand,
        collapse,
        snapToIndex,
        snapToPosition: (pos: number | string) => {
          const pixelVal =
            typeof pos === "number"
              ? Math.min(availableMaxHeight, pos)
              : pos.endsWith("%")
                ? Math.min(availableMaxHeight, (parseFloat(pos) / 100) * screenHeight)
                : Math.min(availableMaxHeight, parseFloat(pos) || 300);
          startHeight.value = pixelVal;
          cardHeight.value = withTiming(pixelVal, { duration: 250 });
        },
      }),
      [
        availableMaxHeight,
        cardHeight,
        collapse,
        dismiss,
        expand,
        present,
        screenHeight,
        snapToIndex,
        startHeight,
      ],
    );

    const hasCollapsible = Boolean(collapsedHeader || collapsedTitle);
    const hasMultiSnap = Boolean(snapHeights && snapHeights.length > 1 && !useDynamicHeight);

    // ── Twende dragDownGesture & dragUpGesture ──
    const dragDownGesture = useMemo(() => {
      return Gesture.Pan()
        .activeOffsetY([-5, 5])
        .onStart(() => {
          "worklet";
          isDragging.value = true;
          startHeight.value = cardHeight.value;
        })
        .onUpdate((event) => {
          "worklet";
          const proposedH = startHeight.value - event.translationY;
          if (hasCollapsible && !enablePanDownToClose) {
            cardHeight.value = Math.max(
              collapsedHeight,
              Math.min(maxHeightSV.value + 30, proposedH),
            );
            return;
          }

          if (proposedH >= minHeightSV.value) {
            translateY.value = 0;
            cardHeight.value = Math.min(maxHeightSV.value + 24, proposedH);
          } else {
            cardHeight.value = minHeightSV.value;
            const overflowDown = minHeightSV.value - proposedH;
            translateY.value = enablePanDownToClose ? overflowDown : overflowDown * 0.25;
          }
        })
        .onEnd((event) => {
          "worklet";
          if (hasCollapsible && !enablePanDownToClose) {
            const expH = maxHeightSV.value;
            const travel = expH - collapsedHeight;
            const isDownwardFlick = event.velocityY > 150;
            const isUpwardFlick = event.velocityY < -150;
            const draggedPast = cardHeight.value < expH - travel * 0.25;
            const shouldExpand = isUpwardFlick || (!isDownwardFlick && !draggedPast);

            if (shouldExpand) {
              isCollapsedSV.value = false;
              cardHeight.value = withTiming(expH, {
                duration: 250,
                easing: Easing.out(Easing.cubic),
              });
              startHeight.value = expH;
            } else {
              isCollapsedSV.value = true;
              cardHeight.value = withTiming(collapsedHeight, {
                duration: 250,
                easing: Easing.out(Easing.cubic),
              });
              startHeight.value = collapsedHeight;
            }
            return;
          }

          if (
            enablePanDownToClose &&
            (translateY.value > 80 || (event.velocityY > 420 && translateY.value > 18))
          ) {
            backdropAlpha.value = withTiming(0, { duration: 180 });
            translateY.value = withTiming(
              screenHeight,
              { duration: 220, easing: Easing.in(Easing.cubic) },
              (finished) => {
                if (finished) {
                  runOnJS(onDismissFinished)();
                }
              },
            );
            return;
          }

          translateY.value = withTiming(0, {
            duration: 240,
            easing: Easing.out(Easing.cubic),
          });

          if (hasMultiSnap) {
            const midpoint = (minHeightSV.value + maxHeightSV.value) / 2;
            const targetIdx =
              event.velocityY < -220
                ? 1
                : event.velocityY > 220
                  ? 0
                  : cardHeight.value >= midpoint
                    ? 1
                    : 0;
            currentIndexSV.value = targetIdx;
            const targetH = targetIdx === 1 ? maxHeightSV.value : minHeightSV.value;
            cardHeight.value = withTiming(targetH, {
              duration: 240,
              easing: Easing.out(Easing.cubic),
            });
            startHeight.value = targetH;
            runOnJS(notifySnap)(targetIdx);
          }
        })
        .onFinalize(() => {
          "worklet";
          isDragging.value = false;
        });
    }, [
      backdropAlpha,
      cardHeight,
      collapsedHeight,
      currentIndexSV,
      enablePanDownToClose,
      hasCollapsible,
      hasMultiSnap,
      isCollapsedSV,
      isDragging,
      maxHeightSV,
      minHeightSV,
      notifySnap,
      onDismissFinished,
      screenHeight,
      startHeight,
      translateY,
    ]);

    const dragUpGesture = useMemo(() => {
      return Gesture.Pan()
        .activeOffsetY([-5, 5])
        .onStart(() => {
          "worklet";
          isDragging.value = true;
          startHeight.value = cardHeight.value;
        })
        .onUpdate((event) => {
          "worklet";
          const newHeight = startHeight.value - event.translationY;
          cardHeight.value = Math.max(
            collapsedHeight,
            Math.min(maxHeightSV.value + 30, newHeight),
          );
        })
        .onEnd((event) => {
          "worklet";
          const expH = maxHeightSV.value;
          const travel = expH - collapsedHeight;
          const isDownwardFlick = event.velocityY > 150;
          const isUpwardFlick = event.velocityY < -150;
          const draggedPast = cardHeight.value > collapsedHeight + travel * 0.25;
          const shouldExpand = isUpwardFlick || (!isDownwardFlick && draggedPast);

          if (shouldExpand) {
            isCollapsedSV.value = false;
            cardHeight.value = withTiming(expH, {
              duration: 250,
              easing: Easing.out(Easing.cubic),
            });
            startHeight.value = expH;
          } else {
            isCollapsedSV.value = true;
            cardHeight.value = withTiming(collapsedHeight, {
              duration: 250,
              easing: Easing.out(Easing.cubic),
            });
            startHeight.value = collapsedHeight;
          }
        })
        .onFinalize(() => {
          "worklet";
          isDragging.value = false;
        });
    }, [
      cardHeight,
      collapsedHeight,
      isCollapsedSV,
      isDragging,
      maxHeightSV,
      startHeight,
    ]);

    // ── Animated styles (Twende CollapsibleBottomSheet) ──
    const animatedCardStyle = useAnimatedStyle(() => {
      if (useDynamicHeight && measuredContentHeight === null) {
        return {
          transform: [{ translateY: translateY.value }],
        };
      }
      return {
        height: cardHeight.value,
        transform: [{ translateY: translateY.value }],
      };
    });

    const animatedBackdropStyle = useAnimatedStyle(() => ({
      opacity: backdropAlpha.value,
    }));

    const expandedContentStyle = useAnimatedStyle(() => {
      if (!hasCollapsible || enablePanDownToClose) {
        return { opacity: 1 };
      }
      const isExpanded = cardHeight.value > collapsedHeight + 25;
      const opacity = interpolate(
        cardHeight.value,
        [collapsedHeight + 30, collapsedHeight + 90],
        [0, 1],
        Extrapolation.CLAMP,
      );
      return {
        opacity,
        zIndex: isExpanded ? 10 : 1,
      };
    });

    const collapsedHeaderStyle = useAnimatedStyle(() => {
      if (!hasCollapsible || enablePanDownToClose) {
        return { opacity: 0, zIndex: 0 };
      }
      const isCollapsed = cardHeight.value <= collapsedHeight + 25;
      const opacity = interpolate(
        cardHeight.value,
        [collapsedHeight, collapsedHeight + 40],
        [1, 0],
        Extrapolation.CLAMP,
      );
      return {
        opacity,
        zIndex: isCollapsed ? 20 : 1,
      };
    });

    const sheetContent = (
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
        onLayout={runOpenAnimation}
      >
        {/* Backdrop */}
        <Animated.View
          pointerEvents={enableBackdropDismiss ? "auto" : "none"}
          style={[styles.backdrop, animatedBackdropStyle]}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={enableBackdropDismiss ? dismiss : undefined}
            accessible={false}
          />
        </Animated.View>

        {/* Floating Card Container */}
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.card,
            {
              bottom: resolvedDetached ? resolvedBottomInset : 0,
              left: resolvedDetached ? horizontalMargin : 0,
              right: resolvedDetached ? horizontalMargin : 0,
              borderRadius: resolvedCornerRadius,
              borderCurve: "continuous",
              maxHeight: availableMaxHeight,
            },
            backgroundStyle,
            style,
            animatedCardStyle,
          ]}
        >
          {hasCollapsible && !enablePanDownToClose && (
            <CollapsedHeader
              collapsedHeader={collapsedHeader}
              collapsedTitle={collapsedTitle}
              collapsedHeaderStyle={collapsedHeaderStyle}
              dragUpGesture={dragUpGesture}
              expand={expand}
            />
          )}

          {/* Expanded Content */}
          <Animated.View
            style={[{ flex: 1, width: "100%" }, expandedContentStyle]}
          >
            <HandleBar
              customHandle={CustomHandle}
              handleIndicatorStyle={handleIndicatorStyle}
              dragDownGesture={dragDownGesture}
            />

            <View
              className={contentContainerClassName || className}
              style={[
                snapHeights && !useDynamicHeight
                  ? { flex: 1, width: "100%" }
                  : { width: "100%" },
                contentContainerStyle,
              ]}
              onLayout={(e) => {
                if (!useDynamicHeight || isDragging.value || isCollapsedSV.value) {
                  return;
                }
                const h = Math.round(e.nativeEvent.layout.height);
                if (h > 0 && Math.abs(h - (measuredContentHeight ?? 0)) > 2) {
                  setMeasuredContentHeight(h);
                }
              }}
            >
              {children}
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    );

    return <FloatingSheetPortal active={visible}>{sheetContent}</FloatingSheetPortal>;
  },
);

CollapsibleBottomSheet.displayName = "CollapsibleBottomSheet";

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  card: {
    position: "absolute",
    backgroundColor: "#16121E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 14,
  },
});

export default CollapsibleBottomSheet;
