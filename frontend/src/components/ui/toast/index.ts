import { toast, ToastManager } from "./ToastProvider";

export {
  ToastProvider,
  useToast,
  toast,
  ToastManager,
} from "./ToastProvider";
export type {
  ToastPosition,
  ToastOptions,
  ToastConfig,
  ToastType,
  ToastContextValue,
  ToastInput,
  ToastItem,
} from "./ToastProvider";

export const Toast = toast;
export default toast;
