import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PillButton } from "../ui";
import { FONTS, UI_COLORS } from "../../constants/theme";

interface PracticeContextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  hint: string;
  error?: string;
}

/**
 * Matte multiline prompt input matching AppInput tokens for optional practice topics.
 */
export function PracticeContextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
}: PracticeContextFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error && error.length > 0);
  const hasValue = value.length > 0;

  return (
    <View style={styles.contextSection}>
      <View style={styles.contextLabelRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {hasValue ? (
          <TouchableOpacity
            onPress={() => onChangeText("")}
            hitSlop={8}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Clear text"
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={UI_COLORS.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={UI_COLORS.textMuted}
        multiline
        numberOfLines={3}
        style={[
          styles.contextInput,
          focused && !hasError && styles.contextInputFocused,
          hasError && styles.contextInputError,
        ]}
      />

      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <Text style={styles.hintText}>{hint}</Text>
      )}
    </View>
  );
}

interface MatchStartDockProps {
  label: string;
  loading: boolean;
  onPress: () => void;
}

/**
 * Anchored bottom CTA bar with safe-area padding and full-pill primary action.
 */
export function MatchStartDock({
  label,
  loading,
  onPress,
}: MatchStartDockProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.dock,
        { paddingBottom: Math.max(insets.bottom, 12) + 8 },
      ]}
    >
      <View style={styles.dockInner}>
        <PillButton
          variant="primary"
          size="lg"
          label={label}
          icon={<Ionicons name="play" size={18} color="#FFFFFF" />}
          loading={loading}
          onPress={onPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contextSection: {
    width: "100%",
    marginBottom: 12,
  },
  contextLabelRow: {
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
  contextInput: {
    backgroundColor: "#1A1520",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: UI_COLORS.textPrimary,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 84,
    textAlignVertical: "top",
  },
  contextInputFocused: {
    borderColor: "rgba(255, 255, 255, 0.34)",
  },
  contextInputError: {
    borderColor: UI_COLORS.coral,
    backgroundColor: "rgba(232, 93, 117, 0.08)",
  },
  hintText: {
    marginTop: 7,
    paddingHorizontal: 4,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
    color: UI_COLORS.textMuted,
  },
  errorText: {
    marginTop: 7,
    paddingHorizontal: 4,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: UI_COLORS.coral,
  },
  dock: {
    backgroundColor: "rgba(13, 11, 20, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  dockInner: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
});
