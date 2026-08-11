import type { ReactNode } from "react";
import { ApiError } from "../../api/client";
import { Button } from "./Button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-600 shadow-panel"
      role="status"
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
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
      className={`rounded-xl border border-rose-200 bg-rose-50 text-rose-950 ${compact ? "p-4" : "p-6"}`}
      role="alert"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-rose-900">{message}</p>
      {requestId ? (
        <p className="mt-1 text-xs text-rose-800">Reference: {requestId}</p>
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
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-panel">
      <div
        aria-hidden="true"
        className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700"
      >
        +
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
      role="status"
    >
      {children}
    </div>
  );
}
