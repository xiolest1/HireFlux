import type { ApplicationStatus } from "../../api/schemas";
import { formatStatus } from "../../features/applications/format";

const statusClasses: Record<ApplicationStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  APPLIED: "border-blue-200 bg-blue-50 text-blue-800",
  INTERVIEW: "border-amber-200 bg-amber-50 text-amber-900",
  OFFER: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
  ARCHIVED: "border-zinc-300 bg-zinc-100 text-zinc-700",
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
