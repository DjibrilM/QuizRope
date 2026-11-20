import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { GestureDetector, GestureType } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { FONTS, UI_COLORS } from "../../../constants/theme";

interface CollapsedHeaderProps {
  collapsedHeader?: React.ReactNode;
  collapsedTitle?: string;
  collapsedHeaderStyle: any;
  dragUpGesture: GestureType;
  expand: () => void;
}

export const CollapsedHeader: React.FC<CollapsedHeaderProps> = ({
  collapsedHeader,
  collapsedTitle,
  collapsedHeaderStyle,
  dragUpGesture,
  expand,
}) => (
  <Animated.View style={[styles.collapsedContainer, collapsedHeaderStyle]}>
    <GestureDetector gesture={dragUpGesture}>
      <TouchableOpacity
        onPress={expand}
        activeOpacity={0.8}
        style={styles.collapsedTouchArea}
      >
        {collapsedHeader ? (
          collapsedHeader
        ) : (
          <View style={styles.collapsedTitleWrap}>
            <Text style={styles.collapsedTitle} numberOfLines={1}>
              {collapsedTitle || ""}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </GestureDetector>

    <TouchableOpacity
      onPress={expand}
      activeOpacity={0.75}
      style={styles.reopenCircle}
      accessibilityRole="button"
      accessibilityLabel="Re-open bottom sheet"
    >
      <Ionicons name="chevron-up" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  </Animated.View>
);

interface HandleBarProps {
  customHandle?: React.ComponentType<any> | null;
  handleIndicatorStyle?: StyleProp<ViewStyle>;
  dragDownGesture: GestureType;
}

export const HandleBar: React.FC<HandleBarProps> = ({
  customHandle: CustomHandle,
  handleIndicatorStyle,
  dragDownGesture,
}) => (
  <GestureDetector gesture={dragDownGesture}>
    <View style={styles.handleStrip}>
      {CustomHandle ? (
        <CustomHandle />
      ) : (
        <View style={[styles.handlePill, handleIndicatorStyle]} />
      )}
    </View>
  </GestureDetector>
);

const styles = StyleSheet.create({
  collapsedContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  collapsedTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 12,
    height: "100%",
  },
  collapsedTitleWrap: {
    flex: 1,
    justifyContent: "center",
  },
  collapsedTitle: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: UI_COLORS.textPrimary,
  },
  reopenCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#241D2E",
    alignItems: "center",
    justifyContent: "center",
  },
  handleStrip: {
    width: "100%",
    paddingTop: 11,
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  handlePill: {
    backgroundColor: "#4A3F5C",
    width: 42,
    height: 4.5,
    borderRadius: 999,
  },
});
