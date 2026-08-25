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
  const details = [
    application.location ? ["Location", application.location] : null,
    application.work_mode
      ? ["Work mode", application.work_mode.charAt(0) + application.work_mode.slice(1).toLowerCase()]
      : null,
    application.source
      ? ["Source", `${formatSource(application.source)}${application.source_detail ? ` · ${application.source_detail}` : ""}`]
      : null,
    application.salary_text ? ["Salary", application.salary_text] : null,
  ].filter((item): item is string[] => item !== null);
  return (
    <section id="details" className="min-w-0 scroll-mt-24" aria-labelledby="details-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Context</p>
          <h2 id="details-heading" tabIndex={-1} className="mt-1 text-xl font-bold text-ink">Opportunity details</h2>
        </div>
        <a href={`/applications/${application.application_id}/edit`} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">Add details</a>
      </div>
      <dl className="mt-5 grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2">
        {application.applied_date ? <DetailItem label="Applied" value={formatDateOnly(application.applied_date)} /> : null}
        {details.map(([label, value]) => <DetailItem key={label} label={label} value={value} />)}
        {application.job_url ? <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Job posting
          </dt>
          <dd className="mt-1.5 text-sm font-medium leading-6">
            <a
                href={application.job_url}
                target="_blank"
                rel="noreferrer"
                className="break-all rounded-sm text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
              >
                {application.job_url}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
          </dd>
        </div> : null}
      </dl>

      {application.description ? <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          Description
        </h3>
        <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-7 text-ink-muted">
            {application.description}
          </p>
      </div> : null}
    </section>
  );
}
