import { Check, Circle } from "lucide-react";
import type { BenefitVisual, ProductBenefit } from "./benefitsModel";

function PerspectiveVisual({ visual }: { visual: Extract<BenefitVisual, { kind: "perspective" }> }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {visual.stages.map((stage, index) => (
        <div key={stage.label} className="rounded-xl border border-line bg-surface px-2.5 py-3 dark:border-slate-700 dark:bg-slate-900/80 sm:px-3.5">
          <div className="flex items-center justify-between gap-1 sm:gap-3">
            <span className="text-[0.56rem] font-bold uppercase tracking-[0.06em] text-ink-muted dark:text-slate-400 sm:text-[0.64rem] sm:tracking-[0.09em]">{stage.label}</span>
            <span className="text-base font-black tracking-tight text-ink dark:text-white sm:text-lg">{stage.value}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line dark:bg-slate-700">
            <div className={`h-full rounded-full ${index === 1 ? "bg-violet" : index === 3 ? "bg-success" : "bg-accent"}`} style={{ width: `${Math.max(28, (stage.value / 8) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const priorityTone = {
  now: "border-warning/25 bg-warning-soft/65 text-warning",
  waiting: "border-line-strong bg-surface text-ink-muted dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300",
  later: "border-violet/20 bg-violet-soft/45 text-violet",
} as const;

function AttentionVisual({ visual }: { visual: Extract<BenefitVisual, { kind: "attention" }> }) {
  return (
    <div className="grid gap-2.5 lg:grid-cols-3">
      {visual.priorities.map((priority) => (
        <div key={priority.level} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-900/80 lg:block">
          <span className={`row-span-2 inline-flex min-w-20 justify-center rounded-full border px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] ${priorityTone[priority.level]}`}>{priority.label}</span>
          <span className="text-xs font-bold text-ink dark:text-white lg:mt-3 lg:block">{priority.detail}</span>
          <span className="mt-0.5 text-[0.62rem] font-semibold text-ink-muted dark:text-slate-400 lg:block">{priority.level === "now" ? "Due today" : priority.level === "waiting" ? "Employer owns the next step" : "No immediate deadline"}</span>
        </div>
      ))}
    </div>
  );
}

function PreparationVisual({ visual }: { visual: Extract<BenefitVisual, { kind: "preparation" }> }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.6rem] font-black uppercase tracking-[0.11em] text-violet">Context retained</p>
        <span className="text-[0.6rem] font-bold text-ink-muted dark:text-slate-400">2 of 3 prepared</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {visual.context.map((item) => <span key={item} className="rounded-full border border-violet/20 bg-violet-soft/45 px-2.5 py-1 text-[0.64rem] font-bold text-violet">{item}</span>)}
      </div>
      <div className="my-3 h-px bg-line dark:bg-slate-700" />
      <div className="grid grid-cols-3 gap-2">
        {visual.checklist.map((item) => (
          <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[0.64rem] font-semibold leading-4 text-ink dark:text-slate-200">
            {item.complete ? <Check aria-hidden="true" className="mt-px size-3.5 shrink-0 text-success" /> : <Circle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-ink-muted" />}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchHealthVisual({ visual }: { visual: Extract<BenefitVisual, { kind: "search-health" }> }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="grid grid-cols-3 divide-x divide-line dark:divide-slate-700">
        <div className="pr-2">
          <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-ink-muted dark:text-slate-400">Response rate</p>
          <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-ink dark:text-white">{visual.responseRate}</p>
        </div>
        {visual.signals.map((signal, index) => (
          <div key={signal.label} className="px-2 last:pr-0">
            <p className="text-[0.56rem] font-bold leading-4 text-ink-muted dark:text-slate-400">{signal.label}</p>
            <p className={`mt-1 text-xl font-black ${index === 0 ? "text-warning" : "text-accent-strong"}`}>{signal.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-8 items-end gap-1.5" aria-hidden="true">
        {visual.movement.map((height, index) => <span key={`${height}-${index}`} className={`min-w-0 flex-1 rounded-t-sm ${index === visual.movement.length - 1 ? "bg-accent" : "bg-line-strong/70 dark:bg-slate-600"}`} style={{ height: `${height}%` }} />)}
      </div>
      <div className="mt-2.5 rounded-lg bg-accent-soft/55 px-3 py-2 text-[0.62rem] font-bold leading-4 text-accent-strong">Follow-up coverage is the clearest next improvement.</div>
    </div>
  );
}

function BenefitMicroVisual({ visual }: { visual: BenefitVisual }) {
  switch (visual.kind) {
    case "perspective":
      return <PerspectiveVisual visual={visual} />;
    case "attention":
      return <AttentionVisual visual={visual} />;
    case "preparation":
      return <PreparationVisual visual={visual} />;
    case "search-health":
      return <SearchHealthVisual visual={visual} />;
  }
}

export function BenefitPanel({ benefit }: { benefit: ProductBenefit }) {
  const titleId = `product-benefit-${benefit.id}-title`;

  return (
    <article className="flex h-full min-h-72 min-w-0 flex-col rounded-[1.4rem] border border-line bg-surface-raised p-5 dark:border-slate-800 dark:bg-slate-900/65 sm:p-6 lg:p-7" aria-labelledby={titleId} data-benefit-panel={benefit.id} data-landing-clip-check>
      <div className="max-w-xl">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-brand-700" data-benefit-category>{benefit.category}</p>
        <h3 id={titleId} className="mt-3 text-2xl font-black tracking-[-0.025em] text-slate-950 dark:text-white">{benefit.headline}</h3>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">{benefit.body}</p>
      </div>
      <div className="mt-5 rounded-2xl border border-line bg-surface-muted/65 p-3 dark:border-slate-800 dark:bg-slate-950/55 sm:p-4" data-benefit-visual={benefit.visual.kind} aria-hidden="true">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[0.58rem] font-black uppercase tracking-[0.11em] text-ink-muted dark:text-slate-400">Illustrative product view</span>
          <span className="size-1.5 rounded-full bg-accent" />
        </div>
        <BenefitMicroVisual visual={benefit.visual} />
      </div>
    </article>
  );
}
