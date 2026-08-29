import type { ApplicationStatus } from "../../api/schemas";
import { formatStatus } from "../../features/applications/format";

const statusClasses: Record<ApplicationStatus, string> = {
  DRAFT: "border-line bg-surface-muted text-ink-muted",
  APPLIED: "border-info/40 bg-info-soft text-info dark:border-info/25",
  SCREENING: "border-violet/40 bg-violet-soft text-violet dark:border-violet/25",
  INTERVIEW: "border-warning/45 bg-warning-soft text-warning dark:border-warning/30",
  OFFER: "border-success/45 bg-success-soft text-success dark:border-success/30",
  ACCEPTED: "border-success bg-success-soft text-success",
  REJECTED: "border-danger/45 bg-danger-soft text-danger dark:border-danger/30",
  WITHDRAWN: "border-line bg-surface-muted text-ink-muted",
  ARCHIVED: "border-line bg-surface-muted text-ink-muted",
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
