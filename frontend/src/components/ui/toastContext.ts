import { createContext, type ReactNode, useContext } from "react";

export type ToastTone = "success" | "info" | "warning" | "danger";

export interface ToastOptions {
  title?: string;
  tone?: ToastTone;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (message: ReactNode, options?: ToastOptions) => number;
  dismissToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
