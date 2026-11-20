import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { PillButton } from "../ui";
import { FONTS, UI_COLORS } from "../../constants/theme";

interface QRScannerProps {
  onScan: (data: string) => void;
  enabled: boolean;
}

export function QRScanner({ onScan, enabled }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={UI_COLORS.primary} />
        <Text style={styles.stateText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.iconBall}>
          <Ionicons name="camera-outline" size={28} color={UI_COLORS.primary} />
        </View>
        <Text style={styles.stateTitle}>Camera Access Needed</Text>
        <Text style={styles.stateText}>
          Allow camera permission to scan the QR code from your parent&apos;s
          screen.
        </Text>
        <View style={styles.permissionButtonWrap}>
          <PillButton
            size="default"
            label="Grant Permission"
            onPress={() => {
              void requestPermission();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          enabled
            ? ({ data }) => {
                onScan(data);
              }
            : undefined
        }
      />

      {/* Crisp center corner reticle */}
      <View style={styles.reticleOverlay} pointerEvents="none">
        <View style={styles.reticleBox}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3.5;

const styles = StyleSheet.create({
  cameraRoot: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0D0B14",
  },
  stateContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#161221",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  iconBall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#241D2E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 17,
    color: UI_COLORS.textPrimary,
    textAlign: "center",
  },
  stateText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textSecondary,
    textAlign: "center",
  },
  permissionButtonWrap: {
    width: "100%",
    maxWidth: 220,
    marginTop: 8,
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  reticleBox: {
    width: 220,
    height: 220,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "rgba(255, 255, 255, 0.88)",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 14,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 14,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 14,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 14,
  },
});
