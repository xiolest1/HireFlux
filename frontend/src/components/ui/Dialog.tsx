import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "./useModalFocus";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  initialFocusRef,
  role = "dialog",
  className = "",
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useModalFocus({
    isOpen: open,
    containerRef: panelRef,
    initialFocusRef: initialFocusRef ?? panelRef,
    onClose,
  });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`w-full max-w-md rounded-3xl border border-line bg-surface-raised p-6 shadow-float ${className}`}
      >
        <h2 id={titleId} className="font-display text-xl font-bold text-ink">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-ink-muted">
            {description}
          </p>
        ) : null}
        {children}
      </section>
    </div>,
    document.body,
  );
}
