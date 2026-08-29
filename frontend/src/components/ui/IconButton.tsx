import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "default" | "accent" | "danger";
}

const toneClasses = {
  default:
    "border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:bg-surface-hover hover:text-ink active:bg-surface-pressed",
  accent:
    "border-accent/20 bg-accent-soft text-accent-strong hover:border-accent/50 hover:bg-surface-selected",
  danger:
    "border-danger/30 bg-danger-soft text-danger hover:border-danger/60",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, children, tone = "default", className = "", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-[color,background-color,border-color,transform,opacity] duration-[var(--motion-ui)] ease-[var(--ease-standard)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-95 disabled:cursor-not-allowed disabled:border-line-subtle disabled:bg-surface-muted disabled:text-ink-disabled disabled:opacity-100 ${toneClasses[tone]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  },
);
