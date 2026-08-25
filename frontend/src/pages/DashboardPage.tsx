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
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  type ApplicationSource,
  type ApplicationStatus,
  type DashboardRange,
} from "../api/schemas";
import type { Analytics, Dashboard } from "../api/workspace";
import { buttonClassName } from "../components/ui/buttonStyles";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { PanelSkeleton, Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toastContext";
import { StatusBadge } from "../components/ui/StatusBadge";
import { formatDateOnly, formatTimestamp } from "../features/applications/format";
import { percentagePointDelta } from "../features/analytics/format";
import { useSettings } from "../features/resources/queries";
import {
  readSearchTour,
  SEARCH_TOUR_EVENT,
  updateSearchTour,
  useCompleteFollowUp,
  useAnalytics,
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
const ACTION_GROUP_PREVIEW_LIMIT = 3;

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

function readActionCenterPreference(marker: string | null): boolean | null {
  if (!marker || typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(ACTION_CENTER_STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return null;
    const preference = parsed as Partial<ActionCenterPreference>;
    return (
      preference.version === 1 &&
      preference.workspace_marker === marker &&
      typeof preference.collapsed === "boolean"
    ) ? preference.collapsed : null;
  } catch {
    return null;
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

function analyticsHref(range: DashboardRange) {
  return `/analytics?range=${range}`;
}

function insightActionHref(action: NonNullable<Analytics["insights"][number]["action"]>) {
  if (action.kind === "ADD_APPLICATION") return "/applications/new";
  const parameters = new URLSearchParams();
  const view = action.parameters.view;
  const source = action.parameters.source;
  const status = action.parameters.status;
  const followUp = action.parameters.follow_up;
  if (view === "ALL" || view === "ACTIVE") parameters.set("view", view);
  if (source && APPLICATION_SOURCES.includes(source as ApplicationSource)) {
    parameters.set("source", source);
  }
  if (status && APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
    parameters.set("status", status);
  }
  if (followUp === "NEEDS_ATTENTION") parameters.set("follow_up", followUp);
  return `/applications${parameters.size ? `?${parameters.toString()}` : ""}`;
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
  const [progressDetailsOpen, setProgressDetailsOpen] = useState(false);
  const rangeInitialized = useRef(false);
  const actionCenterWorkspaceMarker = workspaceMarker(session?.access_token);
  const [actionCenterCollapsed, setActionCenterCollapsed] = useState(() =>
    readActionCenterPreference(actionCenterWorkspaceMarker),
  );
  const [expandedActionGroups, setExpandedActionGroups] = useState<Set<AttentionGroup>>(
    () => new Set(),
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
  const analyticsQuery = useAnalytics(
    { range },
    { enabled: progressDetailsOpen },
  );
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
    setExpandedActionGroups(new Set());
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
  const actionCenterIsCollapsed = actionCenterCollapsed ?? dashboard.actions.length > ACTION_GROUP_PREVIEW_LIMIT;
  const overdueCount = groupedActions[0].items.length;
  const todayCount = groupedActions[1].items.length;
  const nextInterview = dashboard.upcoming_interviews[0] ?? null;
  const recentSubmissionCount = dashboard.submission_trend
    .slice(-2)
    .reduce((total, point) => total + point.count, 0);
  const journeyState = dashboard.rates.submitted_count < 5
    ? {
        label: "Building your foundation",
        summary: "Your search is still taking shape. A few well-tracked applications and clear follow-up dates will make the next steps easier to see.",
      }
    : dashboard.upcoming_interviews.length >= 2
      ? {
          label: "Interviews are shaping this chapter",
          summary: "Your immediate focus is preparation and keeping post-interview follow-ups visible while the rest of the pipeline keeps moving.",
        }
      : overdueCount > 0
        ? {
            label: "A short follow-through will move things forward",
            summary: "Your search has active opportunities, with a few overdue items worth clearing before they become harder to act on.",
          }
        : recentSubmissionCount === 0 && dashboard.summary.active_pursuits > 0
          ? {
              label: "Your pipeline is in a quieter stretch",
              summary: "Existing opportunities are still active. This is a useful moment to review next steps without treating quiet activity as a negative outcome.",
            }
          : {
              label: "Your search is actively moving",
              summary: "You have current opportunities in motion. Keep the next conversation and the next follow-up easier to reach than the surrounding detail.",
            };

  function toggleActionCenter() {
    const next = !actionCenterIsCollapsed;
    writeActionCenterPreference(actionCenterWorkspaceMarker, next);
    setActionCenterCollapsed(next);
  }

  function toggleActionGroup(group: AttentionGroup) {
    setExpandedActionGroups((expanded) => {
      const next = new Set(expanded);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
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
    <div className="space-y-10">
      <header className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface-raised via-surface-raised to-accent-soft shadow-panel">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Your search right now</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Welcome back</h1>
              <p className="mt-2 text-xl font-bold text-ink">{journeyState.label}</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">{journeyState.summary}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <label className="sr-only" htmlFor="dashboard-range">Summary range</label>
              <select id="dashboard-range" value={range} onChange={(event) => setRange(event.target.value as DashboardRange)} className="min-h-11 rounded-xl border border-line bg-surface-raised px-3 text-sm font-semibold text-ink">
                <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option>
              </select>
              {overdueCount > 0 ? <a href="#attention-title" className={buttonClassName("primary")}>Review what needs you</a> : nextInterview ? <Link to="/interviews" className={buttonClassName("primary")}>Prepare for interview</Link> : dashboard.rates.submitted_count < 5 ? <Link to="/applications/new" className={buttonClassName("primary")}>Add an application</Link> : <Link to="/analytics?section=pipeline" className={buttonClassName("primary")}>Review pipeline</Link>}
            </div>
          </div>
          <section className="mt-7 border-t border-line pt-6" aria-labelledby="search-overview-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Where you are now</p><h2 id="search-overview-title" className="sr-only">How many jobs am I pursuing?</h2></div>
              <p className="text-sm text-ink-muted"><span>Total tracked</span> <strong className="ml-1 text-ink">{dashboard.summary.total_tracked}</strong></p>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div><dt className="text-sm font-semibold text-ink-muted">Active opportunities</dt><dd className="mt-1 text-3xl font-black text-ink">{dashboard.summary.active_pursuits}</dd><dd className="mt-1 text-xs text-ink-muted">Applied through offer</dd></div>
              <div><dt className="text-sm font-semibold text-ink-muted">Interviews coming up</dt><dd className="mt-1 text-3xl font-black text-ink">{dashboard.upcoming_interviews.length}</dd><dd className="mt-1 text-xs text-ink-muted">Scheduled conversations</dd></div>
              <div><dt className="text-sm font-semibold text-ink-muted">Needs attention</dt><dd className="mt-1 text-3xl font-black text-ink">{overdueCount + todayCount}</dd><dd className="mt-1 text-xs text-ink-muted">Overdue or due today</dd></div>
            </dl>
          </section>
        </div>
      </header>

      {dashboardQuery.isFetching && !dashboardQuery.isPending ? <p className="text-xs font-semibold text-ink-muted" role="status">Refreshing your search story…</p> : null}
      {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
      {completeMutation.error || rescheduleMutation.error ? <ErrorPanel compact title="Follow-up could not be updated" error={completeMutation.error ?? rescheduleMutation.error} /> : null}
      {!tour.dismissed ? <SearchTour tour={tour} onDismiss={dismissTour} /> : null}

      <section aria-labelledby="recent-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Recent movement</p><h2 id="recent-title" className="mt-1 text-2xl font-bold text-ink">What changed recently</h2><p className="mt-1 text-sm text-ink-muted">The opportunities most recently touched in this workspace.</p></div><Link to="/applications" className="text-sm font-bold text-accent hover:underline">View all applications</Link></div>
        {dashboard.recent_applications.length === 0 ? <p className="mt-4 rounded-2xl border border-line bg-surface-raised p-5 text-sm text-ink-muted">There is no recent application activity to catch up on yet.</p> : <ol className="mt-5 border-l-2 border-line pl-5 sm:pl-7">{dashboard.recent_applications.slice(0, 4).map((application) => <li key={application.application_id} className="relative pb-6 last:pb-0"><span aria-hidden="true" className="absolute -left-[1.72rem] top-1.5 size-3 rounded-full border-2 border-surface-raised bg-accent sm:-left-[2.22rem]" /><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link to={`/applications/${application.application_id}`} className="font-bold text-ink hover:text-accent hover:underline">{application.job_title}</Link><p className="mt-0.5 text-sm text-ink-muted">{application.company_name} · updated {formatTimestamp(application.updated_at, timeZone)}</p></div><StatusBadge status={application.status} /></div></li>)}</ol>}
      </section>

      <section aria-labelledby="next-title">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Coming next</p><h2 id="next-title" className="mt-1 text-2xl font-bold text-ink">What should I do next?</h2></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <section className="rounded-3xl border border-line bg-surface-raised p-5 shadow-panel sm:p-6" aria-labelledby="interviews-title"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Next conversation</p><h3 id="interviews-title" className="mt-1 text-xl font-bold text-ink">{nextInterview ? nextInterview.job_title ?? "Upcoming interview" : "No interview is currently scheduled"}</h3></div><CalendarClock aria-hidden="true" className="size-6 text-accent" /></div>{nextInterview ? <><time dateTime={nextInterview.scheduled_at} className="mt-5 block text-lg font-bold text-ink">{formatTimestamp(nextInterview.scheduled_at, timeZone)}</time><p className="mt-1 text-sm text-ink-muted">{nextInterview.company_name ?? "Application interview"}</p><div className="mt-5 flex flex-wrap gap-3"><Link to="/interviews" className={buttonClassName("primary")}>Prepare and review</Link><Link to={`/applications/${nextInterview.application_id}`} className={buttonClassName("secondary")}>Open application</Link></div></> : <><p className="mt-4 text-sm leading-6 text-ink-muted">When a conversation is scheduled, Home will bring the next one forward here.</p><Link to="/analytics?section=pipeline" className="mt-4 inline-flex min-h-11 items-center font-bold text-accent hover:underline">Review active pipeline<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link></>}</section>
          <section className="rounded-3xl border border-line bg-surface-muted p-5 sm:p-6" aria-labelledby="continuity-title"><h3 id="continuity-title" className="text-lg font-bold text-ink">Keep the search moving</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{overdueCount > 0 ? `${overdueCount} overdue ${overdueCount === 1 ? "item is" : "items are"} the clearest next step.` : todayCount > 0 ? `${todayCount} ${todayCount === 1 ? "item is" : "items are"} due today.` : "Nothing needs immediate attention. You can continue without creating urgency."}</p><div className="mt-5 flex flex-col gap-2"><Link to="/applications/new" className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 font-bold text-ink hover:bg-surface-raised">Add an application<ArrowRight aria-hidden="true" className="size-4" /></Link><Link to="/analytics?section=pipeline" className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 font-bold text-ink hover:bg-surface-raised">Review pipeline<ArrowRight aria-hidden="true" className="size-4" /></Link><Link to="/analytics" className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 font-bold text-ink hover:bg-surface-raised">Explore patterns<ArrowRight aria-hidden="true" className="size-4" /></Link></div></section>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="attention-title">
        <div className="border-b border-line bg-gradient-to-r from-accent-soft via-surface-raised to-violet-soft p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">What needs you</p>
              <h2 id="attention-title" className="mt-2 text-2xl font-bold text-slate-950">What needs my attention today?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Prioritized follow-ups, interview preparation, and stalled opportunities.</p>
              {actionCenterIsCollapsed && dashboard.actions.length > 0 ? (
                <p className="mt-3 text-sm font-semibold text-slate-700" aria-live="polite">{actionSummary}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-bold text-white" aria-label={`${dashboard.actions.length} ${dashboard.actions.length === 1 ? "action" : "actions"}`}>{dashboard.actions.length}</span>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-accent-soft"
                aria-expanded={!actionCenterIsCollapsed}
                aria-controls="action-center-content"
                aria-label={actionCenterIsCollapsed ? "Expand action center" : "Collapse action center"}
                onClick={toggleActionCenter}
              >
                <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${actionCenterIsCollapsed ? "" : "rotate-180"}`} />
              </button>
            </div>
          </div>
        </div>
        <div id="action-center-content" hidden={actionCenterIsCollapsed && dashboard.actions.length > 0}>
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
                const groupSlug = name.toLowerCase();
                const groupExpanded = expandedActionGroups.has(name);
                const hasOverflow = items.length > ACTION_GROUP_PREVIEW_LIMIT;
                const visibleItems = groupExpanded
                  ? items
                  : items.slice(0, ACTION_GROUP_PREVIEW_LIMIT);
                const remainingCount = items.length - visibleItems.length;
                return (
                  <section key={name} className="min-w-0 p-5 sm:p-6" aria-labelledby={`attention-${groupSlug}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex size-9 items-center justify-center rounded-xl border ${meta.tone}`}><Icon aria-hidden="true" className="size-4" /></span>
                      <div>
                        <h3 id={`attention-${groupSlug}`} className="font-bold text-slate-950">{name} <span className="text-slate-500">({items.length})</span></h3>
                        <p className="text-xs text-slate-500">{meta.description}</p>
                        {hasOverflow ? <p className="text-xs font-semibold text-slate-500">Showing {visibleItems.length} of {items.length}</p> : null}
                      </div>
                    </div>
                    {items.length === 0 ? <p className="mt-5 text-sm text-slate-500">Nothing here right now.</p> : (
                      <>
                        <ul id={`attention-${groupSlug}-items`} className="mt-4 space-y-3">
                        {visibleItems.map((action) => {
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
                        {hasOverflow ? (
                          <button
                            type="button"
                            className="mt-4 min-h-11 rounded-lg px-2 text-sm font-bold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                            aria-expanded={groupExpanded}
                            aria-controls={`attention-${groupSlug}-items`}
                            aria-label={groupExpanded ? `Show fewer ${groupSlug} actions` : `Show ${remainingCount} more ${groupSlug} ${remainingCount === 1 ? "action" : "actions"}`}
                            onClick={() => toggleActionGroup(name)}
                          >
                            {groupExpanded ? `Show fewer ${groupSlug}` : `Show ${remainingCount} more ${groupSlug}`}
                          </button>
                        ) : null}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="success-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your progress</p><h2 id="success-title" className="mt-1 text-2xl font-bold text-ink">How successful has my search been?</h2><p className="mt-1 text-sm text-ink-muted">A lightweight view of milestones reached, with deeper patterns kept in Analytics.</p></div><Link to={analyticsHref(range)} className="text-sm font-bold text-accent hover:underline">Explore analytics</Link></div><ol className="mt-6 grid gap-2 sm:grid-cols-4">{[["Submitted", dashboard.rates.submitted_count, `${dashboard.rates.submitted_count} tracked submissions`], ["Responses", dashboard.rates.response_count, `${dashboard.rates.response_count} of ${dashboard.rates.submitted_count} submitted applications`], ["Interviews", dashboard.rates.interview_count, `${percent(dashboard.rates.interview_rate)} reached interview`], ["Offers", dashboard.rates.offer_count, `${percent(dashboard.rates.offer_rate)} reached offer`]].map(([label, count, context], index) => <li key={label} className="relative rounded-2xl border border-line bg-surface-raised p-4"><div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-black text-accent">{index + 1}</span><div><p className="text-sm font-bold text-ink">{label}</p><p className="text-2xl font-black text-ink">{count}</p></div></div><p className="mt-3 text-xs text-ink-muted">{context}</p></li>)}</ol><ProgressBrief range={range} open={progressDetailsOpen} onOpenChange={setProgressDetailsOpen} analytics={analyticsQuery.data} isPending={analyticsQuery.isPending} isError={analyticsQuery.isError} error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} /></section>
    </div>
  );
}

function ProgressBrief({
  range,
  open,
  onOpenChange,
  analytics,
  isPending,
  isError,
  error,
  onRetry,
}: {
  range: DashboardRange;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analytics: Analytics | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const comparison = analytics?.period_comparison;
  const insight = analytics?.insights?.[0];
  const coverage = analytics?.follow_up_coverage;
  const maxTrend = Math.max(1, ...(analytics?.submission_trend?.map((point) => point.count) ?? []));

  return (
    <details
      className="mt-4 rounded-2xl border border-line bg-surface-muted"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenChange(!open); } }}>
        View supporting progress details
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </summary>
      <div className="border-t border-line p-4 sm:p-5">
        {open ? <>
        {isPending ? <ProgressBriefSkeleton /> : null}
        {isError ? <ErrorPanel compact title="Progress details could not be loaded" error={error} onRetry={onRetry} /> : null}
        {analytics ? <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Progress brief</p><h3 className="mt-1 text-lg font-bold text-ink">What the recent data is showing</h3></div>
            <Link to={analyticsHref(range)} className="inline-flex min-h-10 items-center font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Open Analytics<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></Link>
          </div>

          {comparison?.available && comparison.current && comparison.deltas ? <section aria-labelledby="progress-comparison-title"><h4 id="progress-comparison-title" className="text-sm font-bold text-ink">Compared with the previous period</h4><p className="mt-1 text-xs leading-5 text-ink-muted"><time dateTime={comparison.previous_start ?? undefined}>{comparison.previous_start ? formatDateOnly(comparison.previous_start) : ""}</time>–<time dateTime={comparison.previous_end ?? undefined}>{comparison.previous_end ? formatDateOnly(comparison.previous_end) : ""}</time> is the adjacent comparison window.</p><dl className="mt-3 grid gap-3 sm:grid-cols-3"><ProgressMetric label="Submissions" value={String(comparison.current.submitted_count)} detail={`${comparison.deltas.submitted_count >= 0 ? "+" : ""}${comparison.deltas.submitted_count} from previous period`} /><ProgressMetric label="Response rate" value={percent(comparison.current.response_rate)} detail={`${percentagePointDelta(comparison.deltas.response_rate)} from previous period`} /><ProgressMetric label="Interview rate" value={percent(comparison.current.interview_rate)} detail={`${percentagePointDelta(comparison.deltas.interview_rate)} from previous period`} /></dl></section> : <section className="rounded-xl border border-line bg-surface-raised p-4" aria-labelledby="progress-comparison-title"><h4 id="progress-comparison-title" className="font-bold text-ink">Complete history, not a period comparison</h4><p className="mt-1 text-sm leading-6 text-ink-muted">All time shows your full tracked history. Choose a 30- or 90-day range to compare equal-length periods.</p></section>}

          <figure aria-labelledby="progress-trend-title"><figcaption id="progress-trend-title" className="text-sm font-bold text-ink">Submission activity</figcaption><p className="mt-1 text-xs leading-5 text-ink-muted">Applications first submitted each week in the selected range.</p>{analytics.submission_trend.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No submissions are available in this range yet.</p> : <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label="Weekly submission activity"><>{analytics.submission_trend.map((point) => <div key={point.week_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Week of ${formatDateOnly(point.week_start)}: ${point.count} submissions`}><span className="text-[0.68rem] font-bold text-ink-muted">{point.count}</span><span aria-hidden="true" className="w-full max-w-10 rounded-t bg-gradient-to-t from-accent to-violet" style={{ height: `${Math.max(4, (point.count / maxTrend) * 64)}px` }} /><time dateTime={point.week_start} className="max-w-full truncate text-[0.62rem] font-semibold text-ink-muted">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.week_start}T00:00:00Z`))}</time></div>)}</></div>}</figure>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface-raised p-4" aria-labelledby="progress-insight-title"><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Search Health</p>{insight ? <><h4 id="progress-insight-title" className="mt-2 font-bold text-ink">{insight.title}</h4><p className="mt-1 text-sm leading-6 text-ink-muted">{insight.description}</p><p className="mt-3 text-xs font-bold leading-5 text-ink">{insight.evidence_summary}</p>{insight.action ? <Link to={insightActionHref(insight.action)} aria-label={`Suggested action: ${insight.action.label}`} className="mt-3 inline-flex min-h-10 items-center font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{insight.action.label}<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></Link> : null}</> : <><h4 id="progress-insight-title" className="mt-2 font-bold text-ink">Still building your picture</h4><p className="mt-1 text-sm leading-6 text-ink-muted">Track more applications and outcomes to surface a useful pattern here.</p></>}</section>
            {coverage && coverage.active_count > 0 ? <section className="rounded-xl border border-line bg-surface-raised p-4" aria-labelledby="progress-coverage-title"><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Next-step coverage</p><h4 id="progress-coverage-title" className="mt-2 font-bold text-ink">{percent(coverage.coverage_rate)} of active opportunities have a next step</h4><p className="mt-1 text-sm leading-6 text-ink-muted">{coverage.scheduled_count} of {coverage.active_count} active applications have a follow-up date scheduled.</p>{coverage.overdue_count + coverage.due_today_count + coverage.missing_count > 0 ? <p className="mt-3 text-xs font-bold leading-5 text-ink">{coverage.overdue_count} overdue · {coverage.due_today_count} due today · {coverage.missing_count} missing a next step</p> : <p className="mt-3 text-xs font-bold leading-5 text-success">Every active opportunity has a next step scheduled.</p>}</section> : <section className="rounded-xl border border-line bg-surface-raised p-4" aria-labelledby="progress-coverage-title"><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Next-step coverage</p><h4 id="progress-coverage-title" className="mt-2 font-bold text-ink">No active opportunities to schedule yet</h4><p className="mt-1 text-sm leading-6 text-ink-muted">When applications become active, HireFlux will show how much of the pipeline has a planned next step.</p></section>}
          </div>
        </div> : null}
        </> : null}
      </div>
    </details>
  );
}

function ProgressMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-line bg-surface-raised p-4"><dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</dt><dd className="mt-2 text-2xl font-black text-ink">{value}</dd><dd className="mt-1 text-xs leading-5 text-ink-muted">{detail}</dd></div>;
}

function ProgressBriefSkeleton() {
  return <div className="space-y-5" role="status" aria-label="Loading supporting progress details"><span className="sr-only">Loading supporting progress details…</span><Skeleton className="h-5 w-52" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} rounded="lg" className="h-28 w-full" />)}</div><Skeleton className="h-28 w-full" /></div>;
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
  const nextStep = steps.find(([key]) => !tour[key]);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface-raised p-4 shadow-panel sm:p-5" aria-labelledby="search-tour-title">
      <Sparkles aria-hidden="true" className="absolute -right-5 -top-5 size-24 text-accent opacity-10" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Search tour · {completed}/3</p><h2 id="search-tour-title" className="mt-1 text-lg font-bold text-ink">Three ways to explore HireFlux</h2><p className="mt-1 text-sm text-ink-muted">{nextStep ? `Next: ${nextStep[1]}.` : "The hands-on tour is complete."}</p></div>
        <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={onDismiss} aria-label="Dismiss search tour"><X aria-hidden="true" className="size-4" /></button>
      </div>
      <details className="relative mt-3 border-t border-line pt-3"><summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-bold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">View tour details<ChevronDown aria-hidden="true" className="size-4" /></summary><ol className="mt-3 grid gap-3 lg:grid-cols-3">{steps.map(([key, title, description, href]) => <li key={key} className="rounded-xl border border-line bg-surface-muted p-4"><div className="flex gap-3">{tour[key] ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Check aria-hidden="true" className="size-4" /></span> : <Circle aria-hidden="true" className="size-7 shrink-0 text-ink-subtle" />}<div className="min-w-0"><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>{!tour[key] ? <Link to={href} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-accent hover:underline">Try it<ArrowRight aria-hidden="true" className="size-3.5" /></Link> : <p className="mt-3 text-sm font-semibold text-emerald-800">Completed</p>}</div></div></li>)}</ol></details>
    </section>
  );
}
