import { ArrowRight, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { DashboardRange } from "../api/schemas";
import { buttonClassName } from "../components/ui/buttonStyles";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { Skeleton } from "../components/ui/Skeleton";
import { CollapsibleRegion, PendingIndicator } from "../components/ui/Motion";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/toastContext";
import { WorkspaceFrame } from "../components/ui/WorkspaceComposition";
import { formatDateOnly, formatTimestamp } from "../features/applications/format";
import { useOpportunityWorkspace } from "../features/applications/queries";
import { applicationCreateRouteState, readApplicationCreatedRouteState } from "../features/applications/createNavigation";
import { useSettings } from "../features/resources/queries";
import {
  buildHomeDecisionModel,
  homeActionMeaning,
  homeActionPreviewReason,
  type HomeAction,
  type HomeActionGroup,
  type HomeActionGroupKey,
} from "../features/workspace/homeDecisionModel";
import {
  readSearchTour,
  SEARCH_TOUR_EVENT,
  updateSearchTour,
  useAnalytics,
  useCompleteFollowUp,
  useDashboard,
  useRescheduleFollowUp,
  type SearchTourState,
} from "../features/workspace/queries";

const textLink = "inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function actionTime(action: HomeAction, timeZone: string) {
  if (action.kind === "FOLLOW_UP_OVERDUE" || action.kind === "FOLLOW_UP_TODAY") {
    return { dateTime: action.due_date, label: formatDateOnly(action.due_date) };
  }
  if (action.kind === "INTERVIEW_SOON" || action.kind === "INTERVIEW_UPCOMING") {
    return { dateTime: action.due_at, label: formatTimestamp(action.due_at, timeZone) };
  }
  return null;
}

function actionDestination(action: HomeAction) {
  return action.kind.startsWith("INTERVIEW_")
    ? `/applications/${action.application_id}?section=interviews`
    : `/applications/${action.application_id}`;
}

function actionKey(action: HomeAction) {
  return `${action.kind}-${action.application_id}-${"due_at" in action ? action.due_at : "due_date" in action ? action.due_date : "undated"}`;
}

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const settingsQuery = useSettings();
  const { showToast } = useToast();
  const [range, setRange] = useState<DashboardRange>("30d");
  const rangeInitialized = useRef(false);
  const decisionHeadingRef = useRef<HTMLHeadingElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<HomeActionGroupKey[]>([]);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);
  const [tour, setTour] = useState<SearchTourState>(readSearchTour);
  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state;
    return state && typeof state === "object" && "notice" in state && typeof state.notice === "string" ? state.notice : null;
  });
  const [createdState, setCreatedState] = useState(() => readApplicationCreatedRouteState(location.state));
  const dashboardQuery = useDashboard(range);
  const dashboard = dashboardQuery.data;
  // The workspace classification is needed only when Home has no surfaced work.
  // A failed classification cannot become an all-clear.
  const workspaceQuery = useOpportunityWorkspace(3, Boolean(dashboard && dashboard.actions.length === 0 && dashboard.summary.total_tracked > 0));
  const analyticsQuery = useAnalytics({ range });
  const completeMutation = useCompleteFollowUp();
  const rescheduleMutation = useRescheduleFollowUp();
  const decision = buildHomeDecisionModel({
    dashboard,
    dashboardPending: dashboardQuery.isPending,
    dashboardError: dashboardQuery.isError,
    workspace: workspaceQuery.data,
    workspacePending: workspaceQuery.isPending,
    workspaceError: workspaceQuery.isError,
  });
  const recordedGroups = decision.groups.filter((group) => group.recorded);
  const compactPeers = !decision.focalGroup && recordedGroups.length > 0 && recordedGroups.reduce((count, group) => count + group.actions.length, 0) <= 3;
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const currentAnalytics = analyticsQuery.data?.range === range ? analyticsQuery.data : undefined;

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
      setCreatedState(readApplicationCreatedRouteState(state));
    }
    if (state) void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const syncTour = () => setTour(readSearchTour());
    window.addEventListener(SEARCH_TOUR_EVENT, syncTour);
    return () => window.removeEventListener(SEARCH_TOUR_EVENT, syncTour);
  }, []);

  async function complete(action: HomeAction) {
    setResolvingActionId(action.application_id);
    try {
      await completeMutation.mutateAsync(action.application_id);
      showToast("Follow-up completed.", { title: "Follow-up updated" });
      decisionHeadingRef.current?.focus();
    } catch {
      // The mutation error remains visible beside the decision context.
    } finally {
      setResolvingActionId(null);
    }
  }

  async function reschedule(applicationId: string) {
    if (!followUpDate) return;
    try {
      await rescheduleMutation.mutateAsync({ applicationId, followUpDate });
      setRescheduling(null);
      setFollowUpDate("");
      showToast("Follow-up rescheduled.", { title: "Follow-up updated" });
      decisionHeadingRef.current?.focus();
    } catch {
      // The mutation error remains visible beside the decision context.
    }
  }

  function renderGroup(group: HomeActionGroup, prominent = false, detailsOnly = false) {
    const expanded = expandedGroups.includes(group.key);
    return <HomeActionGroupView
      key={group.key}
      group={group}
      prominent={prominent}
      detailsOnly={detailsOnly}
      expanded={expanded}
      timeZone={timeZone}
      resolvingActionId={resolvingActionId}
      rescheduling={rescheduling}
      followUpDate={followUpDate}
      reschedulePending={rescheduleMutation.isPending}
      onToggle={() => setExpandedGroups((current) => expanded ? current.filter((key) => key !== group.key) : [...current, group.key])}
      onComplete={(action) => void complete(action)}
      onBeginReschedule={(applicationId) => { setRescheduling(applicationId); setFollowUpDate(""); }}
      onDateChange={setFollowUpDate}
      onCancelReschedule={() => setRescheduling(null)}
      onSaveDate={(applicationId) => void reschedule(applicationId)}
    />;
  }

  return (
    <WorkspaceFrame width="standard" className="space-y-3 pb-12 sm:space-y-9">
      <header className="border-b border-line pb-2 sm:pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Recorded demo search</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Home</h1>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{dashboard ? `${dashboard.summary.active_pursuits} active · ${dashboard.summary.total_tracked} tracked` : "Your recorded workspace"}</p>
      </header>

      {notice ? <SuccessBanner><span className="flex flex-wrap items-center justify-between gap-3"><span>{notice}</span>{createdState ? <Link to={`/applications/${createdState.createdApplicationId}`} className="font-semibold underline underline-offset-4">View application</Link> : null}</span></SuccessBanner> : null}

      <section aria-labelledby="home-decision-title" className="rounded-3xl border border-line bg-surface-raised shadow-panel">
        <div className="p-3 sm:p-6">
          <p className="sr-only text-xs font-bold uppercase tracking-[0.15em] text-ink-muted sm:not-sr-only">Your recorded next steps</p>
          <h2 id="home-decision-title" ref={decisionHeadingRef} tabIndex={-1} className="font-display text-2xl font-bold leading-tight text-ink focus:outline-none sm:mt-2 sm:text-3xl">What can I work on now?</h2>
          <p className="mt-1 max-w-3xl text-lg font-semibold leading-7 text-ink sm:mt-2">{decision.title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">{decision.explanation}</p>
          {dashboardQuery.isFetching && dashboard ? <p role="status" className="mt-3 text-sm text-ink-muted">Refreshing recorded work… The previous snapshot remains visible.</p> : null}
          {decision.state === "partial" || decision.state === "failure" ? (
            <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-ink">
              <span>Evidence is incomplete; this is not an all-clear.</span>
              <button type="button" className={buttonClassName("secondary", "min-h-11")} onClick={() => { void dashboardQuery.refetch(); void workspaceQuery.refetch(); }}>Retry missing information</button>
            </div>
          ) : null}
          {decision.state === "loading" ? <div role="status" aria-label="Checking recorded work" className="mt-5 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-4/5" /><span className="sr-only">Checking recorded work…</span></div> : null}
          {decision.state === "no-records" ? <Link to="/applications/new" state={applicationCreateRouteState("dashboard", location.pathname, location.search)} className={buttonClassName("primary", "mt-5")}>Record an application</Link> : null}
          {decision.state === "waiting" ? <div className="mt-5 border-t border-line-subtle pt-4"><p className="text-sm font-semibold text-ink">{decision.waitingCount} recorded {decision.waitingCount === 1 ? "opportunity is" : "opportunities are"} waiting</p><p className="mt-1 text-sm text-ink-muted">Employer-owned next steps do not imply a response date.</p><ul className="mt-3 space-y-2">{decision.waitingPreview.filter((item) => item.classification.reason_code === "WAITING_FOR_EMPLOYER").slice(0, 2).map((item) => <li key={item.application.application_id}><Link to={`/applications/${item.application.application_id}`} className={textLink}>{item.application.job_title} · {item.application.company_name}<ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link></li>)}</ul><Link to="/applications" className={`${textLink} mt-2`}>Review waiting opportunities in Applications<ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link></div> : null}
          {decision.groups.length > 0 ? <>
            {decision.groups.some((group) => group.recorded) ? <ul aria-label="Recorded conditions" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line-subtle pt-2 text-sm font-semibold text-ink-muted sm:mt-4 sm:pt-3">{decision.groups.filter((group) => group.recorded).map((group) => <li key={group.key} className={group.key === "overdue" ? "text-danger" : group.key === "today" ? "text-warning" : ""}>{group.actions.length} {group.key === "overdue" ? "overdue" : group.key === "today" ? "due today" : group.actions.length === 1 ? "interview" : "interviews"}</li>)}</ul> : null}
            {decision.focalGroup ? <div className={`mt-4 grid gap-5 ${decision.groups.length > 1 ? "xl:grid-cols-[minmax(0,1.2fr)_minmax(17rem,.8fr)] xl:gap-8" : ""}`}>{renderGroup(decision.groups.find((group) => group.key === decision.focalGroup)!, true)}{decision.groups.length > 1 ? <div className="min-w-0 space-y-4">{decision.groups.filter((group) => group.key !== decision.focalGroup).map((group) => renderGroup(group))}</div> : null}</div> : compactPeers ? <>
              <div className="mt-2 grid gap-3 sm:mt-3 xl:grid-cols-2 xl:gap-5">{recordedGroups.map((group) => <div key={group.key} aria-labelledby={`home-group-${group.key}`} className="min-w-0 border-t border-line-subtle pt-2"><h3 id={`home-group-${group.key}`} className="text-sm font-bold text-ink">{group.label}</h3><ul className="mt-1 space-y-2">{group.actions.map((action) => <HomeActionPreview key={actionKey(action)} action={action} timeZone={timeZone} compact />)}</ul></div>)}</div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">{recordedGroups.map((group) => renderGroup(group, false, true))}</div>
              {decision.groups.some((group) => !group.recorded) ? <div className="mt-4 grid gap-x-8 gap-y-4 xl:grid-cols-2">{decision.groups.filter((group) => !group.recorded).map((group) => renderGroup(group))}</div> : null}
            </> : <div className="mt-4 grid gap-x-8 gap-y-4 xl:grid-cols-2">{decision.groups.map((group) => renderGroup(group))}</div>}
          </> : null}
          {completeMutation.error || rescheduleMutation.error ? <div className="mt-4"><ErrorPanel compact title="Follow-up could not be updated" error={completeMutation.error ?? rescheduleMutation.error} /></div> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-4 py-2 sm:px-6">
          <p className="max-w-2xl text-xs leading-5 text-ink-muted">{decision.coverage}</p>
          <div className="flex flex-wrap gap-3"><Link to="/applications" className={textLink}>Applications</Link><Link to="/interviews" className={textLink}>Interviews</Link></div>
        </div>
      </section>

      {dashboard && dashboard.summary.total_tracked > 0 ? (
        <div className="grid gap-9 border-t border-line pt-8 xl:grid-cols-2 xl:gap-12">
          <section aria-labelledby="home-records-title" className="min-w-0">
            <h2 id="home-records-title" className="font-display text-xl font-bold text-ink">Recorded context</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Recently updated records in this workspace, not changes since your last visit.</p>
            {dashboard.recent_applications.length ? <ul className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">{dashboard.recent_applications.slice(0, 2).map((item) => <li key={item.application_id} className="min-w-0 py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><Link to={`/applications/${item.application_id}`} className="break-words font-semibold text-ink hover:text-accent hover:underline">{item.job_title}</Link><p className="mt-0.5 break-words text-sm text-ink-muted">{item.company_name} · updated {formatTimestamp(item.updated_at, timeZone)}</p></div><StatusBadge status={item.status} /></div></li>)}</ul> : <p className="mt-4 text-sm text-ink-muted">No recently updated opportunities are recorded.</p>}
            <Link to="/applications" className={`${textLink} mt-2`}>Review recorded opportunities <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>
          </section>
          <section aria-labelledby="home-strategy-title" className="min-w-0">
            <h2 id="home-strategy-title" className="font-display text-xl font-bold text-ink">Search patterns</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Reporting-period context, separate from today's recorded commitments.</p>
            <label htmlFor="dashboard-range" className="mt-4 block text-sm font-medium text-ink-muted">Reporting range</label>
            <select id="dashboard-range" value={range} onChange={(event) => setRange(event.target.value as DashboardRange)} className="mt-1 min-h-11 max-w-full rounded-xl border border-line bg-surface-raised px-3 text-sm font-semibold text-ink"><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select>
            {analyticsQuery.isPending || (analyticsQuery.isFetching && !currentAnalytics) ? <p role="status" className="mt-4 text-sm text-ink-muted">Interpreting the selected reporting period…</p> : currentAnalytics ? <div className="mt-4"><p className="font-semibold text-ink">{currentAnalytics.progress_narrative.headline}</p><p className="mt-2 text-sm leading-6 text-ink-muted">{currentAnalytics.progress_narrative.explanation}</p><p className="mt-2 text-xs text-ink-muted">{currentAnalytics.rates.submitted_count} submitted applications in this reporting range.{currentAnalytics.progress_narrative.primary_signal?.sample_label ? ` ${currentAnalytics.progress_narrative.primary_signal.sample_label}` : ""}</p></div> : <div role="status" className="mt-4 text-sm text-ink-muted"><p>Strategic reporting is unavailable; recorded commitments above remain separate.</p><button type="button" className={`${textLink} mt-2`} onClick={() => void analyticsQuery.refetch()}>Retry Analytics</button></div>}
            <Link to={`/analytics?range=${range}`} className={`${textLink} mt-3`}>Explore Analytics <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>
          </section>
        </div>
      ) : null}

      {!tour.dismissed ? <SearchTour tour={tour} onDismiss={() => setTour(updateSearchTour("dismissed"))} /> : null}
    </WorkspaceFrame>
  );
}

function SearchTour({ tour, onDismiss }: { tour: SearchTourState; onDismiss: () => void }) {
  const steps = [
    { key: "status", title: "Move an application forward", description: "Try the status control on an application.", href: "/applications" },
    { key: "engagement", title: "Capture the next conversation", description: "Add a note or schedule an interview.", href: "/applications" },
    { key: "analytics", title: "Explore search insights", description: "See the story behind the sample workspace.", href: "/analytics" },
  ] as const;
  const completed = steps.filter(({ key }) => tour[key]).length;
  return (
    <section className="border-t border-line pt-6" aria-labelledby="home-tour-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-medium text-ink-muted">Search tour · {completed}/3</p><h2 id="home-tour-title" className="mt-1 text-lg font-semibold text-ink">Explore the demo workspace</h2><p className="mt-1 text-sm text-ink-muted">Optional ways to learn; not a recorded task.</p></div>
        <button type="button" aria-label="Dismiss search tour" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" onClick={onDismiss}><X aria-hidden="true" className="size-4" /></button>
      </div>
      <details className="mt-3"><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">View tour details <ChevronDown aria-hidden="true" className="size-4" /></summary><ol className="mt-3 grid gap-3 sm:grid-cols-3">{steps.map(({ key, title, description, href }) => <li key={key} className="rounded-xl border border-line-subtle p-3"><p className="font-semibold text-ink">{title}</p><p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>{tour[key] ? <p className="mt-2 text-sm font-medium text-ink-muted">Completed</p> : <Link to={href} className={textLink}>Try it <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>}</li>)}</ol></details>
    </section>
  );
}

function HomeActionPreview({ action, timeZone, prominent = false, compact = false }: { action: HomeAction; timeZone: string; prominent?: boolean; compact?: boolean }) {
  const meaning = homeActionMeaning(action);
  const time = actionTime(action, timeZone);
  const interview = action.kind.startsWith("INTERVIEW_");
  return <li className="min-w-0">
    {compact ? <Link to={actionDestination(action)} className="block min-h-11 break-words py-2 font-semibold leading-5 text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{interview ? "Interviews for " : ""}{action.job_title} · {action.company_name}</Link> : null}
    <p className="text-sm leading-5 text-ink-muted"><span className="font-semibold text-ink">{meaning.owner}</span>{time ? <> · <time dateTime={time.dateTime}>{time.label}</time></> : " · no recorded deadline"}</p>
    {!compact ? <Link to={actionDestination(action)} className={`inline-flex min-h-11 max-w-full items-center break-words font-semibold text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${prominent ? "text-lg" : "text-base"}`}>{interview ? "Interviews for " : ""}{action.job_title} · {action.company_name}</Link> : null}
    <p className="text-sm leading-5 text-ink-muted">{homeActionPreviewReason(action)}</p>
    {action.kind === "CANDIDATE_ACTION_UNDATED" ? <p className="text-xs leading-5 text-ink-muted">No date is recorded for this candidate step.</p> : null}
  </li>;
}

function HomeActionGroupView({
  group, prominent, detailsOnly, expanded, timeZone, resolvingActionId, rescheduling, followUpDate, reschedulePending,
  onToggle, onComplete, onBeginReschedule, onDateChange, onCancelReschedule, onSaveDate,
}: {
  group: HomeActionGroup;
  prominent: boolean;
  detailsOnly: boolean;
  expanded: boolean;
  timeZone: string;
  resolvingActionId: string | null;
  rescheduling: string | null;
  followUpDate: string;
  reschedulePending: boolean;
  onToggle: () => void;
  onComplete: (action: HomeAction) => void;
  onBeginReschedule: (applicationId: string) => void;
  onDateChange: (value: string) => void;
  onCancelReschedule: () => void;
  onSaveDate: (applicationId: string) => void;
}) {
  const headingId = `home-group-${group.key}`;
  const detailsId = `${headingId}-details`;
  const hasDisclosure = group.actions.length > 1 || group.key === "overdue" || group.key === "today";
  if (detailsOnly && !hasDisclosure) return null;
  return <div aria-labelledby={detailsOnly ? undefined : headingId} className={`min-w-0 ${detailsOnly ? "" : prominent ? "border-l-[3px] border-accent pl-4 sm:pl-5" : "border-t border-line-subtle pt-3"}`}>
    {!detailsOnly ? <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 id={headingId} className={`${prominent ? "font-display text-xl font-bold" : "text-sm font-bold"} text-ink`}>{group.label}</h3>
      {!group.recorded ? <span className="text-xs font-medium text-ink-muted">{group.actions.length} in Home result</span> : null}
    </div> : null}
    {!detailsOnly && !expanded ? <ul className={`mt-2 ${prominent ? "space-y-3" : "space-y-2"}`}>{group.preview.map((action) => <HomeActionPreview key={actionKey(action)} action={action} timeZone={timeZone} prominent={prominent} />)}</ul> : null}
    {hasDisclosure ? <button type="button" aria-expanded={expanded} aria-controls={detailsId} className={`${textLink} ${detailsOnly ? "" : "mt-2"} gap-1`} onClick={onToggle}>
      {expanded ? `Hide ${group.label.toLowerCase()} details` : detailsOnly ? `View ${group.label.toLowerCase()} details and options` : group.actions.length === 1 ? "View details and options" : `See all ${group.actions.length} returned items`}
      <ChevronDown aria-hidden="true" className={`size-4 ${expanded ? "rotate-180" : ""}`} />
    </button> : null}
    {hasDisclosure ? <CollapsibleRegion id={detailsId} open={expanded} className="mt-2">
      <ul className="divide-y divide-line-subtle border-t border-line-subtle">{group.actions.map((action) => <DecisionRow
        key={actionKey(action)}
        action={action}
        timeZone={timeZone}
        resolving={resolvingActionId === action.application_id}
        rescheduling={rescheduling === action.application_id}
        followUpDate={followUpDate}
        reschedulePending={reschedulePending}
        onComplete={() => onComplete(action)}
        onBeginReschedule={() => onBeginReschedule(action.application_id)}
        onDateChange={onDateChange}
        onCancelReschedule={onCancelReschedule}
        onSaveDate={() => onSaveDate(action.application_id)}
      />)}</ul>
    </CollapsibleRegion> : null}
  </div>;
}

function DecisionRow({
  action, timeZone, resolving, rescheduling, followUpDate, reschedulePending,
  onComplete, onBeginReschedule, onDateChange, onCancelReschedule, onSaveDate,
}: {
  action: HomeAction;
  timeZone: string;
  resolving: boolean;
  rescheduling: boolean;
  followUpDate: string;
  reschedulePending: boolean;
  onComplete: () => void;
  onBeginReschedule: () => void;
  onDateChange: (value: string) => void;
  onCancelReschedule: () => void;
  onSaveDate: () => void;
}) {
  const meaning = homeActionMeaning(action);
  const time = actionTime(action, timeZone);
  const followUp = action.kind === "FOLLOW_UP_OVERDUE" || action.kind === "FOLLOW_UP_TODAY";
  const conditionTone = action.kind === "FOLLOW_UP_OVERDUE" ? "text-danger" : action.kind === "FOLLOW_UP_TODAY" ? "text-warning" : "text-ink-muted";
  return (
    <li className="min-w-0 py-5 first:pt-4">
      <p className="text-sm font-semibold text-ink-muted"><span className={conditionTone}>{meaning.condition}</span> · {meaning.owner}{time ? <> · <time dateTime={time.dateTime}>{time.label}</time></> : " · no recorded deadline"}</p>
      <Link to={actionDestination(action)} className="mt-1 inline-block min-w-0 break-words text-lg font-semibold text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{action.kind.startsWith("INTERVIEW_") ? "Interviews for " : ""}{action.job_title} · {action.company_name}</Link>
      <p className="mt-1 text-sm leading-6 text-ink-muted">Why this is here: {meaning.reason}</p>
      {meaning.limitation ? <p className="mt-1 text-sm leading-6 text-ink-muted">{meaning.limitation}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {followUp ? <><button type="button" className={buttonClassName("secondary", "min-h-11")} disabled={resolving} onClick={onComplete}>{resolving ? <PendingIndicator label="Completing…" /> : "Complete follow-up"}</button><button type="button" className={buttonClassName("ghost", "min-h-11")} disabled={resolving} onClick={onBeginReschedule}>Reschedule</button></> : null}
      </div>
      {rescheduling ? <div className="mt-3 max-w-xs rounded-xl bg-surface-muted p-3"><label htmlFor={`reschedule-${action.application_id}`} className="block text-sm font-semibold text-ink">New follow-up date</label><input id={`reschedule-${action.application_id}`} type="date" value={followUpDate} onChange={(event) => onDateChange(event.target.value)} className="hf-field mt-2 min-h-11 w-full rounded-lg px-3 text-sm" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" className={buttonClassName("primary", "min-h-11")} disabled={!followUpDate || reschedulePending} onClick={onSaveDate}>Save date</button><button type="button" className={buttonClassName("ghost", "min-h-11")} onClick={onCancelReschedule}>Cancel</button></div></div> : null}
    </li>
  );
}
