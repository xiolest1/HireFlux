import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { useModalFocus } from "./useModalFocus";

interface FocusedWorkspaceProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dirty?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeLabel?: string;
}

export function FocusedWorkspace({
  open,
  onClose,
  title,
  description,
  context,
  children,
  footer,
  dirty = false,
  initialFocusRef,
  closeLabel = "Close workspace",
}: FocusedWorkspaceProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  useModalFocus({
    isOpen: open,
    containerRef: panelRef,
    initialFocusRef: initialFocusRef ?? closeRef,
    onClose: requestClose,
  });

  useEffect(() => {
    if (!open) {
      setConfirmDiscard(false);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overlay = panelRef.current?.parentElement;
    if (!overlay) return;
    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== overlay,
    );
    const previous = siblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    }));
    for (const element of siblings) {
      element.setAttribute("aria-hidden", "true");
      element.inert = true;
    }
    return () => {
      for (const state of previous) {
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
        state.element.inert = state.inert;
      }
    };
  }, [open]);

  useEffect(() => {
    if (confirmDiscard) keepEditingRef.current?.focus();
  }, [confirmDiscard]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/65 backdrop-blur-sm md:items-center md:p-5 lg:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface-raised shadow-float md:h-auto md:max-h-[calc(100dvh-2.5rem)] md:max-w-4xl md:rounded-3xl md:border md:border-line lg:max-w-5xl"
      >
        <header className="shrink-0 border-b border-line bg-surface-raised px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-7 md:pt-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              {context ? <div className="mb-2 text-sm text-ink-muted">{context}</div> : null}
              <h2 id={titleId} className="font-display text-xl font-bold text-ink sm:text-2xl">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton ref={closeRef} label={closeLabel} onClick={requestClose}>
              <X aria-hidden="true" className="size-5" />
            </IconButton>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 md:py-7">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </div>

        {confirmDiscard ? (
          <div
            role="alertdialog"
            aria-labelledby={`${titleId}-discard`}
            className="shrink-0 border-t border-warning/30 bg-warning-soft px-5 py-4 sm:px-7"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p id={`${titleId}-discard`} className="font-semibold text-ink">
                  Discard unsaved changes?
                </p>
                <p className="mt-1 text-sm text-ink-muted">Your last saved version will remain unchanged.</p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button ref={keepEditingRef} variant="secondary" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </Button>
                <Button variant="danger" onClick={onClose}>Discard changes</Button>
              </div>
            </div>
          </div>
        ) : footer ? (
          <footer className="shrink-0 border-t border-line bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            <div className="mx-auto w-full max-w-3xl">{footer}</div>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
