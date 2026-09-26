import { ArrowRight, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { DashboardRange } from "../api/schemas";
import { SuccessBanner } from "../components/ui/Feedback";
import { CollapsibleRegion } from "../components/ui/Motion";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/toastContext";
import { WorkspaceFrame } from "../components/ui/WorkspaceComposition";
import { formatTimestamp } from "../features/applications/format";
import { useOpportunityWorkspace } from "../features/applications/queries";
import { readApplicationCreatedRouteState } from "../features/applications/createNavigation";
import { useSettings } from "../features/resources/queries";
import { buildHomeDecisionModel, type HomeAction } from "../features/workspace/homeDecisionModel";
import { HomeDecisionSection } from "../features/workspace/HomeDecisionSection";
import type { Analytics } from "../api/workspace";
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

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const settingsQuery = useSettings();
  const { showToast } = useToast();
  const [range, setRange] = useState<DashboardRange>("30d");
  const rangeInitialized = useRef(false);
  const decisionHeadingRef = useRef<HTMLHeadingElement>(null);
  const [interpretationOpen, setInterpretationOpen] = useState(false);
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

  return (
    <WorkspaceFrame width="wide" className="space-y-6 pb-12 sm:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-3 sm:pb-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Recorded demo search</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Home</h1></div>
        <p className="w-full text-sm leading-6 text-ink-muted sm:w-auto">{dashboard ? `${dashboard.summary.active_pursuits} active · ${dashboard.summary.total_tracked} tracked` : "Your recorded workspace"}</p>
      </header>

      {notice ? <SuccessBanner><span className="flex flex-wrap items-center justify-between gap-3"><span>{notice}</span>{createdState ? <Link to={`/applications/${createdState.createdApplicationId}`} className="font-semibold underline underline-offset-4">View application</Link> : null}</span></SuccessBanner> : null}

      <HomeDecisionSection
        decision={decision}
        headingRef={decisionHeadingRef}
        timeZone={timeZone}
        refreshing={dashboardQuery.isFetching && Boolean(dashboard)}
        mutationError={completeMutation.error ?? rescheduleMutation.error}
        onRetry={() => { void dashboardQuery.refetch(); void workspaceQuery.refetch(); }}
        resolvingActionId={resolvingActionId}
        rescheduling={rescheduling}
        followUpDate={followUpDate}
        reschedulePending={rescheduleMutation.isPending}
        onComplete={(action) => void complete(action)}
        onBeginReschedule={(applicationId) => { setRescheduling(applicationId); setFollowUpDate(""); }}
        onDateChange={setFollowUpDate}
        onCancelReschedule={() => setRescheduling(null)}
        onSaveDate={(applicationId) => void reschedule(applicationId)}
      />

      {dashboard && dashboard.summary.total_tracked > 0 ? (
        <div className="grid gap-7 border-t border-line pt-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
          <section aria-labelledby="home-records-title" className="min-w-0">
            <h2 id="home-records-title" className="font-display text-lg font-semibold text-ink">Recently updated</h2>
            {dashboard.recent_applications.length ? <ul className="mt-3 divide-y divide-line-subtle">{dashboard.recent_applications.slice(0, 2).map((item) => <li key={item.application_id} className="min-w-0 py-3 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2"><Link to={`/applications/${item.application_id}`} className="block min-h-11 min-w-0 flex-1 break-words text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><span className="block text-sm font-semibold">{item.company_name}</span><span className="mt-0.5 block text-sm leading-5 text-ink-muted">{item.job_title}</span></Link><StatusBadge status={item.status} /></div>
              <p className="mt-1 text-xs leading-5 text-ink-muted">Updated <time dateTime={item.updated_at}>{formatTimestamp(item.updated_at, timeZone)}</time></p>
            </li>)}</ul> : <p className="mt-3 text-sm text-ink-muted">No recently updated opportunities are recorded.</p>}
            <Link to="/applications" className={`${textLink} mt-1`}>Review recorded opportunities <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>
          </section>
          <section aria-labelledby="home-strategy-title" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="home-strategy-title" className="font-display text-lg font-semibold text-ink">Search activity</h2><div><label htmlFor="dashboard-range" className="sr-only">Reporting range</label><select id="dashboard-range" value={range} onChange={(event) => setRange(event.target.value as DashboardRange)} className="min-h-11 max-w-full rounded-lg border border-line bg-surface px-2 text-sm text-ink"><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select></div></div>
            {analyticsQuery.isPending || (analyticsQuery.isFetching && !currentAnalytics) ? <p role="status" className="mt-3 text-sm text-ink-muted">Loading the selected reporting period…</p> : currentAnalytics ? <>
              {analyticsQuery.isError ? <p role="status" className="mt-3 text-sm text-warning">Activity refresh failed; the previous reporting snapshot is shown.</p> : null}
              <SearchActivity analytics={currentAnalytics} />
              <button type="button" aria-expanded={interpretationOpen} aria-controls="home-interpretation" className={textLink} onClick={() => setInterpretationOpen(!interpretationOpen)}>Interpretation<ChevronDown aria-hidden="true" className={`ml-1 size-4 ${interpretationOpen ? "rotate-180" : ""}`} /></button>
              <CollapsibleRegion id="home-interpretation" open={interpretationOpen}><div className="space-y-2 pb-3 text-sm leading-6 text-ink-muted"><p className="font-semibold text-ink">{currentAnalytics.progress_narrative.headline}</p><p>{currentAnalytics.progress_narrative.explanation}</p>{currentAnalytics.progress_narrative.primary_signal ? <p>{currentAnalytics.progress_narrative.primary_signal.evidence_summary}</p> : null}<p>{currentAnalytics.disclaimer}</p></div></CollapsibleRegion>
            </> : <div role="status" className="mt-3 text-sm text-ink-muted"><p>Search activity is unavailable; recorded commitments above remain separate.</p><button type="button" className={textLink} onClick={() => void analyticsQuery.refetch()}>Retry Analytics</button></div>}
            <Link to={`/analytics?range=${range}`} className={textLink}>Explore Analytics <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>
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
        <div className="min-w-0 break-words"><p className="text-sm font-medium text-ink-muted">Search tour · {completed}/3</p><h2 id="home-tour-title" className="mt-1 text-lg font-semibold text-ink">Explore the demo workspace</h2><p className="mt-1 text-sm text-ink-muted">Optional ways to learn; not a recorded task.</p></div>
        <button type="button" aria-label="Dismiss search tour" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" onClick={onDismiss}><X aria-hidden="true" className="size-4" /></button>
      </div>
      <details className="mt-3"><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">View tour details <ChevronDown aria-hidden="true" className="size-4" /></summary><ol className="mt-3 grid gap-3 sm:grid-cols-3">{steps.map(({ key, title, description, href }) => <li key={key} className="rounded-xl border border-line-subtle p-3"><p className="font-semibold text-ink">{title}</p><p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>{tour[key] ? <p className="mt-2 text-sm font-medium text-ink-muted">Completed</p> : <Link to={href} className={textLink}>Try it <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>}</li>)}</ol></details>
    </section>
  );
}

function SearchActivity({ analytics }: { analytics: Analytics }) {
  const comparison = analytics.period_comparison;
  const delta = comparison.available ? comparison.deltas?.submitted_count : undefined;
  const maxCount = Math.max(1, ...analytics.submission_trend.map((week) => week.count));
  return <div className="mt-3">
    <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-display text-3xl font-semibold text-ink">{analytics.rates.submitted_count}</span><span className="text-sm text-ink-muted">submitted {analytics.range === "all" ? "all time" : "in this period"}</span></p>
    {analytics.range !== "all" ? <>
      {analytics.submission_trend.length && analytics.rates.submitted_count > 0 ? <figure aria-label="Weekly submitted applications" className="mt-3">
        <div aria-hidden="true" className="flex h-14 items-end gap-1 border-b border-line-subtle">{analytics.submission_trend.map((week) => <span key={week.week_start} className="flex min-w-0 flex-1 items-end"><span className={`block w-full rounded-t-sm ${week.count ? "bg-accent/50" : "bg-line"}`} style={{ height: week.count ? `${(week.count / maxCount) * 48}px` : "1px" }} /></span>)}</div>
        <figcaption className="mt-1 flex justify-between gap-2 text-xs leading-5 text-ink-muted"><span>Weekly submissions</span><span>{analytics.submission_trend.length} weeks</span></figcaption>
        <ul className="sr-only">{analytics.submission_trend.map((week) => <li key={week.week_start}>Week starting {week.week_start}: {week.count} submitted applications</li>)}</ul>
      </figure> : <p className="mt-2 text-sm text-ink-muted">{analytics.rates.submitted_count === 0 ? "No submissions recorded in this period." : "Weekly history is unavailable in this result."}</p>}
      {delta !== undefined ? <p className="mt-2 text-xs leading-5 text-ink-muted">{delta > 0 ? "+" : ""}{delta} submissions compared with the previous equal period.</p> : <p className="mt-2 text-xs leading-5 text-ink-muted">Period comparison unavailable.</p>}
      <p className="text-xs leading-5 text-ink-muted">{analytics.progress_narrative.primary_signal?.sample_label ?? (analytics.progress_narrative.state === "LIMITED" ? "Limited evidence for interpretation." : analytics.progress_narrative.state === "EMPTY" ? "No activity evidence for comparison." : "Descriptive reporting; not a prediction.")}</p>
    </> : null}
  </div>;
}
