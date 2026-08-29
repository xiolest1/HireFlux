import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useModalFocus } from "./useModalFocus";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: "sm" | "md" | "lg" | "xl";
  ariaLabel?: string;
  id?: string;
  placement?: "left" | "right";
  sideBreakpoint?: "md" | "lg";
}

const sizeClasses = {
  sm: "lg:max-w-sm",
  md: "lg:max-w-md",
  lg: "lg:max-w-xl",
  xl: "lg:max-w-2xl",
};

const mediumSizeClasses = {
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-xl",
  xl: "md:max-w-2xl",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  size = "md",
  ariaLabel,
  id,
  placement = "right",
  sideBreakpoint = "lg",
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useModalFocus({
    isOpen: open,
    containerRef: panelRef,
    initialFocusRef: initialFocusRef ?? closeRef,
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

  const isMediumSideDrawer = sideBreakpoint === "md";
  const sideClasses = isMediumSideDrawer
    ? {
        container: placement === "left" ? "md:justify-start" : "md:justify-end",
        panel: "md:h-full md:max-h-none md:rounded-none",
        corner: placement === "left" ? "md:rounded-r-3xl" : "md:rounded-l-3xl",
        size: mediumSizeClasses[size],
        handle: "md:hidden",
      }
    : {
        container: placement === "left" ? "lg:justify-start" : "lg:justify-end",
        panel: "lg:h-full lg:max-h-none lg:rounded-none",
        corner: placement === "left" ? "lg:rounded-r-3xl" : "lg:rounded-l-3xl",
        size: sizeClasses[size],
        handle: "lg:hidden",
      };

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-end ${
        isMediumSideDrawer ? "md:items-stretch" : "lg:items-stretch"
      } ${sideClasses.container}`}
    >
      <div
        className="absolute inset-0 cursor-default bg-overlay backdrop-blur-sm"
        aria-hidden="true"
        onMouseDown={onClose}
      />
      <section
        ref={panelRef}
        id={id}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface-raised shadow-float ${sideClasses.panel} ${sideClasses.corner} ${sideClasses.size}`}
      >
        <div className={`mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong ${sideClasses.handle}`} />
        <div className="flex items-start gap-4 border-b border-line px-5 py-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl font-bold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton ref={closeRef} label="Close panel" onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-line-subtle bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
