import { Dimensions, Platform, useWindowDimensions } from "react-native";
import { type EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";

export interface ScreenSize {
  width: number;
  height: number;
}

/**
 * Estimates hardware display corner radius (in logical points) from safe-area
 * geometry and window dimensions so floating sheets align with device bezels.
 */
export function getScreenCornerRadius(
  insets: Pick<EdgeInsets, "top" | "bottom">,
  dimensions: ScreenSize = Dimensions.get("window"),
): number {
  const shortSide = Math.min(dimensions.width, dimensions.height);
  const longSide = Math.max(dimensions.width, dimensions.height);

  if (Platform.OS === "ios") {
    if (Platform.isPad) {
      return insets.bottom > 0 ? 18 : 0;
    }

    if (insets.bottom === 0) {
      return 0;
    }

    // Dynamic Island models (14 Pro, 15, 16, 17 series)
    if (insets.top >= 54) {
      if (shortSide >= 402 && longSide >= 874) {
        return 62;
      }
      return 55;
    }

    // iPhone 12 mini / 13 mini
    if (insets.top >= 48 && shortSide <= 375) {
      return 44;
    }

    // Notch Pro Max / Plus
    if (shortSide >= 428) {
      return 53.3;
    }

    // Notch 12 / 13 / 14
    if (shortSide >= 390 && insets.top >= 47) {
      return 47.3;
    }

    // iPhone XR / 11
    if (shortSide >= 414 && insets.top >= 47) {
      return 41.5;
    }

    return 39;
  }

  return insets.bottom >= 16 ? 40 : 0;
}

/**
 * Computes concentric border radius for a floating sheet inset by `margin`
 * from the display edge (`outerScreenRadius - margin`).
 */
export function getConcentricSheetRadius(
  insets: Pick<EdgeInsets, "top" | "bottom">,
  margin: number = 8,
  dimensions?: ScreenSize,
  fallbackRadius: number = 36,
): number {
  const screenRadius = getScreenCornerRadius(insets, dimensions);
  if (screenRadius <= 0) {
    return fallbackRadius;
  }
  return Math.max(24, Math.round((screenRadius - margin) * 10) / 10);
}

/**
 * Reactive hook returning the concentric floating bottom-sheet border radius
 * synced to the current device's display rounding.
 */
export function useConcentricSheetRadius(
  margin: number = 8,
  fallbackRadius: number = 36,
): number {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  return getConcentricSheetRadius(insets, margin, dimensions, fallbackRadius);
}
