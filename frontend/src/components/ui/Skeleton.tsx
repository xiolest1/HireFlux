import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full";
}

const roundedClasses = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-2xl",
  full: "rounded-full",
};

export function Skeleton({
  rounded = "md",
  className = "h-4 w-full",
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`hf-skeleton ${roundedClasses[rounded]} ${className}`}
      {...props}
    />
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="rounded-2xl border border-line-subtle bg-surface p-5"
      aria-hidden="true"
    >
      <Skeleton className="h-5 w-2/5" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className={`h-3 ${index === rows - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
