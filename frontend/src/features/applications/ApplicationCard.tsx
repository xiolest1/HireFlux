import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Application } from "../../api/schemas";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateOnly, formatTimestamp, formatWorkMode } from "./format";

function dateInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function nextStepPresentation(application: Application, timeZone: string) {
  const date = application.follow_up_date;
  if (!date) {
    if (application.next_step_responsibility === "CANDIDATE") {
      return {
        label: application.next_step_note ?? "Candidate action",
        className: "text-warning font-semibold",
        iconClassName: "text-warning",
      };
    }
    if (application.next_step_responsibility === "EMPLOYER") {
      return {
        label: "Waiting for employer",
        className: "text-ink",
        iconClassName: "text-accent",
      };
    }
    return {
      label: application.next_step_responsibility === "NONE"
        ? "No current action"
        : "Next step not reviewed",
      className: "text-ink-muted",
      iconClassName: "text-ink-muted",
    };
  }

  const today = dateInTimeZone(timeZone);
  if (date < today) {
    return {
      label: `${application.next_step_responsibility === "CANDIDATE" ? "Action" : "Check-back"} overdue · ${formatDateOnly(date)}`,
      className: "text-danger font-semibold",
      iconClassName: "text-danger",
    };
  }
  if (date === today) {
    return {
      label: `${application.next_step_responsibility === "CANDIDATE" ? "Action" : "Check-back"} due today`,
      className: "text-warning font-semibold",
      iconClassName: "text-warning",
    };
  }
  return {
    label: `${application.next_step_responsibility === "CANDIDATE" ? "Action" : "Check back"} ${formatDateOnly(date)}`,
    className: "text-ink",
    iconClassName: "text-accent",
  };
}

export function ApplicationCard({
  application,
  timeZone,
  isHighlighted = false,
}: {
  application: Application;
  timeZone: string;
  isHighlighted?: boolean;
}) {
  const nextStep = nextStepPresentation(application, timeZone);
  const meta = [
    application.location,
    application.work_mode ? formatWorkMode(application.work_mode) : null,
  ].filter(Boolean);

  return (
    <article className={`group relative h-full min-w-0 overflow-hidden rounded-2xl border bg-surface p-5 shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${isHighlighted ? "border-accent ring-2 ring-accent/25" : "border-line"}`}>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-accent">
            {application.company_name}
          </p>
          <h2 className="mt-1 break-words [overflow-wrap:anywhere] text-lg font-bold leading-6 text-ink">
            <Link
              to={`/applications/${application.application_id}`}
              className="rounded-sm decoration-accent/40 underline-offset-4 group-hover:underline"
            >
              {application.job_title}
            </Link>
          </h2>
          {meta.length ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{meta.join(" · ")}</span>
            </p>
          ) : null}
        </div>
        <div className="relative z-10 shrink-0 whitespace-nowrap">
          <StatusBadge status={application.status} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Applied
          </dt>
          <dd className="mt-1 font-medium text-ink">
            {formatDateOnly(application.applied_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Next step
          </dt>
          <dd className={`mt-1 flex items-start gap-1.5 ${nextStep.className}`}>
            <CalendarClock
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 ${nextStep.iconClassName}`}
            />
            <span className="line-clamp-2">{nextStep.label}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Updated {formatTimestamp(application.updated_at, timeZone)}
        </p>
        <Link
          to={`/applications/${application.application_id}`}
          aria-label={`Manage ${application.job_title} application`}
          className="relative z-10 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line-strong bg-surface-raised px-3 py-1.5 text-sm font-semibold text-ink transition-colors group-hover:border-accent/50 group-hover:text-accent"
        >
          Manage
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </article>
  );
}
