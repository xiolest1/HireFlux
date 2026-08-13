import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

export interface MenuItem {
  label: ReactNode;
  href?: string;
  onSelect?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  label: string;
  trigger: ReactNode;
  items: readonly MenuItem[];
  align?: "start" | "end";
}

export function Menu({ label, trigger, items, align = "end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex"
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-30 mt-2 min-w-52 rounded-xl border border-line bg-surface-raised p-1.5 shadow-float ${align === "end" ? "right-0" : "left-0"}`}
        >
          {items.map((item, index) => {
            const classes = `flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              item.danger
                ? "text-danger hover:bg-danger-soft"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink"
            } ${item.disabled ? "pointer-events-none opacity-45" : ""}`;
            const content = (
              <>
                {item.icon}
                <span>{item.label}</span>
              </>
            );
            return item.href ? (
              <Link
                key={index}
                to={item.href}
                role="menuitem"
                className={classes}
                aria-disabled={item.disabled || undefined}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={index}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={classes}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
