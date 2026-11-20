import React, { forwardRef, useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS, UI_COLORS } from "../../constants/theme";

export interface AppInputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showClear?: boolean;
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  shellStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Compact, rounded-rectangle dark text input inspired by twende-passengers-app
 * (`height: 50`, `borderRadius: 16`, matte fill, focus/error/success border states).
 */
export const AppInput = forwardRef<TextInput, AppInputProps>(
  function AppInput(
    {
      label,
      error,
      success = false,
      leftIcon,
      rightSlot,
      showClear = true,
      onClear,
      value,
      onChangeText,
      onFocus,
      onBlur,
      editable = true,
      containerStyle,
      shellStyle,
      inputStyle,
      placeholderTextColor = UI_COLORS.textMuted,
      ...rest
    },
    ref,
  ) {
    const [focused, setFocused] = useState(false);

    const hasError = Boolean(error && error.length > 0);
    const hasValue = typeof value === "string" && value.length > 0;

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}

        <View
          style={[
            styles.shell,
            focused && !hasError && styles.shellFocused,
            success && !hasError && styles.shellSuccess,
            hasError && styles.shellError,
            !editable && styles.shellDisabled,
            shellStyle,
          ]}
        >
          {leftIcon ? <View style={styles.leftSlot}>{leftIcon}</View> : null}

          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            editable={editable}
            placeholderTextColor={placeholderTextColor}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, inputStyle]}
            {...rest}
          />

          {rightSlot ? (
            <View style={styles.rightSlot}>{rightSlot}</View>
          ) : success && !hasError ? (
            <View style={styles.rightSlot}>
              <Ionicons
                name="checkmark-circle"
                size={19}
                color={UI_COLORS.mint}
              />
            </View>
          ) : showClear && hasValue && editable ? (
            <TouchableOpacity
              onPress={() => {
                onClear?.();
                onChangeText?.("");
              }}
              activeOpacity={0.7}
              hitSlop={8}
              style={styles.clearBtn}
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

        {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: UI_COLORS.textSecondary,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  shell: {
    width: "100%",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1520",
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 16,
    gap: 10,
  },
  shellFocused: {
    borderColor: "rgba(255, 255, 255, 0.34)",
  },
  shellSuccess: {
    borderColor: "rgba(52, 211, 153, 0.45)",
  },
  shellError: {
    borderColor: UI_COLORS.coral,
    backgroundColor: "rgba(232, 93, 117, 0.08)",
  },
  shellDisabled: {
    opacity: 0.6,
  },
  leftSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    paddingVertical: 0,
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: UI_COLORS.textPrimary,
  },
  rightSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    marginTop: 6,
    paddingHorizontal: 6,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: UI_COLORS.coral,
  },
});
