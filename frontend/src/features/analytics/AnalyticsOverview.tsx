import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Eye,
  Info,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { APPLICATION_SOURCES, APPLICATION_STATUSES, type ApplicationSource, type ApplicationStatus } from "../../api/schemas";
import type { Analytics } from "../../api/workspace";
import { formatDateOnly, formatWorkMode } from "../applications/format";
import { percent, percentagePointDelta } from "./format";

type SearchHealthInsight = Analytics["insights"][number];
type OverviewDetail = "outcomes" | "activity" | "follow-up" | "work-mode";

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

function insightHref(action: NonNullable<SearchHealthInsight["action"]>) {
  if (action.kind === "ADD_APPLICATION") return "/applications/new";
  const params = new URLSearchParams();
  const view = action.parameters.view;
  const source = action.parameters.source;
  const status = action.parameters.status;
  const followUp = action.parameters.follow_up;
  if (view === "ALL" || view === "ACTIVE") params.set("view", view);
  if (source && APPLICATION_SOURCES.includes(source as ApplicationSource)) params.set("source", source);
  if (status && APPLICATION_STATUSES.includes(status as ApplicationStatus)) params.set("status", status);
  if (followUp === "NEEDS_ATTENTION") params.set("follow_up", followUp);
  return `/applications${params.size ? `?${params.toString()}` : ""}`;
}

function periodSummary(analytics: Analytics) {
  const comparison = analytics.period_comparison;
  if (!comparison.available || !comparison.current || !comparison.deltas) {
    return "All-time view includes your complete tracked history. Choose a 30- or 90-day range to compare periods.";
  }
  const submissions = comparison.current.submitted_count;
  const difference = comparison.deltas.submitted_count;
  const change = difference === 0
    ? "the same as the previous period"
    : `${Math.abs(difference)} ${difference > 0 ? "more" : "fewer"} than the previous period`;
  return `${submissions} ${submissions === 1 ? "submission" : "submissions"} in this period — ${change}.`;
}

export function AnalyticsOverview({ analytics }: { analytics: Analytics }) {
  const [allInsightsOpen, setAllInsightsOpen] = useState(false);
  const [openDetails, setOpenDetails] = useState<Set<OverviewDetail>>(() => new Set());
  const primaryInsight = analytics.insights[0];
  const remainingInsights = analytics.insights.slice(1);
  const hasSmallSample = analytics.source_performance.some((row) => !row.sample_sufficient);

  function toggleDetail(detail: OverviewDetail) {
    setOpenDetails((current) => {
      const next = new Set(current);
      if (next.has(detail)) next.delete(detail);
      else next.add(detail);
      return next;
    });
  }

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="overview-story-title"
        className="overflow-hidden rounded-[1.75rem] border border-line bg-surface-raised shadow-panel"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.7fr)]">
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
                <Lightbulb aria-hidden="true" className="size-4" />
                Your search story
              </span>
              {hasSmallSample ? <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">Small sample</span> : null}
            </div>
            <h2 id="overview-story-title" className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Your search at a glance
            </h2>

            <div className="mt-6">
              {primaryInsight ? <InsightContent insight={primaryInsight} primary /> : <div className="border-l-4 border-l-accent pl-4">
                <p className="text-lg font-bold text-ink">Keep tracking to build a clearer picture</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">As applications and outcomes are added, HireFlux will surface useful changes and next steps here.</p>
              </div>}
            </div>

            {remainingInsights.length ? (
              <div className="mt-6 border-t border-line pt-2">
                <button
                  type="button"
                  aria-expanded={allInsightsOpen}
                  aria-controls="additional-search-health-insights"
                  onClick={() => setAllInsightsOpen((current) => !current)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-accent hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {allInsightsOpen ? "Hide additional insights" : `View all insights (${analytics.insights.length})`}
                  <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${allInsightsOpen ? "rotate-180" : ""}`} />
                </button>
                <ul id="additional-search-health-insights" hidden={!allInsightsOpen} className="divide-y divide-line">
                  {remainingInsights.map((insight) => <li key={insight.code} className="py-5"><InsightContent insight={insight} /></li>)}
                </ul>
              </div>
            ) : null}
          </div>

          <aside className="border-t border-line bg-surface-muted/60 p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8" aria-label="Current search pulse">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Current pulse</p>
            <dl className="mt-4 divide-y divide-line">
              <PulseMetric label="Active pursuits" value={String(analytics.summary.active_pursuits)} detail="Applied through offer" />
              <PulseMetric label="Response rate" value={percent(analytics.rates.response_rate)} detail={`${analytics.rates.response_count} of ${analytics.rates.submitted_count} submitted`} />
              <PulseMetric label="Interview rate" value={percent(analytics.rates.interview_rate)} detail={`${analytics.rates.interview_count} of ${analytics.rates.submitted_count} submitted`} />
            </dl>
          </aside>
        </div>
        <p className="border-t border-line px-5 py-4 text-sm leading-6 text-ink-muted sm:px-7 lg:px-8">
          <span className="font-semibold text-ink">Compared with your last period:</span> {periodSummary(analytics)}
        </p>
      </section>

      <section aria-labelledby="explore-analytics-title">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Explore when you need more</p>
          <h2 id="explore-analytics-title" className="mt-2 text-2xl font-bold text-ink">Explore your analytics</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Open only the part of your search you want to understand. These details use the same filters and date range as the summary above.</p>
        </div>

        <div className="mt-5 divide-y divide-line border-y border-line">
          <DisclosureSection
            id="analytics-outcomes"
            title="Outcomes and conversion"
            summary={`${percent(analytics.rates.response_rate)} response · ${percent(analytics.rates.interview_rate)} interview`}
            open={openDetails.has("outcomes")}
            onToggle={() => toggleDetail("outcomes")}
          >
            <OutcomesDetail analytics={analytics} />
          </DisclosureSection>
          <DisclosureSection
            id="analytics-activity"
            title="Activity and change"
            summary={`${analytics.rates.submitted_count} submitted in this view`}
            open={openDetails.has("activity")}
            onToggle={() => toggleDetail("activity")}
          >
            <ActivityDetail analytics={analytics} />
          </DisclosureSection>
          <DisclosureSection
            id="analytics-follow-up"
            title="Follow-up readiness"
            summary={`${analytics.follow_up_coverage.scheduled_count} of ${analytics.follow_up_coverage.active_count} active pursuits scheduled`}
            open={openDetails.has("follow-up")}
            onToggle={() => toggleDetail("follow-up")}
          >
            <FollowUpDetail analytics={analytics} />
          </DisclosureSection>
          <DisclosureSection
            id="analytics-work-mode"
            title="Work preferences"
            summary="Your tracked remote, hybrid, and onsite mix"
            open={openDetails.has("work-mode")}
            onToggle={() => toggleDetail("work-mode")}
          >
            <WorkModeDetail analytics={analytics} />
          </DisclosureSection>
        </div>
      </section>
    </div>
  );
}

function InsightContent({ insight, primary = false }: { insight: SearchHealthInsight; primary?: boolean }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceId = `search-health-evidence-${primary ? "primary-" : ""}${insight.code.toLowerCase()}`;
  const presentation = insightPresentation[insight.tone];
  const Icon = presentation.icon;
  return (
    <article className={`border-l-4 pl-4 ${presentation.accent}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${presentation.badge}`}>
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {presentation.label}
        </span>
        {insight.evidence_label ? <span className="text-xs font-semibold text-ink-muted">{insight.evidence_label}</span> : null}
      </div>
      <h3 className={`${primary ? "mt-4 text-xl sm:text-2xl" : "mt-3 text-base"} font-bold text-ink`}>{insight.title}</h3>
      <p className={`mt-2 max-w-2xl leading-6 text-ink-muted ${primary ? "text-base" : "text-sm"}`}>{insight.description}</p>
      <p className="mt-3 text-xs font-bold leading-5 text-ink">{insight.evidence_summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {insight.action ? <Link to={insightHref(insight.action)} aria-label={`Suggested action: ${insight.action.label}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-bold text-accent hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{insight.action.label}<ArrowRight aria-hidden="true" className="size-4" /></Link> : null}
        <button type="button" aria-expanded={evidenceOpen} aria-controls={evidenceId} aria-label={`Why you're seeing this: ${insight.title}`} onClick={() => setEvidenceOpen((current) => !current)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          Why?
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${evidenceOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div id={evidenceId} hidden={!evidenceOpen} className="mt-2 rounded-lg bg-surface-muted p-3 text-xs leading-5 text-ink-muted">{insight.evidence}</div>
    </article>
  );
}

function PulseMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="py-4 first:pt-0 last:pb-0"><dt className="text-sm font-semibold text-ink-muted">{label}</dt><dd className="mt-1 text-3xl font-black tracking-tight text-ink">{value}</dd><dd className="mt-1 text-xs text-ink-muted">{detail}</dd></div>;
}

function DisclosureSection({ id, title, summary, open, onToggle, children }: { id: string; title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-trigger`}>
      <button id={`${id}-trigger`} type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={onToggle} className="flex min-h-20 w-full items-center justify-between gap-4 rounded-lg px-1 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-3">
        <span><span className="block text-base font-bold text-ink sm:text-lg">{title}</span><span className="mt-1 block text-sm text-ink-muted">{summary}</span></span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={`${id}-content`} hidden={!open} className="px-1 pb-7 sm:px-3">{children}</div>
    </section>
  );
}

function OutcomesDetail({ analytics }: { analytics: Analytics }) {
  const outcomes = [
    ["Responses", analytics.rates.response_rate, analytics.rates.response_count],
    ["Interviews", analytics.rates.interview_rate, analytics.rates.interview_count],
    ["Offers", analytics.rates.offer_rate, analytics.rates.offer_count],
    ["Acceptances", analytics.rates.acceptance_rate, analytics.rates.acceptance_count],
  ] as const;
  return <div className="rounded-2xl bg-surface-muted/60 p-4 sm:p-6">
    <p className="max-w-2xl text-sm leading-6 text-ink-muted">Rates use submitted applications as the denominator. Historical milestones remain counted even when an application later changes status.</p>
    <ol className="mt-5 divide-y divide-line">
      {outcomes.map(([label, rate, count]) => <li key={label}><Link to="/applications?view=ALL" className="group grid min-h-20 items-center gap-3 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:grid-cols-[10rem_1fr_auto]"><span className="font-bold text-ink">{label}</span><span className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true"><span className="block h-full rounded-full bg-accent" style={{ width: `${rate * 100}%` }} /></span><span className="text-right"><span className="block text-2xl font-black text-ink">{percent(rate)}</span><span className="text-xs text-ink-muted">{count} of {analytics.rates.submitted_count}</span></span></Link></li>)}
    </ol>
    <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2"><CompactDefinition label="Average first response" value={analytics.average_days_to_first_response === null ? "Not enough data" : `${analytics.average_days_to_first_response.toFixed(1)} days`} /><CompactDefinition label="No response yet" value={String(analytics.no_response_count)} /></dl>
  </div>;
}

function ActivityDetail({ analytics }: { analytics: Analytics }) {
  const maximum = Math.max(1, ...analytics.submission_trend.map((point) => point.count));
  const comparison = analytics.period_comparison;
  const comparisonRows = comparison.available && comparison.current && comparison.deltas ? [
    ["Submissions", String(comparison.current.submitted_count), `${comparison.deltas.submitted_count > 0 ? "+" : ""}${comparison.deltas.submitted_count}`],
    ["Response rate", percent(comparison.current.response_rate), percentagePointDelta(comparison.deltas.response_rate)],
    ["Interview rate", percent(comparison.current.interview_rate), percentagePointDelta(comparison.deltas.interview_rate)],
    ["Offer rate", percent(comparison.current.offer_rate), percentagePointDelta(comparison.deltas.offer_rate)],
  ] : null;
  return <div className="grid gap-7 rounded-2xl bg-surface-muted/60 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
    <figure className="min-w-0" aria-labelledby="analytics-trend-title"><figcaption id="analytics-trend-title" className="font-bold text-ink">Weekly submissions</figcaption><div className="mt-6 flex h-48 min-w-0 items-end gap-2" role="img" aria-label="Weekly application submission chart">{analytics.submission_trend.map((point) => <div key={point.week_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`Week of ${formatDateOnly(point.week_start)}: ${point.count}`}><span className="text-xs font-bold text-ink-muted">{point.count}</span><span aria-hidden="true" className="w-full max-w-12 rounded-t bg-gradient-to-t from-accent to-violet" style={{ height: `${Math.max(4, (point.count / maximum) * 120)}px` }} /><time dateTime={point.week_start} className="max-w-full truncate text-[0.68rem] font-semibold text-ink-muted">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.week_start}T00:00:00Z`))}</time></div>)}</div></figure>
    <section aria-labelledby="comparison-title"><h3 id="comparison-title" className="font-bold text-ink">Compared with the previous period</h3>{comparisonRows ? <><p className="mt-1 text-xs leading-5 text-ink-muted"><time dateTime={comparison.previous_start ?? undefined}>{comparison.previous_start ? formatDateOnly(comparison.previous_start) : ""}</time>–<time dateTime={comparison.previous_end ?? undefined}>{comparison.previous_end ? formatDateOnly(comparison.previous_end) : ""}</time> is the adjacent window.</p><dl className="mt-4 divide-y divide-line">{comparisonRows.map(([label, value, delta]) => <div key={label} className="flex items-center justify-between gap-4 py-3"><dt className="text-sm font-semibold text-ink-muted">{label}</dt><dd className="text-right"><span className="font-black text-ink">{value}</span><span className="ml-2 text-xs font-semibold text-ink-muted">{delta}</span></dd></div>)}</dl><p className="mt-3 text-xs text-ink-muted">Rate changes are percentage-point differences, not predictions.</p></> : <p className="mt-2 text-sm leading-6 text-ink-muted">Choose a 30- or 90-day range to compare it with the equally sized, immediately preceding window.</p>}</section>
  </div>;
}

function FollowUpDetail({ analytics }: { analytics: Analytics }) {
  const coverage = analytics.follow_up_coverage;
  return <div className="rounded-2xl bg-surface-muted/60 p-4 sm:p-6"><div className="flex items-center gap-2"><CalendarCheck2 aria-hidden="true" className="size-5 text-accent" /><h3 className="font-bold text-ink">Active applications with a scheduled next step</h3></div><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-4xl font-black text-ink">{percent(coverage.coverage_rate)}</p><p className="mt-1 text-sm text-ink-muted">{coverage.scheduled_count} of {coverage.active_count} active pursuits scheduled</p></div><Link to="/applications?view=ACTIVE" className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg font-bold text-accent hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Review active applications<ArrowRight aria-hidden="true" className="size-4" /></Link></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true"><div className="h-full rounded-full bg-accent" style={{ width: `${coverage.coverage_rate * 100}%` }} /></div><dl className="mt-5 grid grid-cols-3 divide-x divide-line text-center"><CompactDefinition label="Missing" value={String(coverage.missing_count)} /><CompactDefinition label="Due today" value={String(coverage.due_today_count)} /><CompactDefinition label="Overdue" value={String(coverage.overdue_count)} /></dl></div>;
}

function WorkModeDetail({ analytics }: { analytics: Analytics }) {
  const maximum = Math.max(1, ...analytics.work_mode_breakdown.map((item) => item.count));
  return <div className="rounded-2xl bg-surface-muted/60 p-4 sm:p-6"><p className="max-w-2xl text-sm leading-6 text-ink-muted">This describes the work arrangements in your tracked search. It is context, not a measure of search success.</p><ul className="mt-5 space-y-4">{analytics.work_mode_breakdown.map((item) => <li key={item.work_mode}><div className="flex items-center justify-between gap-3"><span className="font-semibold text-ink">{formatWorkMode(item.work_mode)}</span><span className="font-black text-ink">{item.count}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true"><div className="h-full rounded-full bg-accent" style={{ width: `${(item.count / maximum) * 100}%` }} /></div></li>)}</ul></div>;
}

function CompactDefinition({ label, value }: { label: string; value: string }) {
  return <div className="px-2 first:pl-0 last:pr-0"><dt className="text-xs font-semibold text-ink-muted">{label}</dt><dd className="mt-1 text-lg font-black text-ink">{value}</dd></div>;
}
