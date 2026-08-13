import type { Application } from "../../api/schemas";
import { formatDateOnly, formatSource } from "./format";

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1.5 break-words [overflow-wrap:anywhere] text-sm font-medium leading-6 text-ink">
        {value}
      </dd>
    </div>
  );
}

export function ApplicationDetails({ application }: { application: Application }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-6">
      <div className="border-b border-line pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Overview</p>
        <h2 className="mt-1 text-lg font-bold text-ink">Application details</h2>
      </div>
      <dl className="mt-5 grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2">
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
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Job posting
          </dt>
          <dd className="mt-1.5 text-sm font-medium leading-6">
            {application.job_url ? (
              <a
                href={application.job_url}
                target="_blank"
                rel="noreferrer"
                className="break-all rounded-sm text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
              >
                {application.job_url}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="text-ink">Not set</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          Description
        </h3>
        {application.description ? (
          <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-7 text-ink-muted">
            {application.description}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No description added.</p>
        )}
      </div>
    </section>
  );
}
