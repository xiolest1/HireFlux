import {
  type ReactNode,
  useCallback,
  useEffect,
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
import { useReducedMotion } from "./motionHooks";

interface ToastItem extends Required<Pick<ToastOptions, "tone">> {
  id: number;
  title?: string;
  message: ReactNode;
  duration: number;
  state: "open" | "closed";
}

const toneDurations: Record<ToastTone, number> = {
  success: 4500,
  info: 4500,
  warning: 6000,
  danger: 8000,
};

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
  const timers = useRef(new Map<number, number>());
  const exitTimers = useRef(new Map<number, number>());
  const reducedMotion = useReducedMotion();

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismissToast = useCallback((id: number) => {
    clearTimer(id);
    if (reducedMotion) {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      return;
    }
    setToasts((current) =>
      current.map((toast) => toast.id === id ? { ...toast, state: "closed" } : toast),
    );
    if (exitTimers.current.has(id)) return;
    exitTimers.current.set(id, window.setTimeout(() => {
      exitTimers.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 120));
  }, [clearTimer, reducedMotion]);

  const scheduleDismissal = useCallback((id: number, duration: number) => {
    clearTimer(id);
    if (duration <= 0) return;
    timers.current.set(id, window.setTimeout(() => dismissToast(id), duration));
  }, [clearTimer, dismissToast]);

  const showToast = useCallback(
    (message: ReactNode, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const tone = options.tone ?? "success";
      const duration = options.duration ?? toneDurations[tone];
      setToasts((current) => [
        ...current,
        { id, message, title: options.title, tone, duration, state: "open" },
      ]);
      scheduleDismissal(id, duration);
      return id;
    },
    [scheduleDismissal],
  );

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    exitTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

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
              data-state={toast.state}
              className={`hf-toast pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-float ${toneClasses[toast.tone]}`}
              onMouseEnter={() => clearTimer(toast.id)}
              onMouseLeave={() => scheduleDismissal(toast.id, toast.duration)}
              onFocusCapture={() => clearTimer(toast.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  scheduleDismissal(toast.id, toast.duration);
                }
              }}
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
