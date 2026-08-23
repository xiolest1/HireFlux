import { ArrowRight, BarChart3, CalendarCheck2, CheckCircle2, ChevronDown, CircleAlert, Eye, Filter, GitBranch, Info, Lightbulb, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  STAGE_AGE_BUCKETS,
  WORK_MODES,
  type ApplicationSource,
  type ApplicationStatus,
  type StageAgeBucket,
  type WorkMode,
} from "../api/schemas";
import type { Analytics } from "../api/workspace";
import { buttonClassName } from "../components/ui/buttonStyles";
import { Drawer } from "../components/ui/Drawer";
import { ErrorPanel } from "../components/ui/Feedback";
import { PanelSkeleton, Skeleton } from "../components/ui/Skeleton";
import { Tabs } from "../components/ui/Tabs";
import { formatDateOnly, formatSource, formatStageAge, formatStatus, formatWorkMode } from "../features/applications/format";
import { updateRecruiterGuide, useAnalytics } from "../features/workspace/queries";

type AnalyticsSection = "overview" | "pipeline" | "sources";
type SearchHealthInsight = Analytics["insights"][number];

const insightPresentation: Record<
  SearchHealthInsight["tone"],
  { label: string; icon: LucideIcon; accent: string; badge: string }
> = {
  ACTION_NEEDED: {
    label: "Action needed",
    icon: CircleAlert,
    accent: "border-l-warning",
    badge: "bg-warning-soft text-warning",
  },
  WATCH: {
    label: "Worth watching",
    icon: Eye,
    accent: "border-l-violet",
    badge: "bg-violet-soft text-violet",
  },
  INFO: {
    label: "Worth knowing",
    icon: Info,
    accent: "border-l-accent",
    badge: "bg-accent-soft text-accent-strong",
  },
  POSITIVE: {
    label: "Positive signal",
    icon: CheckCircle2,
    accent: "border-l-success",
    badge: "bg-success-soft text-success",
  },
};

const stageAgeGuidance: Record<StageAgeBucket, { description: string; tone: string }> = {
  "0-7": { description: "Recently entered this stage.", tone: "border-line" },
  "8-14": { description: "No recent stage change yet.", tone: "border-line" },
  "15-30": { description: "Consider reviewing the next step.", tone: "border-amber-200" },
  "31+": { description: "Prioritize a review or follow-up.", tone: "border-amber-300" },
};

function allowed<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

function percent(value: number) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function stageAgeHref(bucket: StageAgeBucket) {
  return `/applications?view=ACTIVE&stage_age=${encodeURIComponent(bucket)}`;
}

function percentagePointDelta(value: number) {
  const points = Math.round(value * 100);
  return `${points > 0 ? "+" : ""}${points} pp`;
}

function insightHref(action: NonNullable<Analytics["insights"][number]["action"]>) {
  if (action.kind === "ADD_APPLICATION") return "/applications/new";
  const params = new URLSearchParams();
  const view = action.parameters.view;
  const source = action.parameters.source;
  const status = action.parameters.status;
  const followUp = action.parameters.follow_up;
  if (view === "ALL" || view === "ACTIVE") params.set("view", view);
  if (source && APPLICATION_SOURCES.includes(source as ApplicationSource)) {
    params.set("source", source);
  }
  if (status && APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
    params.set("status", status);
  }
  if (followUp === "NEEDS_ATTENTION") params.set("follow_up", followUp);
  return `/applications${params.size ? `?${params.toString()}` : ""}`;
}

function searchHealthSummary(insights: SearchHealthInsight[]) {
  const actionCount = insights.filter((insight) => insight.tone === "ACTION_NEEDED").length;
  const watchCount = insights.filter((insight) => insight.tone === "WATCH").length;
  const infoCount = insights.filter((insight) => insight.tone === "INFO").length;
  const positiveCount = insights.filter((insight) => insight.tone === "POSITIVE").length;
  const parts = actionCount
    ? [`${actionCount} ${actionCount === 1 ? "action needs" : "actions need"} you`]
    : ["Nothing needs immediate attention"];
  if (watchCount) parts.push(`${watchCount} ${watchCount === 1 ? "trend" : "trends"} worth watching`);
  if (infoCount) parts.push(`${infoCount} ${infoCount === 1 ? "thing" : "things"} worth knowing`);
  if (positiveCount) parts.push(`${positiveCount} positive ${positiveCount === 1 ? "signal" : "signals"}`);
  return parts.join(" · ");
}

interface AdvancedDraft {
  status?: ApplicationStatus;
  source?: ApplicationSource;
  workMode?: WorkMode;
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = allowed(searchParams.get("range"), ["30d", "90d", "all"] as const) ?? "90d";
  const section = allowed(searchParams.get("section"), ["overview", "pipeline", "sources"] as const) ?? "overview";
  const status = allowed(searchParams.get("status"), APPLICATION_STATUSES);
  const source = allowed(searchParams.get("source"), APPLICATION_SOURCES);
  const workMode = allowed(searchParams.get("work_mode"), WORK_MODES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedDraft>({ status, source, workMode });
  const analyticsQuery = useAnalytics({ range, status, source, workMode });

  useEffect(() => {
    updateRecruiterGuide("analytics");
  }, []);

  function updateParam(name: string, value?: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  function openFilters() {
    setDraft({ status, source, workMode });
    setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
  }

  function applyFilters() {
    const next = new URLSearchParams(searchParams);
    if (draft.status) next.set("status", draft.status); else next.delete("status");
    if (draft.source) next.set("source", draft.source); else next.delete("source");
    if (draft.workMode) next.set("work_mode", draft.workMode); else next.delete("work_mode");
    setSearchParams(next, { replace: true });
    setFiltersOpen(false);
  }

  const activeFilters = [
    status ? { name: "status", label: `Status: ${formatStatus(status)}` } : null,
    source ? { name: "source", label: `Source: ${formatSource(source)}` } : null,
    workMode ? { name: "work_mode", label: `Work mode: ${formatWorkMode(workMode)}` } : null,
  ].filter((item): item is { name: string; label: string } => Boolean(item));

  const analyticsTabs = ([
    ["overview", "Overview", BarChart3],
    ["pipeline", "Pipeline", GitBranch],
    ["sources", "Sources", Search],
  ] as const).map(([value, label, Icon]) => {
    const next = new URLSearchParams(searchParams);
    if (value === "overview") next.delete("section"); else next.set("section", value);
    return {
      value,
      label: <span className="inline-flex items-center gap-2"><Icon aria-hidden="true" className="size-4" />{label}</span>,
      href: `?${next.toString()}`,
    };
  });

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Search insights</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Analytics</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">Understand activity and outcomes without turning a small sample into a prediction.</p>
        </div>
        <div>
          <label htmlFor="analytics-range" className="text-xs font-bold uppercase tracking-wide text-slate-600">Date range</label>
          <select id="analytics-range" value={range} onChange={(event) => updateParam("range", event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 sm:w-auto">
            <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option>
          </select>
        </div>
      </header>

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={analyticsTabs} value={section} ariaLabel="Analytics sections" stretch className="sm:w-auto" />
        <button type="button" className={buttonClassName("secondary", "gap-2")} onClick={openFilters}><Filter aria-hidden="true" className="size-4" />Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button>
      </div>

      {activeFilters.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active analytics filters">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Filtered by</span>
          {activeFilters.map((item) => <button key={item.name} type="button" onClick={() => updateParam(item.name)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-300" aria-label={`Remove ${item.label}`}><span>{item.label}</span><X aria-hidden="true" className="size-3.5" /></button>)}
        </div>
      ) : null}

      {analyticsQuery.isFetching && analyticsQuery.data ? <p className="text-xs font-semibold text-slate-500" role="status">Refreshing analytics…</p> : null}
      {analyticsQuery.isPending ? <AnalyticsSkeleton /> : null}
      {analyticsQuery.isError && !analyticsQuery.data ? <ErrorPanel title="Analytics could not be loaded" error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} /> : null}
      {analyticsQuery.data ? <AnalyticsResults analytics={analyticsQuery.data} section={section} /> : null}

      <Drawer
        open={filtersOpen}
        onClose={closeFilters}
        title="Analytics filters"
        description="Changes are staged until you apply them."
        footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className={buttonClassName("ghost")} onClick={() => setDraft({})}>Clear</button><button type="button" className={buttonClassName("primary")} onClick={applyFilters}>Apply filters</button></div>}
      >
        <div className="space-y-5">
          <FilterSelect label="Current status" value={draft.status ?? ""} onChange={(value) => setDraft({ ...draft, status: allowed(value, APPLICATION_STATUSES) })}><option value="">All statuses</option>{APPLICATION_STATUSES.map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}</FilterSelect>
          <FilterSelect label="Source" value={draft.source ?? ""} onChange={(value) => setDraft({ ...draft, source: allowed(value, APPLICATION_SOURCES) })}><option value="">All sources</option>{APPLICATION_SOURCES.map((value) => <option key={value} value={value}>{formatSource(value)}</option>)}</FilterSelect>
          <FilterSelect label="Work mode" value={draft.workMode ?? ""} onChange={(value) => setDraft({ ...draft, workMode: allowed(value, WORK_MODES) })}><option value="">All work modes</option>{WORK_MODES.map((value) => <option key={value} value={value}>{formatWorkMode(value)}</option>)}</FilterSelect>
        </div>
      </Drawer>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Calculating workspace analytics">
      <span className="sr-only">Calculating workspace analytics…</span>
      <div aria-hidden="true">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} rounded="lg" className="h-32 w-full" />)}
        </div>
      </div>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton rows={5} /><PanelSkeleton rows={4} />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `analytics-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">{children}</select></div>;
}

function AnalyticsResults({ analytics, section }: { analytics: Analytics; section: AnalyticsSection }) {
  return (
    <div className="space-y-7">
      {section === "overview" ? <Overview analytics={analytics} /> : null}
      {section === "pipeline" ? <Pipeline analytics={analytics} /> : null}
      {section === "sources" ? <Sources analytics={analytics} /> : null}
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800" aria-label="Analytics context"><p className="font-semibold">About these insights</p><p className="mt-1">{analytics.disclaimer}</p></section>
    </div>
  );
}

function Overview({ analytics }: { analytics: Analytics }) {
  const maxTrend = Math.max(1, ...analytics.submission_trend.map((point) => point.count));
  const maxWorkMode = Math.max(1, ...analytics.work_mode_breakdown.map((item) => item.count));
  return <>
    <section aria-labelledby="search-health-title">
      <div className="flex items-center gap-2">
        <Lightbulb aria-hidden="true" className="size-5 text-brand-700" />
        <h2 id="search-health-title" className="text-xl font-bold text-slate-950">Search health</h2>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{searchHealthSummary(analytics.insights)}</p>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">A curated view of what changed, why it matters, and what to do next, based only on this workspace&apos;s tracked data. These signals are observations, not hiring predictions.</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {analytics.insights.map((insight) => <InsightCard key={insight.code} insight={insight} />)}
      </ul>
    </section>
    <section aria-labelledby="outcomes-title">
      <h2 id="outcomes-title" className="text-xl font-bold text-slate-950">Outcome snapshot</h2>
      <p className="mt-1 text-sm text-slate-600">Rates use submitted applications as the denominator.</p>
      {analytics.source_performance.some((row) => !row.sample_sufficient) ? <p className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Small sample</p> : null}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Responses", analytics.rates.response_rate, analytics.rates.response_count], ["Interviews", analytics.rates.interview_rate, analytics.rates.interview_count], ["Offers", analytics.rates.offer_rate, analytics.rates.offer_count], ["Acceptances", analytics.rates.acceptance_rate, analytics.rates.acceptance_count]].map(([label, value, count]) => <li key={label}><Link to="/applications?view=ALL" className="group block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-panel transition hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><p className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-600"><span>{label}</span><ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" /></p><p className="mt-2 text-3xl font-black text-slate-950">{percent(Number(value))}</p><p className="mt-2 text-xs text-slate-500">{count} of {analytics.rates.submitted_count} submitted</p></Link></li>)}</ul>
      <p className="mt-3 text-xs text-slate-500">Outcome links open the supporting workspace. Historical milestones may differ from an application&apos;s current status.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3"><Metric label="Average first response" value={analytics.average_days_to_first_response === null ? "Not enough data" : `${analytics.average_days_to_first_response.toFixed(1)} days`} /><Metric label="No response yet" value={String(analytics.no_response_count)} /><Link to="/applications?view=ACTIVE" className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><p className="flex items-center justify-between text-sm text-slate-600"><span>Active pursuits</span><ArrowRight aria-hidden="true" className="size-4" /></p><p className="mt-1 text-xl font-bold text-slate-950">{analytics.summary.active_pursuits}</p></Link></div>
    </section>
    <div className="grid gap-6 lg:grid-cols-2">
      <PeriodComparison analytics={analytics} />
      <FollowUpCoverage analytics={analytics} />
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
      <figure className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="analytics-trend-title"><figcaption id="analytics-trend-title" className="text-lg font-bold text-slate-950">Submission trend</figcaption><div className="mt-6 flex h-48 min-w-0 items-end gap-2" role="img" aria-label="Weekly application submission chart">{analytics.submission_trend.map((point) => <div key={point.week_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`Week of ${formatDateOnly(point.week_start)}: ${point.count}`}><span className="text-xs font-bold text-slate-600">{point.count}</span><span aria-hidden="true" className="w-full max-w-12 rounded-t bg-gradient-to-t from-brand-600 to-violet-500" style={{ height: `${Math.max(4, (point.count / maxTrend) * 120)}px` }} /><time dateTime={point.week_start} className="max-w-full truncate text-[0.68rem] font-semibold text-slate-500">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.week_start}T00:00:00Z`))}</time></div>)}</div></figure>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="work-mode-title"><h2 id="work-mode-title" className="text-lg font-bold text-slate-950">Work mode breakdown</h2><ul className="mt-5 space-y-4">{analytics.work_mode_breakdown.map((item) => <li key={item.work_mode}><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-800">{formatWorkMode(item.work_mode)}</span><span className="font-black text-slate-950">{item.count}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(item.count / maxWorkMode) * 100}%` }} /></div></li>)}</ul></section>
    </div>
  </>;
}

function InsightCard({ insight }: { insight: SearchHealthInsight }) {
  const [expanded, setExpanded] = useState(false);
  const evidenceId = `search-health-evidence-${insight.code.toLowerCase()}`;
  const presentation = insightPresentation[insight.tone];
  const Icon = presentation.icon;
  return (
    <li className={`rounded-lg border border-line border-l-4 bg-surface-raised p-4 shadow-panel ${presentation.accent}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${presentation.badge}`}>
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {presentation.label}
        </span>
        {insight.evidence_label ? <span className="min-w-0 text-xs font-semibold text-ink-muted">{insight.evidence_label}</span> : null}
      </div>
      <h3 className="mt-3 text-base font-bold text-ink">{insight.title}</h3>
      <p className="mt-1 text-sm leading-5 text-ink-muted">{insight.description}</p>
      <p className="mt-3 text-xs font-bold leading-5 text-ink">{insight.evidence_summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2">
        {insight.action ? <Link to={insightHref(insight.action)} aria-label={`Suggested action: ${insight.action.label}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-bold text-accent hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{insight.action.label}<ArrowRight aria-hidden="true" className="size-4" /></Link> : null}
        <button type="button" aria-expanded={expanded} aria-controls={evidenceId} aria-label={`Why you're seeing this: ${insight.title}`} onClick={() => setExpanded((current) => !current)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Why?
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div id={evidenceId} hidden={!expanded} className="mt-2 rounded-lg bg-surface-muted p-3 text-xs leading-5 text-ink-muted">
        {insight.evidence}
      </div>
    </li>
  );
}

function PeriodComparison({ analytics }: { analytics: Analytics }) {
  const comparison = analytics.period_comparison;
  if (!comparison.available || !comparison.current || !comparison.previous || !comparison.deltas) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="comparison-title"><h2 id="comparison-title" className="text-lg font-bold text-slate-950">Compared with the previous period</h2><p className="mt-2 text-sm leading-6 text-slate-600">Choose a 30- or 90-day range to compare it with the equally sized, immediately preceding window.</p></section>;
  }
  const rows = [
    ["Submissions", String(comparison.current.submitted_count), `${comparison.deltas.submitted_count > 0 ? "+" : ""}${comparison.deltas.submitted_count}`],
    ["Response rate", percent(comparison.current.response_rate), percentagePointDelta(comparison.deltas.response_rate)],
    ["Interview rate", percent(comparison.current.interview_rate), percentagePointDelta(comparison.deltas.interview_rate)],
    ["Offer rate", percent(comparison.current.offer_rate), percentagePointDelta(comparison.deltas.offer_rate)],
  ];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="comparison-title"><h2 id="comparison-title" className="text-lg font-bold text-slate-950">Compared with the previous period</h2><p className="mt-1 text-xs text-slate-500"><time dateTime={comparison.previous_start ?? undefined}>{comparison.previous_start ? formatDateOnly(comparison.previous_start) : ""}</time>–<time dateTime={comparison.previous_end ?? undefined}>{comparison.previous_end ? formatDateOnly(comparison.previous_end) : ""}</time> is the adjacent comparison window.</p><dl className="mt-5 divide-y divide-slate-100">{rows.map(([label, value, delta]) => <div key={label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-sm font-semibold text-slate-700">{label}</dt><dd className="text-right"><span className="font-black text-slate-950">{value}</span><span className="ml-2 text-xs font-semibold text-slate-500">{delta}</span></dd></div>)}</dl><p className="mt-4 text-xs text-slate-500">Rate changes are percentage-point differences, not predictions.</p></section>;
}

function FollowUpCoverage({ analytics }: { analytics: Analytics }) {
  const coverage = analytics.follow_up_coverage;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="follow-up-coverage-title"><div className="flex items-center gap-2"><CalendarCheck2 aria-hidden="true" className="size-5 text-brand-700" /><h2 id="follow-up-coverage-title" className="text-lg font-bold text-slate-950">Follow-up coverage</h2></div><p className="mt-1 text-sm text-slate-600">Active applications with a scheduled next step.</p><p className="mt-5 text-4xl font-black text-slate-950">{percent(coverage.coverage_rate)}</p><p className="mt-1 text-sm text-slate-600">{coverage.scheduled_count} of {coverage.active_count} active pursuits scheduled</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-brand-500" style={{ width: `${coverage.coverage_rate * 100}%` }} /></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Metric label="Missing" value={String(coverage.missing_count)} /><Metric label="Due today" value={String(coverage.due_today_count)} /><Metric label="Overdue" value={String(coverage.overdue_count)} /></div><Link to="/applications?view=ACTIVE" className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-brand-700 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">Review active applications<ArrowRight aria-hidden="true" className="size-4" /></Link></section>;
}

function Pipeline({ analytics }: { analytics: Analytics }) {
  const maxStatus = Math.max(1, ...analytics.status_breakdown.map((item) => item.count));
  const stageAges = new Map(analytics.stage_aging.map((item) => [item.bucket, item.count]));
  return <>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="status-distribution-title"><h2 id="status-distribution-title" className="text-xl font-bold text-slate-950">Current status distribution</h2><p className="mt-1 text-sm text-slate-600">Where opportunities sit right now.</p><ul className="mt-5 grid gap-4 sm:grid-cols-2">{analytics.status_breakdown.map((item) => <li key={item.status}><div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{formatStatus(item.status)}</span><span className="text-slate-600">{item.count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div></li>)}</ul></section>
    <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="funnel-title"><h2 id="funnel-title" className="text-lg font-bold text-slate-950">Historical funnel</h2><p className="mt-1 text-sm text-slate-600">Applications that reached each milestone at least once.</p><ol className="mt-5 space-y-3">{analytics.funnel.map((stage) => <li key={stage.stage} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><div><p className="font-semibold text-slate-800">{stage.stage.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</p><p className="text-xs text-slate-500">{percent(stage.rate)} of submitted</p></div><span className="text-xl font-black text-slate-950">{stage.count}</span></li>)}</ol></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="aging-title"><h2 id="aging-title" className="text-lg font-bold text-slate-950">Applications by time in their current stage</h2><p className="mt-2 text-sm leading-6 text-slate-600">These are active applications in Applied, Screening, Interview, or Offer. The timer resets whenever an application moves to a new stage.</p><p className="mt-3 rounded-xl bg-surface-muted p-3 text-xs leading-5 text-ink-muted">Use these ranges to decide what to review next. They are descriptive signals, not predictions about an application&apos;s outcome.</p><ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">{STAGE_AGE_BUCKETS.map((bucket) => { const count = stageAges.get(bucket) ?? 0; const guidance = stageAgeGuidance[bucket]; const countLabel = count === 0 ? "No applications in this range" : count === 1 ? "1 application" : `${count} applications`; const content = <><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink">{formatStageAge(bucket)}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{guidance.description}</p></div><span className="text-sm font-bold text-ink">{countLabel}</span></div>{count > 0 ? <span className="mt-3 inline-flex min-h-10 items-center font-bold text-accent">View applications<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></span> : null}</>; return <li key={bucket} className={`rounded-xl border bg-surface-raised p-4 ${guidance.tone}`}>{count > 0 ? <Link to={stageAgeHref(bucket)} aria-label={`View applications aged ${formatStageAge(bucket)} (${countLabel})`} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{content}</Link> : <div>{content}</div>}</li>; })}</ul></section></div>
  </>;
}

function Sources({ analytics }: { analytics: Analytics }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="source-title"><h2 id="source-title" className="text-xl font-bold text-slate-950">Source performance</h2><p className="mt-1 text-sm text-slate-600">Table comparisons require three submissions; Search Health source conclusions require five.</p>
    <ul className="mt-5 space-y-3 md:hidden">{analytics.source_performance.map((row) => <li key={row.source} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-950">{formatSource(row.source)}</h3>{!row.sample_sufficient ? <SmallSample /> : null}</div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><SourceMetric label="Submitted" value={String(row.submitted_count)} /><SourceMetric label="Response" value={`${percent(row.response_rate)} (${row.response_count})`} /><SourceMetric label="Interview" value={`${percent(row.interview_rate)} (${row.interview_count})`} /><SourceMetric label="Offer" value={`${percent(row.offer_rate)} (${row.offer_count})`} /></dl></li>)}</ul>
    <div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full min-w-[42rem] border-collapse text-left text-sm"><caption className="sr-only">Application outcome rates grouped by source</caption><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th scope="col" className="px-3 py-3">Source</th><th scope="col" className="px-3 py-3">Submitted</th><th scope="col" className="px-3 py-3">Response</th><th scope="col" className="px-3 py-3">Interview</th><th scope="col" className="px-3 py-3">Offer</th></tr></thead><tbody>{analytics.source_performance.map((row) => <tr key={row.source} className="border-b border-slate-100 last:border-0"><th scope="row" className="px-3 py-4 font-semibold text-slate-800">{formatSource(row.source)}{!row.sample_sufficient ? <span className="ml-2"><SmallSample /></span> : null}</th><td className="px-3 py-4 text-slate-700">{row.submitted_count}</td><td className="px-3 py-4 text-slate-700">{percent(row.response_rate)} <span className="text-xs text-slate-500">({row.response_count})</span></td><td className="px-3 py-4 text-slate-700">{percent(row.interview_rate)} <span className="text-xs text-slate-500">({row.interview_count})</span></td><td className="px-3 py-4 text-slate-700">{percent(row.offer_rate)} <span className="text-xs text-slate-500">({row.offer_count})</span></td></tr>)}</tbody></table></div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-xl font-bold text-slate-950">{value}</p></div>; }
function SourceMetric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div>; }
function SmallSample() { return <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[0.68rem] font-bold text-amber-900">Small sample</span>; }
