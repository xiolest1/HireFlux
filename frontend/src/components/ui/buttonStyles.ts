export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-accent-contrast shadow-sm hover:border-accent-strong hover:bg-accent-strong",
  secondary:
    "border-line-strong bg-surface text-ink shadow-sm hover:border-accent/60 hover:bg-surface-muted",
  danger:
    "border-danger bg-danger text-surface shadow-sm hover:brightness-90",
  ghost:
    "border-transparent bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  className = "",
): string {
  return `inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variantClasses[variant]} ${className}`;
}
