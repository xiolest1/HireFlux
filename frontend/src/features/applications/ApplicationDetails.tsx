import type { Application } from "../../api/schemas";
import { formatDateOnly, formatSource } from "./format";

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-sm font-medium leading-6 text-slate-800">
        {value}
      </dd>
    </div>
  );
}

export function ApplicationDetails({ application }: { application: Application }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">Application details</h2>
      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <DetailItem label="Applied" value={formatDateOnly(application.applied_date)} />
        <DetailItem label="Follow-up" value={formatDateOnly(application.follow_up_date)} />
        <DetailItem label="Location" value={application.location ?? "Not set"} />
        <DetailItem
          label="Work mode"
          value={
            application.work_mode
              ? application.work_mode.charAt(0) + application.work_mode.slice(1).toLowerCase()
              : "Not set"
          }
        />
        <DetailItem label="Source" value={application.source ? `${formatSource(application.source)}${application.source_detail ? ` · ${application.source_detail}` : ""}` : "Not set"} />
        <DetailItem label="Salary" value={application.salary_text ?? "Not set"} />
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Job posting
          </dt>
          <dd className="mt-1.5 text-sm font-medium leading-6">
            {application.job_url ? (
              <a
                href={application.job_url}
                target="_blank"
                rel="noreferrer"
                className="break-all rounded-sm text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-600"
              >
                {application.job_url}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="text-slate-800">Not set</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Description
        </h3>
        {application.description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {application.description}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No description added.</p>
        )}
      </div>
    </section>
  );
}
