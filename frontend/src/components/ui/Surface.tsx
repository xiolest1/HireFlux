import type { HTMLAttributes, ReactNode } from "react";

export type SurfaceTone = "default" | "raised" | "muted" | "accent";

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  tone?: SurfaceTone;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const toneClasses: Record<SurfaceTone, string> = {
  default: "border-line bg-surface",
  raised: "border-line bg-surface-raised shadow-panel",
  muted: "border-line bg-surface-muted",
  accent:
    "border-accent/30 bg-[linear-gradient(135deg,var(--hf-accent-soft),var(--hf-violet-soft))]",
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function Surface({
  as: Component = "section",
  tone = "default",
  padding = "md",
  className = "",
  children,
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={`rounded-2xl border ${toneClasses[tone]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
