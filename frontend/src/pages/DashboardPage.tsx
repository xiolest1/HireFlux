import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDemoSession } from "../auth/demoSessionContext";
import type { DashboardRange } from "../api/schemas";
import type { Dashboard } from "../api/workspace";
import { buttonClassName } from "../components/ui/buttonStyles";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { PanelSkeleton, Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toastContext";
import { StatusBadge } from "../components/ui/StatusBadge";
import { formatDateOnly, formatStatus, formatTimestamp } from "../features/applications/format";
import { useSettings } from "../features/resources/queries";
import {
  readSearchTour,
  SEARCH_TOUR_EVENT,
  updateSearchTour,
  useCompleteFollowUp,
  useDashboard,
  useRescheduleFollowUp,
  type SearchTourState,
} from "../features/workspace/queries";

function percent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

type DashboardAction = Dashboard["actions"][number];
type AttentionGroup = "Overdue" | "Today" | "Upcoming";

const ACTION_CENTER_STORAGE_KEY = "hireflux-action-center.v1";

interface ActionCenterPreference {
  version: 1;
  workspace_marker: string;
  collapsed: boolean;
}

function workspaceMarker(accessToken: string | undefined): string | null {
  if (!accessToken) return null;

  // The preference only needs a stable, non-secret workspace key. Do not store
  // the demo token itself alongside the UI preference.
  let hash = 2_166_136_261;
  for (const character of accessToken) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `demo-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function readActionCenterPreference(marker: string | null): boolean {
  if (!marker || typeof window === "undefined") return false;
  try {
    const stored = window.sessionStorage.getItem(ACTION_CENTER_STORAGE_KEY);
    if (!stored) return false;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return false;
    const preference = parsed as Partial<ActionCenterPreference>;
    return (
      preference.version === 1 &&
      preference.workspace_marker === marker &&
      typeof preference.collapsed === "boolean" &&
      preference.collapsed
    );
  } catch {
    return false;
  }
}

function writeActionCenterPreference(marker: string | null, collapsed: boolean): void {
  if (!marker || typeof window === "undefined") return;
  const preference: ActionCenterPreference = {
    version: 1,
    workspace_marker: marker,
    collapsed,
  };
  try {
    window.sessionStorage.setItem(ACTION_CENTER_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // The panel remains usable if browser storage is unavailable.
  }
}

function actionDueLabel(action: DashboardAction, timeZone: string) {
  return "due_date" in action
    ? formatDateOnly(action.due_date)
    : formatTimestamp(action.due_at, timeZone);
}

function actionDueKey(action: DashboardAction) {
  return "due_date" in action ? action.due_date : action.due_at;
}

function attentionGroup(action: DashboardAction): AttentionGroup {
  if (action.kind === "FOLLOW_UP_TODAY") return "Today";
  if (action.kind === "INTERVIEW_SOON") return "Upcoming";
  return "Overdue";
}

const groupMeta: Record<AttentionGroup, { description: string; icon: typeof Clock3; tone: string }> = {
  Overdue: {
    description: "Handle these first",
    icon: TriangleAlert,
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  Today: {
    description: "Due before the day ends",
    icon: Clock3,
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  Upcoming: {
    description: "Prepare for what is next",
    icon: CalendarClock,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
};

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useDemoSession();
  const [range, setRange] = useState<DashboardRange>("30d");
  const rangeInitialized = useRef(false);
  const actionCenterWorkspaceMarker = workspaceMarker(session?.access_token);
  const [actionCenterCollapsed, setActionCenterCollapsed] = useState(() =>
    readActionCenterPreference(actionCenterWorkspaceMarker),
  );
  const settingsQuery = useSettings();
  const { showToast } = useToast();
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [tour, setTour] = useState<SearchTourState>(readSearchTour);
  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state;
    return state && typeof state === "object" && "notice" in state && typeof state.notice === "string"
      ? state.notice
      : null;
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
    setActionCenterCollapsed(readActionCenterPreference(actionCenterWorkspaceMarker));
  }, [actionCenterWorkspaceMarker]);

  useEffect(() => {
    const state = location.state;
    if (state && typeof state === "object" && "notice" in state && typeof state.notice === "string") {
      setNotice(state.notice);
    }
    if (state) void navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const syncTour = () => setTour(readSearchTour());
    window.addEventListener(SEARCH_TOUR_EVENT, syncTour);
    return () => window.removeEventListener(SEARCH_TOUR_EVENT, syncTour);
  }, []);

  if (dashboardQuery.isPending) {
    return <DashboardSkeleton />;
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
  const groupedActions = (["Overdue", "Today", "Upcoming"] as const).map((name) => ({
    name,
    items: dashboard.actions.filter((action) => attentionGroup(action) === name),
  }));
  const actionSummary = [
    `${dashboard.actions.length} ${dashboard.actions.length === 1 ? "action" : "actions"}`,
    `${groupedActions[0].items.length} overdue`,
    `${groupedActions[1].items.length} today`,
    `${groupedActions[2].items.length} upcoming`,
  ].join(" · ");

  function toggleActionCenter() {
    setActionCenterCollapsed((collapsed) => {
      const next = !collapsed;
      writeActionCenterPreference(actionCenterWorkspaceMarker, next);
      return next;
    });
  }

  async function complete(applicationId: string) {
    try {
      await completeMutation.mutateAsync(applicationId);
      showToast("Follow-up completed.", { title: "Follow-up updated" });
    } catch {
      return;
    }
  }

  async function reschedule(applicationId: string) {
    if (!followUpDate) return;
    try {
      await rescheduleMutation.mutateAsync({ applicationId, followUpDate });
      setRescheduling(null);
      setFollowUpDate("");
      showToast("Follow-up rescheduled.", { title: "Follow-up updated" });
    } catch {
      return;
    }
  }

  function dismissTour() {
    setTour(updateSearchTour("dismissed"));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Workspace home</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Welcome back</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Start with what needs attention, then keep the rest of your search moving.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="dashboard-range">Summary range</label>
          <select
            id="dashboard-range"
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardRange)}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Link to="/applications/new" className={buttonClassName("primary")}>Add application</Link>
        </div>
      </header>

      {dashboardQuery.isFetching && !dashboardQuery.isPending ? (
        <p className="text-xs font-semibold text-slate-500" role="status">Refreshing dashboard…</p>
      ) : null}
      {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
      {completeMutation.error || rescheduleMutation.error ? (
        <ErrorPanel compact title="Follow-up could not be updated" error={completeMutation.error ?? rescheduleMutation.error} />
      ) : null}

      {!tour.dismissed ? <SearchTour tour={tour} onDismiss={dismissTour} /> : null}

      <section aria-labelledby="search-overview-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="search-overview-title" className="text-xl font-bold text-slate-950">How many jobs am I pursuing?</h2>
            <p className="mt-1 text-sm text-slate-600">A compact view of your whole workspace.</p>
          </div>
          <Link to="/applications" className="text-sm font-semibold text-brand-700 hover:underline">View applications</Link>
        </div>
        <ul className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total tracked", dashboard.summary.total_tracked, "All records", "/applications?view=ALL"],
            ["Active pursuits", dashboard.summary.active_pursuits, "Applied through offer", "/applications?view=ACTIVE"],
            ["Drafts", dashboard.summary.drafts, "Still being prepared", "/applications?view=ALL&status=DRAFT"],
            ["Accepted", dashboard.summary.accepted, "Successful outcomes", "/applications?view=ALL&status=ACCEPTED"],
          ].map(([label, value, hint, href]) => (
            <li key={label} className="border-b border-slate-200 last:border-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0">
              <Link to={String(href)} className="group grid min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 p-5 hover:bg-slate-50">
                <p className="self-end text-sm font-semibold text-slate-600">{label}</p>
                <p className="self-start text-xs text-slate-500">{hint}</p>
                <p className="row-span-2 row-start-1 flex items-center gap-2 text-3xl font-black tracking-tight text-slate-950">
                  {value}<ArrowRight aria-hidden="true" className="size-4 text-slate-400 transition-transform group-hover:translate-x-1" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="attention-title">
        <div className="border-b border-line bg-gradient-to-r from-accent-soft via-surface-raised to-violet-soft p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Action center</p>
              <h2 id="attention-title" className="mt-2 text-2xl font-bold text-slate-950">What needs my attention today?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Prioritized follow-ups, interview preparation, and stalled opportunities.</p>
              {actionCenterCollapsed && dashboard.actions.length > 0 ? (
                <p className="mt-3 text-sm font-semibold text-slate-700" aria-live="polite">{actionSummary}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-bold text-white" aria-label={`${dashboard.actions.length} ${dashboard.actions.length === 1 ? "action" : "actions"}`}>{dashboard.actions.length}</span>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-accent-soft"
                aria-expanded={!actionCenterCollapsed}
                aria-controls="action-center-content"
                aria-label={actionCenterCollapsed ? "Expand action center" : "Collapse action center"}
                onClick={toggleActionCenter}
              >
                <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${actionCenterCollapsed ? "" : "rotate-180"}`} />
              </button>
            </div>
          </div>
        </div>
        <div id="action-center-content" hidden={actionCenterCollapsed && dashboard.actions.length > 0}>
          {dashboard.actions.length === 0 ? (
            <div className="m-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 sm:m-6">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div><p className="font-semibold">You are caught up.</p><p className="mt-1 text-sm">There are no urgent actions in this workspace.</p></div>
            </div>
          ) : (
            <div className="grid divide-y divide-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {groupedActions.map(({ name, items }) => {
                const meta = groupMeta[name];
                const Icon = meta.icon;
                return (
                  <section key={name} className="min-w-0 p-5 sm:p-6" aria-labelledby={`attention-${name.toLowerCase()}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex size-9 items-center justify-center rounded-xl border ${meta.tone}`}><Icon aria-hidden="true" className="size-4" /></span>
                      <div><h3 id={`attention-${name.toLowerCase()}`} className="font-bold text-slate-950">{name} <span className="text-slate-500">({items.length})</span></h3><p className="text-xs text-slate-500">{meta.description}</p></div>
                    </div>
                    {items.length === 0 ? <p className="mt-5 text-sm text-slate-500">Nothing here right now.</p> : (
                      <ul className="mt-4 space-y-3">
                        {items.map((action) => {
                          const isFollowUp = action.kind.startsWith("FOLLOW_UP");
                          return (
                            <li key={`${action.kind}-${action.application_id}-${actionDueKey(action)}`} className="rounded-2xl border border-slate-200 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-bold uppercase tracking-wide text-brand-700">{action.priority} priority</span>
                                <time className="text-xs font-semibold text-slate-500" dateTime={actionDueKey(action)}>{actionDueLabel(action, timeZone)}</time>
                              </div>
                              <Link to={`/applications/${action.application_id}`} className="mt-2 block font-bold text-slate-950 hover:text-brand-700 hover:underline">{action.job_title}</Link>
                              <p className="mt-0.5 text-sm text-slate-600">{action.company_name}</p>
                              <p className="mt-2 text-xs leading-5 text-slate-500">{action.label}</p>
                              <span className="sr-only">{action.label} · {actionDueLabel(action, timeZone)}</span>
                              {isFollowUp ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button type="button" className={buttonClassName("secondary", "min-h-10 px-3 py-1.5")} disabled={completeMutation.isPending} onClick={() => void complete(action.application_id)}>Complete</button>
                                  <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50" onClick={() => { setRescheduling(action.application_id); setFollowUpDate(""); }}>Reschedule</button>
                                </div>
                              ) : null}
                              {rescheduling === action.application_id ? (
                                <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                                  <label htmlFor={`reschedule-${action.application_id}`} className="text-xs font-bold text-slate-700">New follow-up date</label>
                                  <input id={`reschedule-${action.application_id}`} type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
                                  <div className="flex gap-2"><button type="button" className={buttonClassName("primary", "min-h-10 px-3")} disabled={!followUpDate || rescheduleMutation.isPending} onClick={() => void reschedule(action.application_id)}>Save date</button><button type="button" className={buttonClassName("ghost", "min-h-10 px-3")} onClick={() => setRescheduling(null)}>Cancel</button></div>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="success-title">
        <div className="flex items-end justify-between gap-4">
          <div><h2 id="success-title" className="text-xl font-bold text-slate-950">How successful has my search been?</h2><p className="mt-1 text-sm text-slate-600">Historical milestones with the submitted denominator shown.</p></div>
          <Link to="/analytics" className="text-sm font-semibold text-brand-700 hover:underline">Explore analytics</Link>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Response rate", dashboard.rates.response_rate, dashboard.rates.response_count],
            ["Interview rate", dashboard.rates.interview_rate, dashboard.rates.interview_count],
            ["Offer rate", dashboard.rates.offer_rate, dashboard.rates.offer_count],
            ["Acceptance rate", dashboard.rates.acceptance_rate, dashboard.rates.acceptance_count],
          ].map(([label, rate, count]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <dt className="text-sm font-semibold text-slate-600">{label}</dt>
              <dd className="mt-2 text-3xl font-black text-slate-950">{percent(Number(rate))}</dd>
              <dd className="mt-2 text-xs text-slate-500">{count} of {dashboard.rates.submitted_count} submitted applications</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="next-title">
        <h2 id="next-title" className="text-xl font-bold text-slate-950">What should I do next?</h2>
        <p className="mt-1 text-sm text-slate-600">Prepare for scheduled conversations and review recent movement.</p>
        <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="interviews-title">
            <div className="flex justify-between gap-3"><h3 id="interviews-title" className="font-bold text-slate-950">Next interviews</h3><Link to="/interviews" className="text-sm font-semibold text-brand-700 hover:underline">View schedule</Link></div>
            {dashboard.upcoming_interviews.length === 0 ? <p className="mt-4 text-sm leading-6 text-slate-600">No interviews are scheduled yet.</p> : (
              <ol className="mt-4 space-y-3">{dashboard.upcoming_interviews.slice(0, 3).map((interview) => <li key={interview.interview_id} className="rounded-xl border border-slate-200 p-4"><time className="text-xs font-bold uppercase tracking-wide text-brand-700" dateTime={interview.scheduled_at}>{formatTimestamp(interview.scheduled_at, timeZone)}</time><Link to={`/applications/${interview.application_id}`} className="mt-1 block font-bold text-slate-950 hover:underline">{interview.job_title ?? "Interview"}</Link><p className="text-sm text-slate-600">{interview.company_name ?? "Application interview"}</p></li>)}</ol>
            )}
          </section>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="recent-title">
            <div className="flex justify-between gap-3"><h3 id="recent-title" className="font-bold text-slate-950">Recently updated</h3><Link to="/applications" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link></div>
            <ul className="mt-4 divide-y divide-slate-100">{dashboard.recent_applications.slice(0, 5).map((application) => <li key={application.application_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><Link to={`/applications/${application.application_id}`} className="block truncate font-semibold text-slate-950 hover:underline">{application.job_title}</Link><p className="truncate text-sm text-slate-600">{application.company_name}</p></div><StatusBadge status={application.status} /></li>)}</ul>
            <div className="mt-5 border-t border-slate-100 pt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Current status breakdown</h4><ul className="mt-3 flex flex-wrap gap-2">{dashboard.status_breakdown.filter((item) => item.count > 0).map((item) => <li key={item.status} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{formatStatus(item.status)} · {item.count}</li>)}</ul></div>
          </section>
        </div>
      </section>

      <figure className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="trend-title">
        <figcaption id="trend-title" className="text-lg font-bold text-slate-950">Submissions over eight weeks</figcaption>
        <p className="mt-1 text-sm text-slate-600">Applications first submitted each week.</p>
        {dashboard.submission_trend.length === 0 ? <p className="mt-6 text-sm text-slate-500">No submissions in this period.</p> : (
          <div className="mt-6 flex h-52 items-end gap-2" role="img" aria-label="Weekly application submission chart">
            {dashboard.submission_trend.map((point) => (
              <div key={point.week_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`Week of ${formatDateOnly(point.week_start)}: ${point.count} submissions`}>
                <span className="text-xs font-bold text-slate-600">{point.count}</span>
                <span aria-hidden="true" className="w-full max-w-12 rounded-t bg-gradient-to-t from-brand-600 to-violet-500" style={{ height: `${Math.max(4, (point.count / maxTrend) * 128)}px` }} />
                <time dateTime={point.week_start} className="max-w-full truncate text-[0.68rem] font-semibold text-slate-500">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.week_start}T00:00:00Z`))}</time>
              </div>
            ))}
          </div>
        )}
      </figure>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Preparing your workspace home">
      <span className="sr-only">Preparing your workspace home…</span>
      <div aria-hidden="true" className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-2xl space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="flex gap-3"><Skeleton className="h-11 w-32" /><Skeleton className="h-11 w-40" /></div>
      </div>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} rounded="lg" className="h-28 w-full" />)}
      </div>
      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-3">
        <PanelSkeleton rows={4} /><PanelSkeleton rows={3} /><PanelSkeleton rows={4} />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} rounded="lg" className="h-32 w-full" />)}
      </div>
    </div>
  );
}

function SearchTour({ tour, onDismiss }: { tour: SearchTourState; onDismiss: () => void }) {
  const steps: Array<[keyof Pick<SearchTourState, "status" | "engagement" | "analytics">, string, string, string]> = [
    ["status", "Move an application forward", "Try the status control on an application.", "/applications"],
    ["engagement", "Capture the next conversation", "Add a note or schedule an interview.", "/applications"],
    ["analytics", "Explore search insights", "See the story behind the sample workspace.", "/analytics"],
  ];
  const completed = steps.filter(([key]) => tour[key]).length;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-soft via-surface-raised to-violet-soft p-5 shadow-panel sm:p-6" aria-labelledby="search-tour-title">
      <Sparkles aria-hidden="true" className="absolute -right-6 -top-6 size-32 text-accent opacity-20" />
      <div className="relative flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Search tour · {completed}/3</p><h2 id="search-tour-title" className="mt-2 text-xl font-bold text-slate-950">Three ways to explore HireFlux</h2><p className="mt-1 text-sm text-slate-600">A short hands-on tour of your personal job-search workflow.</p></div>
        <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-white" onClick={onDismiss} aria-label="Dismiss search tour"><X aria-hidden="true" className="size-4" /></button>
      </div>
      <ol className="relative mt-5 grid gap-3 lg:grid-cols-3">
        {steps.map(([key, title, description, href]) => (
          <li key={key} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div className="flex gap-3">
              {tour[key] ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Check aria-hidden="true" className="size-4" /></span> : <Circle aria-hidden="true" className="size-7 shrink-0 text-slate-300" />}
              <div className="min-w-0"><p className="font-bold text-slate-950">{title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>{!tour[key] ? <Link to={href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Try it <ArrowRight aria-hidden="true" className="size-3.5" /></Link> : <p className="mt-3 text-sm font-semibold text-emerald-800">Completed</p>}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
