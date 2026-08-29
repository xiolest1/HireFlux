import type { ReactNode } from "react";
import { ApiError } from "../../api/client";
import { Button } from "./Button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-line-subtle bg-surface p-8 text-sm font-medium text-ink-muted"
      role="status"
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      {label}
    </div>
  );
}

interface ErrorPanelProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorPanel({
  error,
  title = "Something went wrong",
  onRetry,
  compact = false,
}: ErrorPanelProps) {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed. Please try again.";
  const requestId = error instanceof ApiError ? error.requestId : null;

  return (
    <div
      className={`rounded-2xl border border-danger/30 bg-danger-soft text-danger ${compact ? "p-4" : "p-6"}`}
      role="alert"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6">{message}</p>
      {requestId ? (
        <p className="mt-1 text-xs">Reference: {requestId}</p>
      ) : null}
      {onRetry ? (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent-soft text-lg font-bold text-accent"
      >
        +
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success"
      role="status"
    >
      {children}
    </div>
  );
}
