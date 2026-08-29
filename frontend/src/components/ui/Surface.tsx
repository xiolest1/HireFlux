import type { HTMLAttributes, ReactNode } from "react";

export type SurfaceTone = "default" | "raised" | "muted" | "accent" | "interactive";

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  tone?: SurfaceTone;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const toneClasses: Record<SurfaceTone, string> = {
  default: "border border-line bg-surface",
  raised: "border border-line bg-surface-raised shadow-panel",
  muted: "border border-transparent bg-surface-muted",
  accent:
    "border border-accent/20 bg-accent-soft",
  interactive:
    "border border-line-subtle bg-surface transition-colors hover:border-line hover:bg-surface-hover active:bg-surface-pressed",
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
      className={`rounded-2xl ${toneClasses[tone]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
