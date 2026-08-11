export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-brand-600 bg-brand-600 text-white shadow-sm hover:border-brand-700 hover:bg-brand-700",
  secondary:
    "border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50",
  danger:
    "border-rose-700 bg-rose-700 text-white shadow-sm hover:border-rose-800 hover:bg-rose-800",
  ghost:
    "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  className = "",
): string {
  return `inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`;
}
