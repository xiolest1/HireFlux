import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { DashboardRange } from "../api/schemas";
import type { Dashboard } from "../api/workspace";
import { buttonClassName } from "../components/ui/buttonStyles";
import { ErrorPanel, LoadingState, SuccessBanner } from "../components/ui/Feedback";
import { StatusBadge } from "../components/ui/StatusBadge";
import { formatDateOnly, formatStatus, formatTimestamp } from "../features/applications/format";
import {
  useCompleteFollowUp,
  useDashboard,
  useRescheduleFollowUp,
} from "../features/workspace/queries";
import { useSettings } from "../features/resources/queries";

function percent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

type DashboardAction = Dashboard["actions"][number];

function actionDueLabel(action: DashboardAction, timeZone: string) {
  return "due_date" in action
    ? formatDateOnly(action.due_date)
    : formatTimestamp(action.due_at, timeZone);
}

function actionDueKey(action: DashboardAction) {
  return "due_date" in action ? action.due_date : action.due_at;
}

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>("30d");
  const rangeInitialized = useRef(false);
  const settingsQuery = useSettings();
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state;
    return state && typeof state === "object" && "notice" in state && typeof state.notice === "string" ? state.notice : null;
  });
  const dashboardQuery = useDashboard(range);
  const completeMutation = useCompleteFollowUp();
  const rescheduleMutation = useRescheduleFollowUp();

  useEffect(() => {
    if (settingsQuery.data && !rangeInitialized.current) {
      rangeInitialized.current = true;
      setRange(settingsQuery.data.default_dashboard_range);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    const state = location.state;
    if (state && typeof state === "object" && "notice" in state && typeof state.notice === "string") {
      setNotice(state.notice);
    }
    if (state) void navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  if (dashboardQuery.isPending) {
    return <LoadingState label="Preparing your workspace home…" />;
  }
  if (dashboardQuery.isError) {
    return (
      <ErrorPanel
        title="Dashboard could not be loaded"
        error={dashboardQuery.error}
        onRetry={() => void dashboardQuery.refetch()}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const maxTrend = Math.max(1, ...dashboard.submission_trend.map((point) => point.count));

  async function complete(applicationId: string) {
    setNotice(null);
    try {
      await completeMutation.mutateAsync(applicationId);
      setNotice("Follow-up completed.");
    } catch {
      return;
    }
  }

  async function reschedule(applicationId: string) {
    if (!followUpDate) return;
    setNotice(null);
    try {
      await rescheduleMutation.mutateAsync({ applicationId, followUpDate });
      setRescheduling(null);
      setFollowUpDate("");
      setNotice("Follow-up rescheduled.");
    } catch {
      return;
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">
            Workspace home
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Here is what is moving, what needs attention, and where your search stands.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-semibold text-slate-700" htmlFor="dashboard-range">
            Summary range
          </label>
          <select
            id="dashboard-range"
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardRange)}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Link to="/applications/new" className={buttonClassName("primary")}>
            Add application
          </Link>
        </div>
      </header>

      {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
      {completeMutation.error || rescheduleMutation.error ? (
        <ErrorPanel
          compact
          title="Follow-up could not be updated"
          error={completeMutation.error ?? rescheduleMutation.error}
        />
      ) : null}

      <section aria-labelledby="search-overview-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="search-overview-title" className="text-xl font-bold text-slate-950">
              How many jobs am I pursuing?
            </h2>
            <p className="mt-1 text-sm text-slate-600">A clear view of the whole workspace.</p>
          </div>
          <Link to="/applications" className="text-sm font-semibold text-brand-700 hover:underline">
            View applications
          </Link>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total tracked", dashboard.summary.total_tracked, "Every record, including archived"],
            ["Active pursuits", dashboard.summary.active_pursuits, "Applied through offer"],
            ["Drafts", dashboard.summary.drafts, "Still being prepared"],
            ["Accepted", dashboard.summary.accepted, "Successful outcomes"],
          ].map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <dt className="text-sm font-semibold text-slate-600">{label}</dt>
              <dd className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</dd>
              <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="attention-title">
          <h2 id="attention-title" className="text-xl font-bold text-slate-950">
            What needs my attention today?
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Prioritized follow-ups, interviews, and applications that may be waiting too long.
          </p>
          {dashboard.actions.length === 0 ? (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-semibold">You are caught up.</p>
              <p className="mt-1">There are no urgent actions in this workspace.</p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {dashboard.actions.map((action) => {
                const isFollowUp = action.kind.toUpperCase().includes("FOLLOW");
                return (
                  <li key={`${action.kind}-${action.application_id}-${actionDueKey(action)}`} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                          {action.label} · {actionDueLabel(action, timeZone)}
                        </p>
                        <Link
                          to={`/applications/${action.application_id}`}
                          className="mt-1 block font-bold text-slate-950 hover:text-brand-700 hover:underline"
                        >
                          {action.job_title}
                        </Link>
                        <p className="mt-0.5 text-sm text-slate-600">{action.company_name}</p>
                      </div>
                      {isFollowUp ? (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            className={buttonClassName("secondary", "min-h-10 px-3 py-1.5")}
                            disabled={completeMutation.isPending}
                            onClick={() => void complete(action.application_id)}
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                            onClick={() => {
                              setRescheduling(action.application_id);
                              setFollowUpDate("");
                            }}
                          >
                            Reschedule
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {rescheduling === action.application_id ? (
                      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label htmlFor={`reschedule-${action.application_id}`} className="text-xs font-bold text-slate-700">
                            New follow-up date
                          </label>
                          <input
                            id={`reschedule-${action.application_id}`}
                            type="date"
                            value={followUpDate}
                            onChange={(event) => setFollowUpDate(event.target.value)}
                            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                          />
                        </div>
                        <button
                          type="button"
                          className={buttonClassName("primary")}
                          disabled={!followUpDate || rescheduleMutation.isPending}
                          onClick={() => void reschedule(action.application_id)}
                        >
                          Save date
                        </button>
                        <button
                          type="button"
                          className={buttonClassName("secondary")}
                          onClick={() => setRescheduling(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="next-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="next-title" className="text-lg font-bold text-slate-950">What should I do next?</h2>
              <p className="mt-1 text-sm text-slate-600">Your next scheduled conversations.</p>
            </div>
            <Link to="/interviews" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>
          </div>
          {dashboard.upcoming_interviews.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              No interviews are scheduled yet. Keep following up with active opportunities.
            </p>
          ) : (
            <ol className="mt-5 space-y-3">
              {dashboard.upcoming_interviews.slice(0, 5).map((interview) => (
                <li key={interview.interview_id} className="rounded-xl border border-slate-200 p-4">
                  <time className="text-xs font-bold uppercase tracking-wide text-brand-700" dateTime={interview.scheduled_at}>
                    {formatTimestamp(interview.scheduled_at, timeZone)}
                  </time>
                  <Link to={`/applications/${interview.application_id}`} className="mt-1 block font-bold text-slate-950 hover:underline">
                    {interview.job_title ?? "Interview"}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-600">{interview.company_name ?? "Application interview"}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="success-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="success-title" className="text-xl font-bold text-slate-950">How successful has my search been?</h2>
            <p className="mt-1 text-sm text-slate-600">Historical milestones, with the denominator shown.</p>
          </div>
          <Link to="/analytics" className="text-sm font-semibold text-brand-700 hover:underline">Explore analytics</Link>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Response rate", dashboard.rates.response_rate, dashboard.rates.response_count],
            ["Interview rate", dashboard.rates.interview_rate, dashboard.rates.interview_count],
            ["Offer rate", dashboard.rates.offer_rate, dashboard.rates.offer_count],
            ["Acceptance rate", dashboard.rates.acceptance_rate, dashboard.rates.acceptance_count],
          ].map(([label, rate, count]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <dt className="text-sm font-semibold text-slate-600">{label}</dt>
              <dd className="mt-2 text-3xl font-black text-slate-950">{percent(Number(rate))}</dd>
              <p className="mt-2 text-xs text-slate-500">{count} of {dashboard.rates.submitted_count} submitted applications</p>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <figure className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="trend-title">
          <figcaption id="trend-title" className="text-lg font-bold text-slate-950">Submissions over eight weeks</figcaption>
          <p className="mt-1 text-sm text-slate-600">Applications first submitted each week.</p>
          <div className="mt-6 flex h-44 items-end gap-2" aria-hidden="true">
            {dashboard.submission_trend.map((point) => (
              <div key={point.week_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-bold text-slate-600">{point.count}</span>
                <span className="w-full max-w-10 rounded-t bg-brand-500" style={{ height: `${Math.max(4, (point.count / maxTrend) * 120)}px` }} />
              </div>
            ))}
          </div>
          <ul className="sr-only">
            {dashboard.submission_trend.map((point) => <li key={point.week_start}>Week of {formatDateOnly(point.week_start)}: {point.count} submissions</li>)}
          </ul>
        </figure>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="recent-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="recent-title" className="text-lg font-bold text-slate-950">Recently updated</h2>
              <p className="mt-1 text-sm text-slate-600">The latest movement across your search.</p>
            </div>
            <Link to="/applications" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {dashboard.recent_applications.slice(0, 5).map((application) => (
              <li key={application.application_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <Link to={`/applications/${application.application_id}`} className="block truncate font-semibold text-slate-950 hover:underline">{application.job_title}</Link>
                  <p className="truncate text-sm text-slate-600">{application.company_name}</p>
                </div>
                <StatusBadge status={application.status} />
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Current status breakdown</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {dashboard.status_breakdown.filter((item) => item.count > 0).map((item) => (
                <li key={item.status} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {formatStatus(item.status)} · {item.count}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
