import React, { useEffect, useState } from "react";
import { I18nManager, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { hapticsService } from "../../services/haptics";
import { FONTS, UI_COLORS, UI_RADII } from "../../constants/theme";

const ROUND_OPTIONS = [5, 10, 15, 20];
const SEGMENT_PAD = 4;
const SEGMENT_GAP = 4;

interface RoundSegmentItemProps {
  value: number;
  index: number;
  selected: boolean;
  activeIndex: SharedValue<number>;
  accessibilityLabel: string;
  onPress: () => void;
}

function RoundSegmentItem({
  value,
  index,
  selected,
  activeIndex,
  accessibilityLabel,
  onPress,
}: RoundSegmentItemProps) {
  const labelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(activeIndex.value - index);
    const activeAmount = Math.max(0, 1 - distance);
    return {
      color: interpolateColor(
        activeAmount,
        [0, 1],
        [UI_COLORS.textSecondary, "#FFFFFF"],
      ),
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={styles.segmentButton}
    >
      <Animated.Text
        style={[
          styles.segmentLabel,
          selected && styles.segmentLabelSelected,
          labelStyle,
        ]}
      >
        {value}
      </Animated.Text>
    </TouchableOpacity>
  );
}

interface RoundsSelectorProps {
  selected: number;
  onSelect: (rounds: number) => void;
}

export function RoundsSelector({ selected, onSelect }: RoundsSelectorProps) {
  const { t } = useTranslation(["match", "common"]);
  const [shellWidth, setShellWidth] = useState(0);

  const selectedIdx = Math.max(0, ROUND_OPTIONS.indexOf(selected));
  const activeIndex = useSharedValue(selectedIdx);

  useEffect(() => {
    activeIndex.value = withTiming(selectedIdx, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [selectedIdx, activeIndex]);

  const slotWidth =
    shellWidth > 0
      ? (shellWidth -
          SEGMENT_PAD * 2 -
          SEGMENT_GAP * (ROUND_OPTIONS.length - 1)) /
        ROUND_OPTIONS.length
      : 0;

  const isRtl = I18nManager.isRTL;
  const sliderAnimatedStyle = useAnimatedStyle(() => ({
    width: slotWidth,
    transform: [
      {
        translateX:
          (isRtl ? -1 : 1) * activeIndex.value * (slotWidth + SEGMENT_GAP),
      },
    ],
  }));

  const handleSelect = (r: number) => {
    if (selected === r) return;
    hapticsService.selection();
    onSelect(r);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{t("match:selectors.rounds")}</Text>
        <Text style={styles.countHint}>
          {t("common:accessibility.roundsLabel", { count: selected })}
        </Text>
      </View>

      <View
        style={styles.segmentedShell}
        onLayout={(e) => setShellWidth(e.nativeEvent.layout.width)}
      >
        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.slidingPill, sliderAnimatedStyle]}
          />
        ) : null}

        {ROUND_OPTIONS.map((r, index) => (
          <RoundSegmentItem
            key={r}
            value={r}
            index={index}
            selected={selected === r}
            activeIndex={activeIndex}
            accessibilityLabel={t("common:accessibility.roundsLabel", {
              count: r,
            })}
            onPress={() => handleSelect(r)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  countHint: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI_COLORS.textSecondary,
  },
  segmentedShell: {
    flexDirection: "row",
    position: "relative",
    backgroundColor: "#161221",
    borderRadius: UI_RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: SEGMENT_PAD,
    gap: SEGMENT_GAP,
  },
  slidingPill: {
    position: "absolute",
    top: SEGMENT_PAD,
    start: SEGMENT_PAD,
    height: 44,
    borderRadius: UI_RADII.pill,
    backgroundColor: UI_COLORS.primary,
  },
  segmentButton: {
    flex: 1,
    height: 44,
    borderRadius: UI_RADII.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },
  segmentLabelSelected: {
    fontFamily: FONTS.bodyBlack,
  },
});
