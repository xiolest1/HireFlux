import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleGauge,
  Clock3,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
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
import { CollapsibleRegion, PendingIndicator } from "../components/ui/Motion";
import { useReducedMotion } from "../components/ui/motionHooks";
import { useToast } from "../components/ui/toastContext";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WorkspaceFrame } from "../components/ui/WorkspaceComposition";
import { formatDateOnly, formatTimestamp } from "../features/applications/format";
import {
  applicationCreateRouteState,
  readApplicationCreatedRouteState,
} from "../features/applications/createNavigation";
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
    tone: "border-danger/25 bg-danger-soft text-danger",
  },
  Today: {
    description: "Due before the day ends",
    icon: Clock3,
    tone: "border-warning/25 bg-warning-soft text-warning",
  },
  Upcoming: {
    description: "Prepare for what is next",
    icon: CalendarClock,
    tone: "border-info/25 bg-info-soft text-info",
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
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);
  const [departingAction, setDepartingAction] = useState<DashboardAction | null>(null);
  const [recentlyRescheduledId, setRecentlyRescheduledId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const [followUpDate, setFollowUpDate] = useState("");
  const [tour, setTour] = useState<SearchTourState>(readSearchTour);
  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state;
    return state && typeof state === "object" && "notice" in state && typeof state.notice === "string"
      ? state.notice
      : null;
  });
  const [createdState, setCreatedState] = useState(() =>
    readApplicationCreatedRouteState(location.state),
  );
  const dashboardQuery = useDashboard(range);
  const analyticsQuery = useAnalytics({ range });
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
      setCreatedState(readApplicationCreatedRouteState(state));
    }
    if (state) void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

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
  const progressAnalytics = analyticsQuery.data?.range === range ? analyticsQuery.data : undefined;
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const displayedActions = departingAction && !dashboard.actions.some((action) =>
    action.application_id === departingAction.application_id && action.kind === departingAction.kind
  ) ? [...dashboard.actions, departingAction] : dashboard.actions;
  const groupedActions = (["Overdue", "Today", "Upcoming"] as const).map((name) => ({
    name,
    items: displayedActions.filter((action) => attentionGroup(action) === name),
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

  async function complete(action: DashboardAction) {
    setResolvingActionId(action.application_id);
    try {
      await completeMutation.mutateAsync(action.application_id);
      setDepartingAction(action);
      showToast("Follow-up completed.", { title: "Follow-up updated" });
      window.setTimeout(() => {
        setDepartingAction(null);
        setResolvingActionId(null);
      }, reducedMotion ? 0 : 360);
    } catch {
      setResolvingActionId(null);
      return;
    }
  }

  async function reschedule(applicationId: string) {
    if (!followUpDate) return;
    try {
      await rescheduleMutation.mutateAsync({ applicationId, followUpDate });
      setRescheduling(null);
      setFollowUpDate("");
      setRecentlyRescheduledId(applicationId);
      showToast("Follow-up rescheduled.", { title: "Follow-up updated" });
      window.setTimeout(() => setRecentlyRescheduledId(null), reducedMotion ? 0 : 1000);
    } catch {
      return;
    }
  }

  function dismissTour() {
    setTour(updateSearchTour("dismissed"));
  }

  return (
    <WorkspaceFrame width="standard" className="space-y-12">
      <header className="overflow-hidden rounded-[2.25rem] bg-surface-raised shadow-panel ring-1 ring-line dark:bg-gradient-to-br dark:from-surface-raised dark:via-surface-raised dark:to-accent-soft">
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
              {overdueCount > 0 ? <a href="#attention-title" className={buttonClassName("primary")}>Review what needs you</a> : nextInterview ? <Link to="/interviews" className={buttonClassName("primary")}>Prepare for interview</Link> : dashboard.rates.submitted_count < 5 ? <Link to="/applications/new" state={applicationCreateRouteState("dashboard", location.pathname, location.search)} className={buttonClassName("primary")}>Add an application</Link> : <Link to="/analytics?section=pipeline" className={buttonClassName("primary")}>Review pipeline</Link>}
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
      {notice ? <SuccessBanner><span className="flex flex-wrap items-center justify-between gap-3"><span>{notice}</span>{createdState ? <Link to={`/applications/${createdState.createdApplicationId}`} className="font-semibold underline underline-offset-4">View application</Link> : null}</span></SuccessBanner> : null}
      {completeMutation.error || rescheduleMutation.error ? <ErrorPanel compact title="Follow-up could not be updated" error={completeMutation.error ?? rescheduleMutation.error} /> : null}
      {!tour.dismissed ? <SearchTour tour={tour} onDismiss={dismissTour} /> : null}

      <section aria-labelledby="recent-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Recent movement</p><h2 id="recent-title" className="mt-1 text-2xl font-bold text-ink">What changed recently</h2><p className="mt-1 text-sm text-ink-muted">The opportunities most recently touched in this workspace.</p></div><Link to="/applications" className="text-sm font-bold text-accent hover:underline">View all applications</Link></div>
        {dashboard.recent_applications.length === 0 ? <p className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-muted">There is no recent application activity to catch up on yet.</p> : <ol className="mt-5 border-l border-line-strong/60 pl-5 sm:pl-7">{dashboard.recent_applications.slice(0, 4).map((application) => <li key={application.application_id} className="relative pb-6 last:pb-0"><span aria-hidden="true" className="absolute -left-[1.56rem] top-1.5 size-2.5 rounded-full border-2 border-canvas bg-line-strong sm:-left-[2.06rem]" /><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link to={`/applications/${application.application_id}`} className="font-bold text-ink hover:text-accent hover:underline">{application.job_title}</Link><p className="mt-0.5 text-sm text-ink-muted">{application.company_name} · updated {formatTimestamp(application.updated_at, timeZone)}</p></div><StatusBadge status={application.status} /></div></li>)}</ol>}
      </section>

      <section aria-labelledby="next-title">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Coming next</p><h2 id="next-title" className="mt-1 text-2xl font-bold text-ink">What should I do next?</h2></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <section className="rounded-3xl border border-line bg-surface-raised p-5 sm:p-6" aria-labelledby="interviews-title"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-tertiary">Next conversation</p><h3 id="interviews-title" className="mt-1 text-xl font-bold text-ink">{nextInterview ? nextInterview.job_title ?? "Upcoming interview" : "No interview is currently scheduled"}</h3></div><CalendarClock aria-hidden="true" className="size-6 text-accent" /></div>{nextInterview ? <><time dateTime={nextInterview.scheduled_at} className="mt-5 block text-lg font-bold text-ink">{formatTimestamp(nextInterview.scheduled_at, timeZone)}</time><p className="mt-1 text-sm text-ink-muted">{nextInterview.company_name ?? "Application interview"}</p><div className="mt-5 flex flex-wrap gap-3"><Link to="/interviews" className={buttonClassName("primary")}>Prepare and review</Link><Link to={`/applications/${nextInterview.application_id}`} className={buttonClassName("secondary")}>Open application</Link></div></> : <><p className="mt-4 text-sm leading-6 text-ink-muted">When a conversation is scheduled, Home will bring the next one forward here.</p><Link to="/analytics?section=pipeline" className="mt-4 inline-flex min-h-11 items-center font-bold text-accent hover:underline">Review active pipeline<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link></>}</section>
          <section className="rounded-3xl bg-surface-muted p-5 sm:p-6" aria-labelledby="continuity-title"><h3 id="continuity-title" className="text-lg font-bold text-ink">Keep the search moving</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{overdueCount > 0 ? `${overdueCount} overdue ${overdueCount === 1 ? "item is" : "items are"} the clearest next step.` : todayCount > 0 ? `${todayCount} ${todayCount === 1 ? "item is" : "items are"} due today.` : "Nothing needs immediate attention. You can continue without creating urgency."}</p><div className="mt-5 flex flex-col gap-2"><Link to="/applications/new" state={applicationCreateRouteState("dashboard", location.pathname, location.search)} className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 font-bold text-ink hover:bg-surface-hover active:bg-surface-pressed">Add an application<ArrowRight aria-hidden="true" className="size-4" /></Link><Link to="/analytics?section=pipeline" className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 font-bold text-ink hover:bg-surface-hover active:bg-surface-pressed">Review pipeline<ArrowRight aria-hidden="true" className="size-4" /></Link><Link to="/analytics" className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 font-bold text-ink hover:bg-surface-hover active:bg-surface-pressed">Explore patterns<ArrowRight aria-hidden="true" className="size-4" /></Link></div></section>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-line bg-surface-raised dark:shadow-panel" aria-labelledby="attention-title">
        <div className="border-b border-line-subtle bg-surface-muted p-5 sm:p-6 dark:bg-gradient-to-r dark:from-accent-soft dark:via-surface-raised dark:to-violet-soft">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-tertiary">What needs you</p>
              <h2 id="attention-title" className="mt-2 text-2xl font-bold text-ink">What needs my attention today?</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">Prioritized follow-ups, interview preparation, and stalled opportunities.</p>
              {actionCenterIsCollapsed && dashboard.actions.length > 0 ? (
                <p className="mt-3 text-sm font-semibold text-ink-muted" aria-live="polite">{actionSummary}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-surface-raised" aria-label={`${dashboard.actions.length} ${dashboard.actions.length === 1 ? "action" : "actions"}`}>{dashboard.actions.length}</span>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink active:bg-surface-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
        <CollapsibleRegion id="action-center-content" open={!actionCenterIsCollapsed || dashboard.actions.length === 0}>
          {displayedActions.length === 0 ? (
            <div className="m-5 flex items-start gap-3 rounded-2xl border border-success/25 bg-success-soft p-5 text-success sm:m-6">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div><p className="font-semibold">You are caught up.</p><p className="mt-1 text-sm">There are no urgent actions in this workspace.</p></div>
            </div>
          ) : (
            <div className="grid divide-y divide-line-subtle lg:grid-cols-3 lg:divide-x lg:divide-y-0">
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
                        <h3 id={`attention-${groupSlug}`} className="font-bold text-ink">{name} <span className="text-ink-tertiary">({items.length})</span></h3>
                        <p className="text-xs text-ink-tertiary">{meta.description}</p>
                        {hasOverflow ? <p className="text-xs font-semibold text-ink-tertiary">Showing {visibleItems.length} of {items.length}</p> : null}
                      </div>
                    </div>
                    {items.length === 0 ? <p className="mt-5 text-sm text-ink-tertiary">Nothing here right now.</p> : (
                      <>
                        <ul id={`attention-${groupSlug}-items`} className="mt-4 space-y-3">
                        {visibleItems.map((action) => {
                          const isFollowUp = action.kind.startsWith("FOLLOW_UP");
                          return (
                            <li
                              key={`${action.kind}-${action.application_id}-${actionDueKey(action)}`}
                              className={`rounded-2xl border border-line-subtle bg-surface p-4 transition-[opacity,transform] duration-[var(--motion-state)] ${departingAction?.application_id === action.application_id ? "hf-action-resolve" : ""} ${recentlyRescheduledId === action.application_id ? "hf-state-emphasis" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-bold uppercase tracking-wide text-accent-strong">{action.priority} priority</span>
                                <time className="text-xs font-semibold text-ink-tertiary" dateTime={actionDueKey(action)}>{actionDueLabel(action, timeZone)}</time>
                              </div>
                              <Link to={`/applications/${action.application_id}`} className="mt-2 block font-bold text-ink hover:text-accent hover:underline">{action.job_title}</Link>
                              <p className="mt-0.5 text-sm text-ink-muted">{action.company_name}</p>
                              <p className="mt-2 text-xs leading-5 text-ink-tertiary">{action.label}</p>
                              <span className="sr-only">{action.label} · {actionDueLabel(action, timeZone)}</span>
                              {isFollowUp ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {departingAction?.application_id === action.application_id ? (
                                    <span className="inline-flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-success" role="status"><Check aria-hidden="true" className="size-4" />Completed</span>
                                  ) : (
                                    <button type="button" className={buttonClassName("secondary", "min-h-10 px-3 py-1.5")} disabled={resolvingActionId === action.application_id} onClick={() => void complete(action)}>{resolvingActionId === action.application_id ? <PendingIndicator label="Completing…" /> : "Complete"}</button>
                                  )}
                                  <button type="button" disabled={resolvingActionId === action.application_id} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-surface-hover active:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setRescheduling(action.application_id); setFollowUpDate(""); }}>Reschedule</button>
                                </div>
                              ) : null}
                              {rescheduling === action.application_id ? (
                                <div className="mt-3 space-y-2 rounded-xl bg-surface-muted p-3">
                                  <label htmlFor={`reschedule-${action.application_id}`} className="text-xs font-bold text-ink">New follow-up date</label>
                                  <input id={`reschedule-${action.application_id}`} type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="hf-field min-h-11 w-full rounded-lg px-3 text-sm" />
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
                            className="mt-4 min-h-11 rounded-lg px-2 text-sm font-bold text-accent hover:bg-surface-hover active:bg-surface-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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
        </CollapsibleRegion>
      </section>

      <ProgressStory
        dashboard={dashboard}
        range={range}
        createState={applicationCreateRouteState("dashboard", location.pathname, location.search)}
        open={progressDetailsOpen}
        onOpenChange={setProgressDetailsOpen}
        analytics={progressAnalytics}
        isPending={analyticsQuery.isPending || (analyticsQuery.isFetching && !progressAnalytics)}
        isError={analyticsQuery.isError}
        onRetry={() => void analyticsQuery.refetch()}
      />
    </WorkspaceFrame>
  );
}

function ProgressStory({
  dashboard,
  range,
  createState,
  open,
  onOpenChange,
  analytics,
  isPending,
  isError,
  onRetry,
}: {
  dashboard: Dashboard;
  range: DashboardRange;
  createState: ReturnType<typeof applicationCreateRouteState>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analytics: Analytics | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const rates = analytics?.rates ?? (dashboard.range === range ? dashboard.rates : undefined);
  const narrative = analytics?.progress_narrative;
  const tone = narrative?.tone ?? "NEUTRAL";
  const focus = narrative?.recommended_focus;

  return (
    <section aria-labelledby="progress-story-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your progress</p>
          <h2 id="progress-story-title" className="mt-1 text-2xl font-bold text-ink">
            How is my search progressing?
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold text-ink-muted">
            {rangeLabel(range)}
          </span>
          <Link
            to={analyticsHref(range)}
            className="inline-flex min-h-10 items-center text-sm font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            View full Analytics
            <ArrowRight aria-hidden="true" className="ml-1.5 size-4" />
          </Link>
        </div>
      </div>

      <div className={`mt-5 overflow-hidden rounded-3xl border shadow-panel ${progressToneClass(tone)}`}>
        <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:p-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
              <ProgressToneIcon tone={tone} />
              {progressToneLabel(tone)}
            </div>
            {isPending ? (
              <div className="mt-4 space-y-3" role="status" aria-label="Interpreting your recent progress">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <span className="sr-only">Interpreting your recent progress…</span>
              </div>
            ) : (
              <>
                <h3 className="mt-3 text-2xl font-black leading-tight text-ink sm:text-3xl">
                  {narrative?.headline ?? "Your tracked milestones are still available"}
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
                  {narrative?.explanation ?? "HireFlux could not interpret the comparison right now, but your milestone counts remain visible."}
                </p>
              </>
            )}
          </div>
          {rates ? <SearchProgression rates={rates} /> : <SearchProgressionSkeleton />}
        </div>

        {narrative ? (
          <div className="border-t border-current/10 px-5 py-4 sm:px-6 lg:px-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
              {focus ? "What deserves attention" : "Current process health"}
            </p>
            <p className="mt-1 font-bold text-ink">
              {focus?.title ?? narrative.process_health.summary}
            </p>
          </div>
        ) : null}

        {isError && !analytics ? (
          <div className="flex flex-col gap-3 border-t border-danger/20 bg-danger-soft px-5 py-4 text-danger sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7" role="status">
            <div>
              <p className="font-bold">Progress interpretation is temporarily unavailable.</p>
              <p className="mt-1 text-sm leading-6">The milestone path above still comes from your current Home summary.</p>
            </div>
            <button type="button" className={buttonClassName("secondary", "shrink-0")} onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-current/10 px-5 text-left font-bold text-ink hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-focus sm:px-6 lg:px-7"
              aria-expanded={open}
              aria-controls="progress-story-details"
              onClick={() => onOpenChange(!open)}
            >
              See what changed and why
              <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            <CollapsibleRegion id="progress-story-details" open={open} className="border-t border-current/10 bg-surface-raised/45">
              {open ? <div className="p-5 sm:p-6 lg:p-7">
                {isPending ? <ProgressStorySkeleton /> : null}
                {analytics ? <ExpandedProgressStory analytics={analytics} createState={createState} /> : null}
              </div> : null}
            </CollapsibleRegion>
          </>
        )}
      </div>
    </section>
  );
}

function SearchProgression({ rates }: { rates: Analytics["rates"] | Dashboard["rates"] }) {
  const milestones = [
    { label: "Submitted", count: rates.submitted_count, context: "tracked applications" },
    { label: "Responses", count: rates.response_count, context: `${percent(rates.response_rate)} of submissions` },
    { label: "Interviews", count: rates.interview_count, context: `${percent(rates.interview_rate)} of submissions` },
    { label: "Offers", count: rates.offer_count, context: `${percent(rates.offer_rate)} of submissions` },
  ];

  return (
    <div aria-label="Application progress from submission to offer">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Your search path</p>
      <ol className="mt-4 grid sm:grid-cols-4">
        {milestones.map((milestone, index) => (
          <li
            key={milestone.label}
            className={`relative border-l border-line py-2 pl-5 last:border-l-0 sm:border-l-0 sm:border-t sm:px-3 sm:pb-0 sm:pt-6 ${
              index === 0 ? "pt-0" : ""
            } ${index === milestones.length - 1 ? "pb-0" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`absolute -left-1.5 size-3 rounded-full border-2 border-accent bg-surface-raised sm:-top-2 sm:left-0 ${
                index === 0 ? "top-0" : "top-4"
              }`}
            />
            <p className="text-xs font-bold text-ink-muted">{index + 1}. {milestone.label}</p>
            <p className="mt-0.5 text-2xl font-black text-ink">{milestone.count}</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-muted">{milestone.context}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SearchProgressionSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Updating application progress for the selected range">
      <span className="sr-only">Updating application progress for the selected range…</span>
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} rounded="lg" className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

function ExpandedProgressStory({
  analytics,
  createState,
}: {
  analytics: Analytics;
  createState: ReturnType<typeof applicationCreateRouteState>;
}) {
  const narrative = analytics.progress_narrative;
  const comparison = analytics.period_comparison;
  const process = narrative.process_health;
  const focus = narrative.recommended_focus;
  const primarySignals = narrative.supporting_signals.filter(
    (signal) => signal.emphasis === "PRIMARY",
  );

  return (
    <div className="divide-y divide-line">
      <section className="pb-6" aria-labelledby="progress-change-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">What changed</p>
        <h4 id="progress-change-title" className="mt-2 text-lg font-bold text-ink">
          {narrative.primary_signal?.evidence_summary ?? progressStateHeading(narrative.state)}
        </h4>
        {comparison.available && comparison.current && comparison.deltas && narrative.primary_signal ? (
          <>
            <dl className={`mt-5 grid gap-4 ${primarySignals.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"} sm:divide-x sm:divide-line`}>
              {primarySignals.map((signal) => (
                <ProgressComparisonMetric
                  key={signal.metric_key}
                  signal={signal}
                  comparison={comparison}
                />
              ))}
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {progressStateExplanation(narrative.state)}
          </p>
        )}
      </section>

      <section className="py-6" aria-labelledby="progress-comparison-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Compared with what</p>
        {comparison.available && comparison.current_start && comparison.current_end && comparison.previous_start && comparison.previous_end ? (
          <>
            <h4 id="progress-comparison-title" className="mt-2 font-bold text-ink">Two equal-length periods in your selected range</h4>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              <time dateTime={comparison.current_start}>{formatDateOnly(comparison.current_start)}</time>–<time dateTime={comparison.current_end}>{formatDateOnly(comparison.current_end)}</time> is compared with <time dateTime={comparison.previous_start}>{formatDateOnly(comparison.previous_start)}</time>–<time dateTime={comparison.previous_end}>{formatDateOnly(comparison.previous_end)}</time>.
            </p>
          </>
        ) : (
          <>
            <h4 id="progress-comparison-title" className="mt-2 font-bold text-ink">Complete history, without a period comparison</h4>
            <p className="mt-2 text-sm leading-6 text-ink-muted">All time describes your full tracked history. Choose 30 or 90 days to compare two equal-length periods.</p>
          </>
        )}
      </section>

      <section className="py-6" aria-labelledby="progress-meaning-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Why it matters</p>
        <h4 id="progress-meaning-title" className="mt-2 font-bold text-ink">
          {progressMeaningHeading(narrative.state, narrative.primary_signal !== null)}
        </h4>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{narrative.explanation}</p>
        {narrative.primary_signal?.sample_label ? (
          <p className="mt-3 text-xs font-bold text-ink-muted">{narrative.primary_signal.sample_label}</p>
        ) : null}
      </section>

      <section className="py-6" aria-labelledby="progress-process-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">How your active search is being managed</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 id="progress-process-title" className="font-bold text-ink">{process.summary}</h4>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {process.scheduled_count} of {process.active_count} active opportunities have a next step scheduled across this workspace.
            </p>
          </div>
          <p className="shrink-0 text-3xl font-black text-ink">{percent(process.coverage_rate)}</p>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-label="Active opportunities with a scheduled next step"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(process.coverage_rate * 100)}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${process.coverage_rate * 100}%` }} />
        </div>
        <p className="mt-3 text-xs font-bold leading-5 text-ink-muted">
          {process.overdue_count} overdue follow-ups · {process.due_today_count} due today · {process.missing_count} without a next step
        </p>
      </section>

      <section className="pt-6" aria-labelledby="progress-focus-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">What to focus on next</p>
        {focus ? (
          <>
            <h4 id="progress-focus-title" className="mt-2 text-lg font-bold text-ink">{focus.title}</h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{focus.explanation}</p>
            <Link
              to={insightActionHref(focus.action)}
              state={focus.action.kind === "ADD_APPLICATION" ? createState : undefined}
              className="mt-3 inline-flex min-h-11 items-center font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {focus.action.label}
              <ArrowRight aria-hidden="true" className="ml-1.5 size-4" />
            </Link>
          </>
        ) : (
          <>
            <h4 id="progress-focus-title" className="mt-2 font-bold text-ink">Keep the picture current</h4>
            <p className="mt-2 text-sm leading-6 text-ink-muted">No specific action currently outranks the rest of your tracked search.</p>
          </>
        )}
      </section>
    </div>
  );
}

function ProgressComparisonMetric({
  signal,
  comparison,
}: {
  signal: Analytics["progress_narrative"]["supporting_signals"][number];
  comparison: Analytics["period_comparison"];
}) {
  if (!comparison.current || !comparison.deltas) return null;
  const presentation = comparisonMetricPresentation(signal.metric_key, comparison.current, comparison.deltas, signal.direction);
  return (
    <div className={`min-w-0 sm:px-4 sm:first:pl-0 ${signal.emphasis === "PRIMARY" ? "text-ink" : "text-ink-muted"}`}>
      <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        <ProgressDirectionIcon direction={signal.direction} />
        {presentation.label}
      </dt>
      <dd className="mt-2 text-2xl font-black text-ink">{presentation.value}</dd>
      <dd className="mt-1 text-xs leading-5">{presentation.detail}</dd>
    </div>
  );
}

function comparisonMetricPresentation(
  metric: Analytics["progress_narrative"]["supporting_signals"][number]["metric_key"],
  current: NonNullable<Analytics["period_comparison"]["current"]>,
  deltas: NonNullable<Analytics["period_comparison"]["deltas"]>,
  direction: Analytics["progress_narrative"]["supporting_signals"][number]["direction"],
) {
  const definitions = {
    SUBMISSIONS: { label: "Submissions", value: String(current.submitted_count), delta: deltas.submitted_count, rate: false },
    RESPONSE_RATE: { label: "Response rate", value: percent(current.response_rate), delta: deltas.response_rate, rate: true },
    INTERVIEW_RATE: { label: "Interview rate", value: percent(current.interview_rate), delta: deltas.interview_rate, rate: true },
  } as const;
  const definition = definitions[metric];
  if (direction === "STABLE") return { ...definition, detail: "About the same as the previous period" };
  if (direction === "NOT_AVAILABLE") return { ...definition, detail: "No reliable comparison yet" };
  const amount = definition.rate ? Math.round(Math.abs(definition.delta) * 100) : Math.abs(definition.delta);
  const unit = definition.rate ? "percentage points" : amount === 1 ? "application" : "applications";
  return {
    ...definition,
    detail: `${amount} ${unit} ${direction === "IMPROVING" ? "higher" : "lower"} than the previous period`,
  };
}

function ProgressToneIcon({ tone }: { tone: Analytics["progress_narrative"]["tone"] }) {
  const Icon = tone === "POSITIVE" ? CheckCircle2 : tone === "WATCH" ? TrendingDown : tone === "ACTION_NEEDED" ? TriangleAlert : CircleGauge;
  return <Icon aria-hidden="true" className="size-4" />;
}

function ProgressDirectionIcon({ direction }: { direction: Analytics["progress_narrative"]["supporting_signals"][number]["direction"] }) {
  const Icon = direction === "IMPROVING" ? TrendingUp : direction === "DECLINING" ? TrendingDown : Minus;
  return <Icon aria-hidden="true" className="size-3.5" />;
}

function progressToneClass(tone: Analytics["progress_narrative"]["tone"] | "NEUTRAL") {
  return {
    POSITIVE: "border-success/30 bg-gradient-to-br from-success-soft via-surface-raised to-surface-raised text-success",
    WATCH: "border-warning/30 bg-gradient-to-br from-warning-soft via-surface-raised to-surface-raised text-warning",
    ACTION_NEEDED: "border-danger/30 bg-gradient-to-br from-danger-soft via-surface-raised to-surface-raised text-danger",
    NEUTRAL: "border-line bg-gradient-to-br from-accent-soft/70 via-surface-raised to-surface-raised text-accent",
  }[tone];
}

function progressToneLabel(tone: Analytics["progress_narrative"]["tone"] | "NEUTRAL") {
  return { POSITIVE: "Healthy signal", WATCH: "Worth watching", ACTION_NEEDED: "Needs attention", NEUTRAL: "Building context" }[tone];
}

function rangeLabel(range: DashboardRange) {
  return range === "30d" ? "Last 30 days" : range === "90d" ? "Last 90 days" : "All time";
}

function progressStateHeading(state: Analytics["progress_narrative"]["state"]) {
  return state === "EMPTY" ? "No submitted activity in this range" : state === "LIMITED" ? "A pattern is still forming" : state === "ALL_TIME" ? "Complete tracked history" : "No major change stands out";
}

function progressStateExplanation(state: Analytics["progress_narrative"]["state"]) {
  if (state === "ALL_TIME") return "All time includes your complete tracked history. Choose a 30- or 90-day range to compare equal periods.";
  if (state === "LIMITED") return "The current sample is too small for a confident period-over-period interpretation.";
  if (state === "EMPTY") return "There are no submitted applications in the selected range to compare yet.";
  return "The selected periods do not contain a meaningful change that meets the evidence thresholds.";
}

function progressMeaningHeading(
  state: Analytics["progress_narrative"]["state"],
  hasPrimarySignal: boolean,
) {
  if (state === "ALL_TIME") return "History is context, not a trend";
  if (state === "EMPTY") return "Tracking creates the comparison";
  if (state === "LIMITED") return "More evidence will make the pattern clearer";
  return hasPrimarySignal ? "The relationship is the useful signal" : "Steady can be useful context";
}

function ProgressStorySkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading progress reasoning">
      <span className="sr-only">Loading progress reasoning…</span>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
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
  const nextStep = steps.find(([key]) => !tour[key]);
  return (
    <section className="relative overflow-hidden border-y border-line py-4 sm:py-5" aria-labelledby="search-tour-title">
      <Sparkles aria-hidden="true" className="absolute -right-5 -top-5 size-24 text-accent opacity-10" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-sm font-semibold text-accent">Search tour · {completed}/3</p><h2 id="search-tour-title" className="mt-1 text-xl font-bold text-ink">Three ways to explore HireFlux</h2><p className="mt-1 text-sm text-ink-muted">{nextStep ? `Next: ${nextStep[1]}.` : "The hands-on tour is complete."}</p></div>
        <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={onDismiss} aria-label="Dismiss search tour"><X aria-hidden="true" className="size-4" /></button>
      </div>
      <details className="relative mt-3 border-t border-line-subtle pt-3"><summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-bold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">View tour details<ChevronDown aria-hidden="true" className="size-4" /></summary><ol className="mt-3 grid gap-3 lg:grid-cols-3">{steps.map(([key, title, description, href]) => <li key={key} className="rounded-xl bg-surface-muted p-4"><div className="flex gap-3">{tour[key] ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><Check aria-hidden="true" className="size-4" /></span> : <Circle aria-hidden="true" className="size-7 shrink-0 text-ink-tertiary" />}<div className="min-w-0"><p className="font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>{!tour[key] ? <Link to={href} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-accent hover:underline">Try it<ArrowRight aria-hidden="true" className="size-3.5" /></Link> : <p className="mt-3 text-sm font-semibold text-success">Completed</p>}</div></div></li>)}</ol></details>
    </section>
  );
}
