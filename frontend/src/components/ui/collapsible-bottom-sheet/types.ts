import { ScrollView, StyleProp, TextInput, View, ViewStyle } from "react-native";

export const FloatingBottomSheetView = View;
export const FloatingBottomSheetScrollView = ScrollView;
export const FloatingBottomSheetTextInput = TextInput;

export interface CollapsibleBottomSheetRef {
  present: () => void;
  dismiss: () => void;
  close: () => void;
  expand: () => void;
  collapse: () => void;
  snapToIndex: (index: number) => void;
  snapToPosition?: (position: number | string) => void;
}

export interface CollapsibleBottomSheetProps {
  children?: React.ReactNode;
  index?: number;
  snapPoints?: (string | number)[];
  /** Minimum collapsed height when dragged down in persistent collapsible mode (default: 90) */
  collapsedHeight?: number;
  collapsedHeader?: React.ReactNode;
  collapsedTitle?: string;
  enablePanDownToClose?: boolean;
  enableOverDrag?: boolean;
  enableDynamicSizing?: boolean;
  enableBackdropDismiss?: boolean;
  detached?: boolean;
  horizontalMargin?: number;
  cornerRadius?: number;
  topInset?: number;
  bottomInset?: number;
  backdropOpacity?: number;
  style?: StyleProp<ViewStyle>;
  handleIndicatorStyle?: StyleProp<ViewStyle>;
  handleComponent?: React.ComponentType<any> | null;
  backgroundStyle?: StyleProp<ViewStyle>;
  className?: string;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onChange?: (index: number) => void;
  onDismiss?: () => void;
  keyboardBehavior?: "interactive" | "extend" | "fillParent";
  android_keyboardInputMode?: "adjustPan" | "adjustResize";
}

export const DEFAULT_COLLAPSED_HEIGHT = 90;
export const HANDLE_BAR_HEIGHT = 26;
