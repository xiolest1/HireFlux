import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  WORK_MODES,
} from "../api/schemas";
import { ErrorPanel, LoadingState } from "../components/ui/Feedback";
import {
  formatDateOnly,
  formatSource,
  formatStatus,
  formatWorkMode,
} from "../features/applications/format";
import { useAnalytics } from "../features/workspace/queries";

function allowed<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

function percent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = allowed(searchParams.get("range"), ["30d", "90d", "all"] as const) ?? "90d";
  const status = allowed(searchParams.get("status"), APPLICATION_STATUSES);
  const source = allowed(searchParams.get("source"), APPLICATION_SOURCES);
  const workMode = allowed(searchParams.get("work_mode"), WORK_MODES);
  const analyticsQuery = useAnalytics({ range, status, source, workMode });

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Search insights</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Analytics</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
          Understand activity and outcomes in this workspace without turning a small dataset into a prediction.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel" aria-labelledby="analytics-filters-title">
        <h2 id="analytics-filters-title" className="text-sm font-bold text-slate-950">Filter analytics</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Date range" value={range} onChange={(value) => setFilter("range", value)}>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Filter>
          <Filter label="Current status" value={status ?? ""} onChange={(value) => setFilter("status", value)}>
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}
          </Filter>
          <Filter label="Source" value={source ?? ""} onChange={(value) => setFilter("source", value)}>
            <option value="">All sources</option>
            {APPLICATION_SOURCES.map((value) => <option key={value} value={value}>{formatSource(value)}</option>)}
          </Filter>
          <Filter label="Work mode" value={workMode ?? ""} onChange={(value) => setFilter("work_mode", value)}>
            <option value="">All work modes</option>
            {WORK_MODES.map((value) => <option key={value} value={value}>{formatWorkMode(value)}</option>)}
          </Filter>
        </div>
      </section>

      {analyticsQuery.isPending ? <LoadingState label="Calculating workspace analytics…" /> : null}
      {analyticsQuery.isError ? (
        <ErrorPanel title="Analytics could not be loaded" error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
      ) : null}
      {analyticsQuery.data ? <AnalyticsResults analytics={analyticsQuery.data} /> : null}
    </div>
  );
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `analytics-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
        {children}
      </select>
    </div>
  );
}

function AnalyticsResults({ analytics }: { analytics: import("../api/workspace").Analytics }) {
  const maxTrend = Math.max(1, ...analytics.submission_trend.map((point) => point.count));
  const maxStatus = Math.max(1, ...analytics.status_breakdown.map((item) => item.count));
  const maxWorkMode = Math.max(1, ...analytics.work_mode_breakdown.map((item) => item.count));
  return (
    <>
      <section aria-labelledby="outcomes-title">
        <h2 id="outcomes-title" className="text-xl font-bold text-slate-950">Outcome snapshot</h2>
        <p className="mt-1 text-sm text-slate-600">Current-state counts use applications submitted in the selected range plus current drafts. Rates use submitted applications as the denominator.</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Responses", analytics.rates.response_rate, analytics.rates.response_count],
            ["Interviews", analytics.rates.interview_rate, analytics.rates.interview_count],
            ["Offers", analytics.rates.offer_rate, analytics.rates.offer_count],
            ["Acceptances", analytics.rates.acceptance_rate, analytics.rates.acceptance_count],
          ].map(([label, value, count]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <dt className="text-sm font-semibold text-slate-600">{label}</dt>
              <dd className="mt-2 text-3xl font-black text-slate-950">{percent(Number(value))}</dd>
              <p className="mt-2 text-xs text-slate-500">{count} of {analytics.rates.submitted_count} submitted</p>
            </div>
          ))}
        </dl>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-600">Average first response</dt><dd className="mt-1 text-xl font-bold text-slate-950">{analytics.average_days_to_first_response === null ? "Not enough data" : `${analytics.average_days_to_first_response.toFixed(1)} days`}</dd></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-600">No response yet</dt><dd className="mt-1 text-xl font-bold text-slate-950">{analytics.no_response_count}</dd></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-600">Active pursuits</dt><dd className="mt-1 text-xl font-bold text-slate-950">{analytics.summary.active_pursuits}</dd></div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <figure className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="analytics-trend-title">
          <figcaption id="analytics-trend-title" className="text-lg font-bold text-slate-950">Submission trend</figcaption>
          <div className="mt-6 flex h-44 items-end gap-2" aria-hidden="true">
            {analytics.submission_trend.map((point) => <div key={point.week_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-bold text-slate-600">{point.count}</span><span className="w-full max-w-12 rounded-t bg-brand-500" style={{ height: `${Math.max(4, (point.count / maxTrend) * 120)}px` }} /></div>)}
          </div>
          <ul className="sr-only">{analytics.submission_trend.map((point) => <li key={point.week_start}>Week of {formatDateOnly(point.week_start)}: {point.count}</li>)}</ul>
        </figure>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="status-distribution-title">
          <h2 id="status-distribution-title" className="text-lg font-bold text-slate-950">Current status distribution</h2>
          <ul className="mt-5 space-y-3">
            {analytics.status_breakdown.map((item) => <li key={item.status}><div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{formatStatus(item.status)}</span><span className="text-slate-600">{item.count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div></li>)}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="funnel-title">
          <h2 id="funnel-title" className="text-lg font-bold text-slate-950">Historical funnel</h2>
          <p className="mt-1 text-sm text-slate-600">Applications that reached each milestone at least once.</p>
          <ol className="mt-5 space-y-3">{analytics.funnel.map((stage) => <li key={stage.stage} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><div><p className="font-semibold text-slate-800">{stage.stage.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</p><p className="text-xs text-slate-500">{percent(stage.rate)} of submitted</p></div><span className="text-xl font-black text-slate-950">{stage.count}</span></li>)}</ol>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="aging-title">
          <h2 id="aging-title" className="text-lg font-bold text-slate-950">Time in current stage</h2>
          <p className="mt-1 text-sm text-slate-600">Aging buckets help surface opportunities that may need attention.</p>
          <dl className="mt-5 grid grid-cols-2 gap-3">{analytics.stage_aging.map((item) => <div key={item.bucket} className="rounded-xl border border-slate-200 p-4"><dt className="text-sm text-slate-600">{item.bucket}</dt><dd className="mt-1 text-2xl font-black text-slate-950">{item.count}</dd></div>)}</dl>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="work-mode-title">
        <h2 id="work-mode-title" className="text-lg font-bold text-slate-950">Work mode breakdown</h2>
        <p className="mt-1 text-sm text-slate-600">Submitted applications grouped by the role's working arrangement.</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {analytics.work_mode_breakdown.map((item) => (
            <li key={item.work_mode} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-800">{formatWorkMode(item.work_mode)}</span>
                <span className="text-xl font-black text-slate-950">{item.count}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(item.count / maxWorkMode) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="source-title">
        <h2 id="source-title" className="text-lg font-bold text-slate-950">Source performance</h2>
        <p className="mt-1 text-sm text-slate-600">Comparisons require at least three submitted applications from a source.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Source</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Response</th><th className="px-3 py-3">Interview</th><th className="px-3 py-3">Offer</th></tr></thead>
            <tbody>{analytics.source_performance.map((row) => <tr key={row.source} className="border-b border-slate-100 last:border-0"><th className="px-3 py-4 font-semibold text-slate-800">{formatSource(row.source)}{!row.sample_sufficient ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-[0.68rem] font-bold text-amber-900">Small sample</span> : null}</th><td className="px-3 py-4 text-slate-700">{row.submitted_count}</td><td className="px-3 py-4 text-slate-700">{percent(row.response_rate)} <span className="text-xs text-slate-500">({row.response_count})</span></td><td className="px-3 py-4 text-slate-700">{percent(row.interview_rate)} <span className="text-xs text-slate-500">({row.interview_count})</span></td><td className="px-3 py-4 text-slate-700">{percent(row.offer_rate)} <span className="text-xs text-slate-500">({row.offer_count})</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800" aria-label="Analytics context">
        <p className="font-semibold">About these insights</p>
        <p className="mt-1">{analytics.disclaimer}</p>
      </section>
    </>
  );
}
