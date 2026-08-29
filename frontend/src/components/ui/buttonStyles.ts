export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-accent-contrast shadow-sm hover:border-accent-strong hover:bg-accent-strong active:border-accent-strong active:bg-accent-strong",
  secondary:
    "border-line bg-surface-raised text-ink shadow-sm hover:border-line-strong hover:bg-surface-hover active:bg-surface-pressed",
  danger:
    "border-danger bg-danger text-white shadow-sm hover:brightness-90",
  ghost:
    "border-transparent bg-transparent text-ink-muted hover:bg-surface-hover hover:text-ink active:bg-surface-pressed",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  className = "",
): string {
  return `inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color,transform,opacity] duration-[var(--motion-ui)] ease-[var(--ease-standard)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98] disabled:cursor-not-allowed disabled:border-line-subtle disabled:bg-surface-muted disabled:text-ink-disabled disabled:shadow-none disabled:active:scale-100 ${variantClasses[variant]} ${className}`;
}
