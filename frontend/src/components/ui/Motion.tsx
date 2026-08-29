import {
  type HTMLAttributes,
  type ReactNode,
} from "react";

export function CollapsibleRegion({
  open,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-state={open ? "open" : "closed"}
      aria-hidden={!open}
      inert={!open}
      className={`hf-collapsible ${className}`}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="hf-collapsible-content">{children}</div>
      </div>
    </div>
  );
}

export function PendingIndicator({ label = "Working…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span aria-hidden="true" className="hf-pending-indicator" />
      <span>{label}</span>
    </span>
  );
}
