import {
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { IconButton } from "./IconButton";
import {
  ToastContext,
  type ToastOptions,
  type ToastTone,
} from "./toastContext";

interface ToastItem extends Required<Pick<ToastOptions, "tone">> {
  id: number;
  title?: string;
  message: ReactNode;
}

const toneClasses: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-soft text-success",
  info: "border-info/25 bg-info-soft text-info",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

const toneIcons = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  danger: TriangleAlert,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: ReactNode, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const duration = options.duration ?? 4500;
      setToasts((current) => [
        ...current,
        { id, message, title: options.title, tone: options.tone ?? "success" },
      ]);
      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-end gap-3 md:bottom-6 md:left-auto md:w-full md:max-w-sm"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "danger" ? "alert" : "status"}
              className={`hf-toast-enter pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-float ${toneClasses[toast.tone]}`}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="font-semibold text-ink">{toast.title}</p> : null}
                <div className="text-sm leading-5">{toast.message}</div>
              </div>
              <IconButton
                label="Dismiss notification"
                className="-mr-2 -mt-2 size-9 border-transparent bg-transparent"
                onClick={() => dismissToast(toast.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
