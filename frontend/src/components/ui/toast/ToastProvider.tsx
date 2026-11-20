import * as Haptics from "expo-haptics";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastConfig, type ToastPosition } from "./Toast";

export type { ToastPosition, ToastConfig } from "./Toast";

export type ToastType =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "danger"
  | "normal"
  | (string & {});

export interface ToastOptions {
  title?: string;
  message?: string;
  text1?: string;
  text2?: string;
  /** Visual type of the toast. Determines default icon and haptic feedback. */
  type?: ToastType;
  /** Screen edge for this toast. Defaults to the provider's `position`. */
  position?: ToastPosition;
  /** Auto-dismiss timeout in ms (`visibilityTime` supported for compatibility). */
  duration?: number;
  visibilityTime?: number;
  actionText?: string;
  onActionPress?: () => void;
  [key: string]: any;
}

export type ToastInput = ToastOptions;
export type ToastItem = ToastConfig;

export interface ToastContextValue {
  showToast: (options: ToastOptions | string) => void;
  show: (
    messageOrOptions: string | ToastOptions,
    options?: Partial<ToastOptions>,
  ) => void;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showApiError: (error: unknown) => void;
}

interface ToastEntry extends ToastConfig {
  /** Exit animation is running; the entry no longer occupies a stack slot. */
  exiting?: boolean;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

type GlobalShowToastFn = (options: ToastOptions | string) => void;
let globalShowToast: GlobalShowToastFn | null = null;

function extractTitleAndMessage(opts: ToastOptions): {
  title?: string;
  message: string;
} {
  if (opts.title && opts.message) {
    return { title: opts.title, message: opts.message };
  }
  if (opts.text1 && opts.text2) {
    return { title: opts.text1, message: opts.text2 };
  }
  if (opts.message) {
    return { message: opts.message };
  }
  if (opts.title) {
    return { message: opts.title };
  }
  if (opts.text1) {
    return { message: opts.text1 };
  }
  if (opts.text2) {
    return { message: opts.text2 };
  }
  return { message: "Notification" };
}

function resolveType(
  rawType?: string,
): "success" | "error" | "info" | "warning" | undefined {
  if (rawType === "danger") return "error";
  if (
    rawType === "success" ||
    rawType === "error" ||
    rawType === "info" ||
    rawType === "warning"
  ) {
    return rawType;
  }
  return undefined;
}

/**
 * Imperative helper for showing toasts outside of React component render trees.
 */
export const toast = {
  show: (
    messageOrOptions: string | ToastOptions,
    maybeOptions?: Partial<ToastOptions>,
  ) => {
    if (!globalShowToast) {
      console.warn("Toast: ToastProvider is not mounted yet");
      return;
    }

    if (typeof messageOrOptions === "string") {
      const type = resolveType(maybeOptions?.type);
      globalShowToast({
        title: maybeOptions?.title,
        message: messageOrOptions,
        type,
        position: maybeOptions?.position,
        duration: maybeOptions?.duration ?? maybeOptions?.visibilityTime,
        actionText: maybeOptions?.actionText,
        onActionPress: maybeOptions?.onActionPress,
      });
    } else {
      const opts = messageOrOptions;
      const type = resolveType(opts.type);
      const { title, message } = extractTitleAndMessage(opts);

      globalShowToast({
        title,
        message,
        type,
        position: opts.position,
        duration: opts.duration ?? opts.visibilityTime,
        actionText: opts.actionText,
        onActionPress: opts.onActionPress,
      });
    }
  },
  success: (message: string, options?: Partial<ToastOptions>) => {
    toast.show(message, { ...options, type: "success" });
  },
  error: (message: string, options?: Partial<ToastOptions>) => {
    toast.show(message, { ...options, type: "error" });
  },
  info: (message: string, options?: Partial<ToastOptions>) => {
    toast.show(message, { ...options, type: "info" });
  },
  warning: (message: string, options?: Partial<ToastOptions>) => {
    toast.show(message, { ...options, type: "warning" });
  },
};

export const ToastManager = toast;

/**
 * Hosts a stack of swipeable toasts above its children. Each new toast enters
 * at the front and pushes earlier ones back a step.
 */
export function ToastProvider({
  children,
  position = "top",
}: {
  children: ReactNode;
  /** Edge the toasts stack against unless a toast sets its own `position`. */
  position?: ToastPosition;
}) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const nextId = useRef(1);
  const recentToastsRef = useRef<Map<string, number>>(new Map());
  const activeToastKeysRef = useRef<Map<number, string>>(new Map());

  const showToast = useCallback(
    (options: ToastOptions | string) => {
      const opts: ToastOptions =
        typeof options === "string" ? { message: options } : options;

      const { title, message } = extractTitleAndMessage(opts);
      const resolvedType = resolveType(opts.type);
      const resolvedPosition = opts.position ?? position;
      const dedupKey = `${resolvedType ?? "normal"}::${resolvedPosition}::${title ?? ""}::${message}`;
      const now = Date.now();

      const isAlreadyVisible = Array.from(
        activeToastKeysRef.current.values(),
      ).includes(dedupKey);
      const lastShownAt = recentToastsRef.current.get(dedupKey);
      if (
        isAlreadyVisible ||
        (lastShownAt !== undefined && now - lastShownAt < 1800)
      ) {
        return;
      }
      recentToastsRef.current.set(dedupKey, now);

      try {
        if (resolvedType === "error") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
            () => {},
          );
        } else if (resolvedType === "warning") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {});
        } else {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        }
      } catch {
        // Haptics not supported in this environment
      }

      const id = nextId.current++;
      activeToastKeysRef.current.set(id, dedupKey);

      setToasts((current) => [
        ...current,
        {
          id,
          title,
          message,
          type: resolvedType,
          position: resolvedPosition,
          duration: opts.duration ?? opts.visibilityTime,
          actionText: opts.actionText,
          onActionPress: opts.onActionPress,
        },
      ]);
    },
    [position],
  );

  const show = useCallback(
    (
      messageOrOptions: string | ToastOptions,
      options?: Partial<ToastOptions>,
    ) => {
      if (typeof messageOrOptions === "string") {
        const type = resolveType(options?.type);
        showToast({
          title: options?.title,
          message: messageOrOptions,
          type,
          position: options?.position,
          duration: options?.duration ?? options?.visibilityTime,
          actionText: options?.actionText,
          onActionPress: options?.onActionPress,
        });
      } else {
        showToast(messageOrOptions);
      }
    },
    [showToast],
  );

  const showError = useCallback(
    (message: string, title = "Error") => {
      showToast({ type: "error", title, message });
    },
    [showToast],
  );

  const showSuccess = useCallback(
    (message: string, title = "Success") => {
      showToast({ type: "success", title, message });
    },
    [showToast],
  );

  const showWarning = useCallback(
    (message: string, title = "Warning") => {
      showToast({ type: "warning", title, message });
    },
    [showToast],
  );

  const showInfo = useCallback(
    (message: string, title = "Info") => {
      showToast({ type: "info", title, message });
    },
    [showToast],
  );

  const showApiError = useCallback(
    (error: unknown) => {
      const err = error as any;
      const rawMessage: string = err?.message ?? "Something went wrong";
      const code: string = err?.code ?? "";

      if (rawMessage === "Session expired. Please log in again.") {
        showToast({
          type: "warning",
          title: "Session Expired",
          message: "Please sign in again.",
        });
        return;
      }

      if (code.startsWith("auth/")) {
        const authTitles: Record<string, string> = {
          "auth/user-not-found": "Account Not Found",
          "auth/wrong-password": "Wrong Password",
          "auth/invalid-credential": "Invalid Credentials",
          "auth/invalid-email": "Invalid Email",
          "auth/too-many-requests": "Too Many Attempts",
          "auth/email-already-in-use": "Email Already Registered",
          "auth/weak-password": "Weak Password",
          "auth/network-request-failed": "No Connection",
        };
        const authMessages: Record<string, string> = {
          "auth/user-not-found": "No account found with this email.",
          "auth/wrong-password": "The password is incorrect.",
          "auth/invalid-credential": "Email or password is incorrect.",
          "auth/invalid-email": "Please enter a valid email address.",
          "auth/too-many-requests":
            "Account temporarily locked. Try again later.",
          "auth/email-already-in-use":
            "An account already exists with this email.",
          "auth/weak-password": "Password must be at least 6 characters.",
          "auth/network-request-failed": "Check your internet connection.",
        };
        showToast({
          type: "error",
          title: authTitles[code] ?? "Auth Error",
          message: authMessages[code] ?? rawMessage,
        });
        return;
      }

      if (
        rawMessage.toLowerCase().includes("network") ||
        rawMessage.toLowerCase().includes("connection") ||
        rawMessage.toLowerCase().includes("timeout")
      ) {
        showToast({
          type: "error",
          title: "No Connection",
          message: "Check your internet connection and try again.",
          duration: 5000,
        });
        return;
      }

      showToast({ type: "error", title: "Error", message: rawMessage });
    },
    [showToast],
  );

  useEffect(() => {
    globalShowToast = showToast;
    return () => {
      globalShowToast = null;
    };
  }, [showToast]);

  const handleDismissStart = useCallback((id: number) => {
    activeToastKeysRef.current.delete(id);
    setToasts((current) =>
      current.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
  }, []);

  const handleDismissed = useCallback((id: number) => {
    activeToastKeysRef.current.delete(id);
    setToasts((current) => current.filter((t) => t.id !== id));
    setHeights((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const handleHeightChange = useCallback((id: number, height: number) => {
    setHeights((current) =>
      current[id] === height ? current : { ...current, [id]: height },
    );
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      show,
      showError,
      showSuccess,
      showWarning,
      showInfo,
      showApiError,
    }),
    [
      showToast,
      show,
      showError,
      showSuccess,
      showWarning,
      showInfo,
      showApiError,
    ],
  );

  const frontHeightFor = (edge: ToastPosition) => {
    const active = toasts.filter((t) => !t.exiting && t.position === edge);
    return active.length ? heights[active[active.length - 1].id] : undefined;
  };
  const frontHeights: Record<ToastPosition, number | undefined> = {
    top: frontHeightFor("top"),
    bottom: frontHeightFor("bottom"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map((toastItem) => (
        <Toast
          key={toastItem.id}
          toast={toastItem}
          index={
            toasts.filter(
              (t) =>
                !t.exiting &&
                t.position === toastItem.position &&
                t.id > toastItem.id,
            ).length
          }
          height={heights[toastItem.id]}
          frontHeight={frontHeights[toastItem.position]}
          onHeightChange={handleHeightChange}
          onDismissStart={handleDismissStart}
          onDismissed={handleDismissed}
        />
      ))}
    </ToastContext.Provider>
  );
}
