import { ArrowRight, BarChart3, Filter, GitBranch, Search, X } from "lucide-react";
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
import { AnalyticsOverview } from "../features/analytics/AnalyticsOverview";
import { percent, percentagePointDelta } from "../features/analytics/format";
import { PipelineBoard } from "../features/pipeline/PipelineBoard";
import { formatDateOnly, formatSource, formatStageAge, formatStatus, formatWorkMode } from "../features/applications/format";
import { updateSearchTour, useAnalytics } from "../features/workspace/queries";

type AnalyticsSection = "overview" | "pipeline" | "sources";

const stageAgeGuidance: Record<StageAgeBucket, { description: string; tone: string }> = {
  "0-7": { description: "Recently entered this stage.", tone: "border-line" },
  "8-14": { description: "No recent stage change yet.", tone: "border-line" },
  "15-30": { description: "Consider reviewing the next step.", tone: "border-warning/30" },
  "31+": { description: "Prioritize a review or follow-up.", tone: "border-warning/55" },
};

function allowed<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

function stageAgeHref(bucket: StageAgeBucket) {
  return `/applications?view=ACTIVE&stage_age=${encodeURIComponent(bucket)}`;
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
  const isPipeline = section === "pipeline";
  const analyticsQuery = useAnalytics(
    { range, status, source, workMode },
    { enabled: !isPipeline },
  );

  useEffect(() => {
    updateSearchTour("analytics");
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
      <header>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Search insights</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Analytics</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-ink-muted">Understand what is moving, what needs attention, and where to explore next.</p>
        </div>
      </header>

      <div className={`flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center ${isPipeline ? "" : "sm:justify-between"}`}>
        <Tabs items={analyticsTabs} value={section} ariaLabel="Analytics sections" stretch className="sm:w-auto" />
        {!isPipeline ? <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-raised p-1">
          <label htmlFor="analytics-range" className="sr-only">Date range</label>
          <select id="analytics-range" value={range} onChange={(event) => updateParam("range", event.target.value)} className="min-h-10 min-w-0 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-3">
            <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option>
          </select>
          <span aria-hidden="true" className="h-6 w-px bg-line" />
          <button type="button" className={buttonClassName("ghost", "gap-2 px-3")} onClick={openFilters}><Filter aria-hidden="true" className="size-4" />Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button>
        </div> : null}
      </div>

      {!isPipeline && activeFilters.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active analytics filters">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Filtered by</span>
          {activeFilters.map((item) => <button key={item.name} type="button" onClick={() => updateParam(item.name)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 text-xs font-semibold text-ink-muted hover:border-line-strong hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" aria-label={`Remove ${item.label}`}><span>{item.label}</span><X aria-hidden="true" className="size-3.5" /></button>)}
        </div>
      ) : null}

      {isPipeline ? <PipelineBoard /> : <>
        {analyticsQuery.isFetching && analyticsQuery.data ? <p className="text-xs font-semibold text-ink-tertiary" role="status">Refreshing analytics…</p> : null}
        {analyticsQuery.isPending ? <AnalyticsSkeleton /> : null}
        {analyticsQuery.isError && !analyticsQuery.data ? <ErrorPanel title="Analytics could not be loaded" error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} /> : null}
        {analyticsQuery.data ? <AnalyticsResults analytics={analyticsQuery.data} section={section} /> : null}
      </>}

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
  return <div><label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="hf-field mt-2 px-3 text-sm font-semibold">{children}</select></div>;
}

function AnalyticsResults({ analytics, section }: { analytics: Analytics; section: AnalyticsSection }) {
  return (
    <div className="space-y-7">
      {section === "overview" ? <AnalyticsOverview analytics={analytics} /> : null}
      {section === "pipeline" ? <Pipeline analytics={analytics} /> : null}
      {section === "sources" ? <Sources analytics={analytics} /> : null}
      <section className={section === "overview" ? "border-t border-line-subtle pt-5 text-xs leading-5 text-ink-muted" : "rounded-2xl border border-info/25 bg-info-soft p-4 text-sm leading-6 text-info"} aria-label="Analytics context"><p className="font-semibold">About these insights</p><p className="mt-1">{analytics.disclaimer}</p></section>
    </div>
  );
}

function Pipeline({ analytics }: { analytics: Analytics }) {
  const maxStatus = Math.max(1, ...analytics.status_breakdown.map((item) => item.count));
  const stageAges = new Map(analytics.stage_aging.map((item) => [item.bucket, item.count]));
  return <>
    <section className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6" aria-labelledby="status-distribution-title"><h2 id="status-distribution-title" className="text-xl font-bold text-ink">Current status distribution</h2><p className="mt-1 text-sm text-ink-muted">Where opportunities sit right now.</p><ul className="mt-5 grid gap-4 sm:grid-cols-2">{analytics.status_breakdown.map((item) => <li key={item.status}><div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-ink">{formatStatus(item.status)}</span><span className="text-ink-muted">{item.count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div></li>)}</ul></section>
    <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-line-subtle bg-surface p-5" aria-labelledby="funnel-title"><h2 id="funnel-title" className="text-lg font-bold text-ink">Historical funnel</h2><p className="mt-1 text-sm text-ink-muted">Applications that reached each milestone at least once.</p><ol className="mt-5 space-y-3">{analytics.funnel.map((stage) => <li key={stage.stage} className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3"><div><p className="font-semibold text-ink">{stage.stage.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</p><p className="text-xs text-ink-tertiary">{percent(stage.rate)} of submitted</p></div><span className="text-xl font-black text-ink">{stage.count}</span></li>)}</ol></section><section className="rounded-2xl border border-line-subtle bg-surface p-5" aria-labelledby="aging-title"><h2 id="aging-title" className="text-lg font-bold text-ink">Applications by time in their current stage</h2><p className="mt-2 text-sm leading-6 text-ink-muted">These are active applications in Applied, Screening, Interview, or Offer. The timer resets whenever an application moves to a new stage.</p><p className="mt-3 rounded-xl bg-surface-muted p-3 text-xs leading-5 text-ink-muted">Use these ranges to decide what to review next. They are descriptive signals, not predictions about an application&apos;s outcome.</p><ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">{STAGE_AGE_BUCKETS.map((bucket) => { const count = stageAges.get(bucket) ?? 0; const guidance = stageAgeGuidance[bucket]; const countLabel = count === 0 ? "No applications in this range" : count === 1 ? "1 application" : `${count} applications`; const content = <><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink">{formatStageAge(bucket)}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{guidance.description}</p></div><span className="text-sm font-bold text-ink">{countLabel}</span></div>{count > 0 ? <span className="mt-3 inline-flex min-h-10 items-center font-bold text-accent">View applications<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></span> : null}</>; return <li key={bucket} className={`rounded-xl border bg-surface-raised p-4 ${guidance.tone}`}>{count > 0 ? <Link to={stageAgeHref(bucket)} aria-label={`View applications aged ${formatStageAge(bucket)} (${countLabel})`} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{content}</Link> : <div>{content}</div>}</li>; })}</ul></section></div>
  </>;
}

type SourceRow = Analytics["source_performance"][number];
type SourceSignal = NonNullable<SourceRow["signal"]>;

const sourceSignalPresentation: Record<SourceSignal, { label: string; className: string }> = {
  STRONG_PERFORMER: { label: "Stronger signal", className: "bg-success-soft text-success" },
  HIGH_VOLUME_LOW_RESPONSE: { label: "Worth reviewing", className: "bg-violet-soft text-violet" },
  PROMISING_EARLY: { label: "Early signal", className: "bg-info-soft text-info" },
  CONCENTRATED_MIX: { label: "Concentrated mix", className: "bg-warning-soft text-warning" },
  LIMITED_DATA: { label: "Small sample", className: "bg-warning-soft text-warning" },
};

function sourceApplicationsHref(source: ApplicationSource) {
  return `/applications?view=ALL&source=${encodeURIComponent(source)}`;
}

function sourceComparisonHref(analytics: Analytics) {
  const params = new URLSearchParams({ range: analytics.range, section: "sources" });
  if (analytics.filters.status) params.set("status", analytics.filters.status);
  if (analytics.filters.work_mode) params.set("work_mode", analytics.filters.work_mode);
  return `/analytics?${params.toString()}`;
}

function sourceRecentLabel(row: SourceRow) {
  const { recent } = row;
  if (recent.submitted_count === 0) return "No applications in this window";
  if (recent.response_rate_delta === null) {
    return `${recent.submitted_count} submitted · comparison needs more data`;
  }
  return `${recent.submitted_count} submitted · ${percentagePointDelta(recent.response_rate_delta)} response`;
}

function SourceSignalBadge({ signal }: { signal: SourceSignal | null }) {
  if (!signal) return null;
  const presentation = sourceSignalPresentation[signal];
  return <span className={`inline-flex rounded-full px-2 py-1 text-[0.68rem] font-bold ${presentation.className}`}>{presentation.label}</span>;
}

function Sources({ analytics }: { analytics: Analytics }) {
  const rows = analytics.source_performance.filter((row) => row.submitted_count > 0);
  const summary = analytics.source_summary;
  const sourcePeriod = analytics.source_period;
  const concentration = summary.concentration;
  return <section className="min-w-0 rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6" aria-labelledby="source-title">
    <h2 id="source-title" className="text-xl font-bold text-ink">Source strategy</h2>
    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">See which sources earn responses and interviews—not only where applications came from. Treat small samples as context, not conclusions.</p>
    <p className="mt-3 text-xs leading-5 text-ink-tertiary">Recent comparison: {sourcePeriod.label.toLowerCase()} ({formatDateOnly(sourcePeriod.current_start)}–{formatDateOnly(sourcePeriod.current_end)}) versus {formatDateOnly(sourcePeriod.previous_start)}–{formatDateOnly(sourcePeriod.previous_end)}.</p>

    {analytics.filters.source ? <div className="mt-4 flex flex-col gap-3 rounded-xl border border-info/25 bg-info-soft p-4 text-sm text-info sm:flex-row sm:items-center sm:justify-between"><p>Source comparisons are narrowed to {formatSource(analytics.filters.source)}. Clear this filter to compare your full source mix.</p><Link to={sourceComparisonHref(analytics)} className="inline-flex min-h-10 shrink-0 items-center font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Compare all sources<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></Link></div> : null}

    <h3 className="mt-5 text-base font-bold text-ink">Source strategy at a glance</h3>
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <SourceSummaryCard title="Where your effort is going">
        {summary.top_volume ? <><p className="text-lg font-bold text-ink">{formatSource(summary.top_volume.source)}</p><p className="mt-1 text-sm text-ink-muted">{summary.top_volume.submitted_count} submitted · {percent(summary.top_volume.application_share)} of your search</p>{concentration.flagged ? <p className="mt-3 text-sm leading-6 text-warning">This is above the {percent(concentration.threshold)} concentration review threshold. Testing another source may broaden your search.</p> : <p className="mt-3 text-sm leading-6 text-ink-muted">Your highest-volume source is below the concentration review threshold.</p>}</> : <p className="text-sm text-ink-muted">Add submitted applications with a source to see your source mix.</p>}
      </SourceSummaryCard>
      <SourceSummaryCard title="What is working">
        {summary.strongest_response ? <><p className="text-lg font-bold text-ink">{formatSource(summary.strongest_response.source)}</p><p className="mt-1 text-sm text-ink-muted">{percent(summary.strongest_response.response_rate)} response · {percentagePointDelta(summary.strongest_response.response_rate_delta_vs_overall)} vs overall</p><p className="mt-3 text-sm leading-6 text-ink-muted">Based on {summary.strongest_response.submitted_count} submitted applications.</p></> : <p className="text-sm leading-6 text-ink-muted">No source has enough evidence for a stronger-performance conclusion yet.</p>}
      </SourceSummaryCard>
      <SourceSummaryCard title="What changed recently">
        {summary.recent_movement ? <><p className="text-lg font-bold text-ink">{formatSource(summary.recent_movement.source)}</p><p className="mt-1 text-sm text-ink-muted">{summary.recent_movement.direction === "IMPROVING" ? "Response rate improved" : summary.recent_movement.direction === "DECLINING" ? "Response rate declined" : "Response rate held steady"} {summary.recent_movement.direction === "STABLE" ? "" : `${percentagePointDelta(summary.recent_movement.response_rate_delta)}`}</p><p className="mt-3 text-sm leading-6 text-ink-muted">{summary.recent_movement.submitted_count} recent submitted applications.</p></> : <p className="text-sm leading-6 text-ink-muted">There is not enough recent source data to compare a meaningful change yet.</p>}
      </SourceSummaryCard>
    </div>

    {!summary.sufficient_for_strategy ? <p className="mt-4 inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">Early source picture · Track at least 5 submitted applications for stronger strategy signals</p> : null}

    {rows.length === 0 ? <p className="mt-6 rounded-xl bg-surface-muted p-4 text-sm text-ink-muted">No submitted applications with a source match these filters yet.</p> : <>
      <ul className="mt-6 space-y-3 xl:hidden">{rows.map((row) => <li key={row.source} className="rounded-2xl border border-line-subtle bg-surface-raised p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-ink">{formatSource(row.source)}</h3><div className="flex items-center gap-2"><SourceSignalBadge signal={row.signal} />{!row.sample_sufficient && !row.signal ? <SmallSample /> : null}</div></div><dl className="mt-4 grid grid-cols-1 gap-3 min-[26rem]:grid-cols-2 text-sm"><SourceMetric label="Submitted" value={`${row.submitted_count} · ${percent(row.application_share)}`} /><SourceMetric label="Response" value={`${percent(row.response_rate)} (${row.response_count}) · ${percentagePointDelta(row.response_rate_delta_vs_overall)} vs overall`} /><SourceMetric label="Interview" value={`${percent(row.interview_rate)} (${row.interview_count}) · ${percentagePointDelta(row.interview_rate_delta_vs_overall)} vs overall`} /><SourceMetric label="Recent response" value={sourceRecentLabel(row)} /></dl>{row.guidance ? <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm leading-6 text-ink-muted">{row.guidance}</p> : null}<Link to={sourceApplicationsHref(row.source)} className="mt-4 inline-flex min-h-11 items-center font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">View applications<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></Link></li>)}</ul>
      <div className="mt-6 hidden max-w-full overflow-x-auto xl:block"><table className="w-full min-w-[68rem] border-collapse text-left text-sm"><caption className="sr-only">Application source strategy and outcome comparisons</caption><thead><tr className="border-b border-line text-xs uppercase tracking-wide text-ink-tertiary"><th scope="col" className="px-3 py-3">Source</th><th scope="col" className="px-3 py-3">Submitted</th><th scope="col" className="px-3 py-3">Response</th><th scope="col" className="px-3 py-3">Interview</th><th scope="col" className="px-3 py-3">Recent</th><th scope="col" className="px-3 py-3">What it means</th><th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.source} className="border-b border-line-subtle align-top last:border-0"><th scope="row" className="px-3 py-4 font-semibold text-ink"><p>{formatSource(row.source)}</p><div className="mt-2 flex flex-wrap gap-1.5"><SourceSignalBadge signal={row.signal} />{!row.sample_sufficient && !row.signal ? <SmallSample /> : null}</div></th><td className="px-3 py-4 text-ink-muted">{row.submitted_count}<p className="mt-1 text-xs text-ink-tertiary">{percent(row.application_share)} of search</p></td><td className="px-3 py-4 text-ink-muted">{percent(row.response_rate)} <span className="text-xs text-ink-tertiary">({row.response_count})</span><p className="mt-1 text-xs text-ink-tertiary">{percentagePointDelta(row.response_rate_delta_vs_overall)} vs overall</p></td><td className="px-3 py-4 text-ink-muted">{percent(row.interview_rate)} <span className="text-xs text-ink-tertiary">({row.interview_count})</span><p className="mt-1 text-xs text-ink-tertiary">{percentagePointDelta(row.interview_rate_delta_vs_overall)} vs overall</p></td><td className="px-3 py-4 text-ink-muted">{sourceRecentLabel(row)}<p className="mt-1 text-xs text-ink-tertiary">{row.recent_sample_sufficient ? "Recent sample is comparable" : "Recent sample is limited"}</p></td><td className="max-w-xs px-3 py-4 text-ink-muted">{row.guidance ?? "No source-specific conclusion yet. Keep tracking outcomes to build a clearer comparison."}</td><td className="px-3 py-4"><Link to={sourceApplicationsHref(row.source)} className="inline-flex min-h-10 items-center whitespace-nowrap font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">View applications<ArrowRight aria-hidden="true" className="ml-1.5 size-4" /></Link></td></tr>)}</tbody></table></div>
    </>}
  </section>;
}

function SourceSummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl bg-surface-muted p-4" aria-label={title}><p className="text-xs font-bold uppercase tracking-wide text-ink-tertiary">{title}</p><div className="mt-2">{children}</div></section>;
}

function SourceMetric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-ink-tertiary">{label}</dt><dd className="mt-1 font-semibold text-ink">{value}</dd></div>; }
function SmallSample() { return <span className="inline-flex rounded-full bg-warning-soft px-2 py-1 text-[0.68rem] font-bold text-warning">Small sample</span>; }
