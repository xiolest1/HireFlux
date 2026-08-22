import type { ApplicationStatus } from "../../api/schemas";
import { formatStatus } from "../../features/applications/format";

const statusClasses: Record<ApplicationStatus, string> = {
  DRAFT: "border-line-strong bg-surface-muted text-ink-muted",
  APPLIED: "border-accent/30 bg-accent-soft text-accent-strong",
  SCREENING: "border-accent/30 bg-accent-soft text-accent-strong",
  INTERVIEW: "border-warning/30 bg-warning-soft text-warning",
  OFFER: "border-success/30 bg-success-soft text-success",
  ACCEPTED: "border-success bg-success-soft text-success",
  REJECTED: "border-danger/30 bg-danger-soft text-danger",
  WITHDRAWN: "border-line-strong bg-surface-muted text-ink-muted",
  ARCHIVED: "border-line-strong bg-surface-muted text-ink-muted",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${statusClasses[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
}
