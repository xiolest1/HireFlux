import { Link } from "react-router-dom";
import type { Application } from "../../api/schemas";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateOnly, formatTimestamp } from "./format";

export function ApplicationCard({ application }: { application: Application }) {
  return (
    <article className="group h-full rounded-xl border border-slate-200 bg-white p-5 shadow-panel transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-700">
            {application.company_name}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-6 text-slate-950">
            <Link
              to={`/applications/${application.application_id}`}
              className="rounded-sm decoration-brand-300 underline-offset-4 group-hover:underline"
            >
              {application.job_title}
            </Link>
          </h2>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Applied
          </dt>
          <dd className="mt-1 font-medium text-slate-800">
            {formatDateOnly(application.applied_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Follow-up
          </dt>
          <dd className="mt-1 font-medium text-slate-800">
            {formatDateOnly(application.follow_up_date)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Updated {formatTimestamp(application.updated_at)}
        </p>
        <Link
          to={`/applications/${application.application_id}`}
          aria-label={`Edit ${application.job_title} application`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
        >
          Edit
        </Link>
      </div>
    </article>
  );
}
