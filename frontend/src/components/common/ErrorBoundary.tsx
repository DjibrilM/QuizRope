import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "../../i18n";
import { UI_COLORS, UI_RADII } from "../../constants/theme";
import { getBodyFont, getHeadingFont } from "../../utils/fontForLocale";
import { BrainMascot } from "./Mascots";
import { PillButton } from "../ui";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MascotFallbackGuard extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.iconFallbackWell}>
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={UI_COLORS.coral}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const headingFont = getHeadingFont();
      const bodyFont = getBodyFont();
      const errorMessage = this.state.error?.message?.trim();

      return (
        <View style={styles.root}>
          <View style={styles.outerShell}>
            <View style={styles.innerCard}>
              <View style={styles.mascotWrap}>
                <MascotFallbackGuard>
                  <BrainMascot
                    size={88}
                    state="error"
                    showFloorShadow={false}
                    interactive={false}
                  />
                </MascotFallbackGuard>
              </View>

              <Text style={[styles.title, { fontFamily: headingFont }]}>
                {i18n.t("common:errors.somethingWentWrong", {
                  defaultValue: "Something went wrong",
                })}
              </Text>

              <Text style={[styles.subtitle, { fontFamily: bodyFont }]}>
                {i18n.t("common:errors.tryAgainLater", {
                  defaultValue: "Please try again later",
                })}
              </Text>

              {__DEV__ && errorMessage ? (
                <View style={styles.devErrorBox}>
                  <Text style={styles.devErrorText} numberOfLines={3}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <View style={styles.ctaWrap}>
                <PillButton
                  label={i18n.t("common:buttons.tryAgain", {
                    defaultValue: "Try Again",
                  })}
                  onPress={this.handleRetry}
                  size="lg"
                  icon={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
                />
              </View>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  outerShell: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: UI_COLORS.surface,
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    padding: 6,
  },
  innerCard: {
    width: "100%",
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderRadius: 25,
    borderCurve: "continuous",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
  },
  mascotWrap: {
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconFallbackWell: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(232, 93, 117, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(232, 93, 117, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 22,
  },
  devErrorBox: {
    width: "100%",
    backgroundColor: "#120F1C",
    borderRadius: UI_RADII.tile,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(232, 93, 117, 0.22)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  devErrorText: {
    fontFamily: "Menlo",
    fontSize: 12,
    lineHeight: 17,
    color: "#F2A7B5",
  },
  ctaWrap: {
    width: "100%",
  },
});
