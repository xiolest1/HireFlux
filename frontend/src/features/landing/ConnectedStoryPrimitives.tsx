import { Check, ChevronRight, CircleCheckBig, Clock3 } from "lucide-react";
import {
  landingStory,
  landingWorkspace,
  type LandingScrollChapter,
  type LandingWorkspaceStage,
} from "./landingStoryModel";

export function ConnectedNorthstarMark({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg border border-violet/25 bg-violet-soft font-black tracking-[-0.04em] text-violet ${small ? "size-7 text-[0.5rem]" : "size-9 text-[0.58rem]"}`}
      data-northstar-mark
    >
      NS
    </span>
  );
}

export function ConnectedChapterNarrative({ chapter, visual = false }: {
  chapter: LandingScrollChapter;
  visual?: boolean;
}) {
  return (
    <div aria-hidden={visual || undefined} data-connected-chapter-copy={chapter.stage} data-scroll-copy-content={visual || undefined}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-accent-strong" data-scroll-copy-label={visual || undefined}>
        <span className="tabular-nums" data-scroll-copy-index={visual || undefined}>{chapter.number}</span>
        <span> · {chapter.label}</span>
      </p>
      <p className="mt-4 text-sm font-bold leading-6 text-ink-muted dark:text-slate-300" data-scroll-copy-question={visual || undefined}>{chapter.question}</p>
      <h3 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white" data-scroll-copy-headline={visual || undefined}>{chapter.title}</h3>
      <p className="mt-4 max-w-xl leading-7 text-ink-muted dark:text-slate-300" data-scroll-copy-body={visual || undefined}>{chapter.description}</p>
    </div>
  );
}

export function ConnectedLineage({ stage }: { stage: Exclude<LandingWorkspaceStage, "applications"> }) {
  const content = stage === "interviews"
    ? [landingStory.opportunity.company, landingStory.opportunity.source, landingStory.opportunity.workMode]
    : stage === "preparation"
      ? [landingStory.opportunity.company, "Technical screen", "Platform context retained"]
      : ["Technical screen complete", "Preparation retained", landingStory.action.status];
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-violet/40 bg-violet-soft/20 px-3 py-2 text-[0.68rem] font-bold text-ink-muted" data-connected-lineage={stage}>
      {content.map((item, index) => (
        <span key={item} className="flex min-w-0 items-center gap-2">
          {index > 0 ? <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-violet" /> : null}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

function ApplicationsSurface() {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface-raised p-4 dark:border-slate-700 dark:bg-slate-900" data-connected-product-surface="applications">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-accent-strong">Applications workspace</p><p className="mt-1 text-sm font-black text-ink dark:text-white">Three opportunities moving at different speeds</p></div>
        <span className="min-w-0 text-right text-[0.6rem] font-bold text-ink-muted">Updated today</span>
      </div>
      <div className="divide-y divide-line">
        {landingWorkspace.opportunities.map((opportunity, index) => (
          <div key={opportunity.company} className={`flex min-w-0 items-center gap-3 py-3 ${index === 0 ? "-mx-1 rounded-xl bg-violet-soft/45 px-2 ring-1 ring-inset ring-violet/20" : ""}`}>
            {index === 0 ? <ConnectedNorthstarMark small /> : <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[0.52rem] font-black text-ink-muted">{opportunity.company.slice(0, 2).toUpperCase()}</span>}
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-ink dark:text-white">{opportunity.company}</p><p className="truncate text-[0.62rem] font-semibold text-ink-muted">{opportunity.role}</p>{index === 0 ? <p className="mt-1 text-[0.58rem] font-bold text-violet">Referral · Remote · $145k–$165k</p> : null}</div>
            <div className="min-w-0 max-w-full shrink text-right"><p className="text-[0.58rem] font-bold text-ink-muted">{opportunity.status}</p><p className="mt-0.5 text-[0.52rem] text-ink-muted">{opportunity.next}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewSurface() {
  return (
    <div className="rounded-2xl border border-violet/30 bg-surface-raised p-4 dark:bg-slate-900" data-connected-product-surface="interviews">
      <div className="flex min-w-0 items-center gap-3 border-b border-violet/15 pb-3">
        <ConnectedNorthstarMark small />
        <div className="min-w-0 flex-1"><p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-violet">Northstar Labs · Interview</p><p className="mt-1 text-sm font-black text-ink dark:text-white">Technical screen</p></div>
        <p className="shrink-0 text-right text-[0.58rem] font-semibold leading-4 text-ink-muted">Sep 2<br />10:00 AM</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-violet">Conversation context</p><p className="mt-2 text-base font-black text-ink dark:text-white">Platform architecture and collaboration</p><p className="mt-2 text-xs leading-5 text-ink-muted">Referral, role scope, and saved platform notes remain attached.</p></div>
        <div className="rounded-xl bg-surface-muted/55 p-3"><p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-ink-muted">Next preparation action</p><p className="mt-2 text-xs font-bold text-ink dark:text-white">{landingStory.preparation.remainingAction}</p><p className="mt-3 text-[0.58rem] font-black text-warning">2 of 3 ready</p></div>
      </div>
    </div>
  );
}

function PreparationSurface() {
  return (
    <div className="rounded-2xl border border-accent/30 bg-surface-raised p-4 dark:bg-slate-900" data-connected-product-surface="preparation">
      <div className="flex min-w-0 items-center gap-3 border-b border-accent/15 pb-3">
        <ConnectedNorthstarMark small />
        <div className="min-w-0 flex-1"><p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-violet">Preparation workspace</p><p className="mt-1 truncate text-sm font-black text-ink dark:text-white">Technical screen · Northstar Labs</p></div>
        <span className="shrink-0 text-[0.62rem] font-black text-warning">2 of 3</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1.08fr_0.92fr]">
        <div><p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-accent-strong">Focused checklist</p><div className="mt-2 divide-y divide-line text-xs font-semibold text-ink-muted"><p className="flex items-center gap-2 py-2"><CircleCheckBig aria-hidden="true" className="size-3.5 text-success" />Research Northstar and platform scope</p><p className="flex items-center gap-2 py-2"><CircleCheckBig aria-hidden="true" className="size-3.5 text-success" />Choose the collaboration evidence story</p><p className="flex items-center gap-2 py-2 font-bold text-ink"><Clock3 aria-hidden="true" className="size-3.5 text-warning" />Write one more candidate question</p></div></div>
        <div className="rounded-xl bg-violet-soft/20 p-3"><p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-ink-muted">Candidate question</p><p className="mt-2 text-xs font-bold leading-5 text-ink dark:text-white">How does the platform team measure adoption?</p><p className="mt-3 border-t border-line pt-3 text-[0.58rem] font-semibold leading-4 text-ink-muted">Platform scope · Referral<br />Company notes and interview focus remain attached.</p></div>
      </div>
    </div>
  );
}

function ActionSurface({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-accent/35 bg-surface-raised p-4 dark:bg-slate-900" data-connected-product-surface="action-center">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-accent/20 pb-3 text-[0.6rem] font-bold text-ink-muted" data-workspace-action-rationale><span className="flex items-center gap-1.5"><CircleCheckBig aria-hidden="true" className="size-3.5 text-success" />Technical screen complete</span><span className="flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5 text-success" />Preparation retained</span></div>
      <div className="divide-y divide-line">
        {landingWorkspace.priorities.map((priority, index) => (
          <div key={priority.company} className={`flex min-w-0 items-start gap-3 py-3 ${index === 0 ? "-mx-1 rounded-xl bg-accent-soft/50 px-2 ring-1 ring-inset ring-accent/20" : ""}`}>
            {index === 0 ? <ConnectedNorthstarMark small /> : <span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${index === 1 ? "bg-line-strong" : "bg-violet"}`} />}
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><p className="text-xs font-black text-ink dark:text-white">{priority.company}</p><span className="min-w-0 max-w-full shrink text-[0.54rem] font-black uppercase tracking-[0.08em] text-ink-muted" data-workspace-action-urgency={index === 0 || undefined}>{priority.timing}</span></div><p className={`${compact ? "text-[0.62rem]" : "text-xs"} mt-1 font-bold text-ink-muted`} data-workspace-action-decision={index === 0 || undefined}>{priority.action}</p><p className="mt-1 text-[0.56rem] font-semibold text-ink-muted">{priority.provenance}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConnectedEndpointVisual({ stage }: { stage: LandingWorkspaceStage }) {
  if (stage === "applications") return <ApplicationsSurface />;
  if (stage === "interviews") return <InterviewSurface />;
  if (stage === "preparation") return <PreparationSurface />;
  return <ActionSurface />;
}

export function ConnectedProductChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-line-strong bg-surface-muted dark:border-slate-700 dark:bg-slate-950/70" data-connected-workspace-frame>
      <div className="flex h-12 items-center justify-between border-b border-line bg-surface-raised px-4 dark:bg-slate-900"><div className="flex items-center gap-2"><span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg bg-accent text-[0.55rem] font-black text-white dark:text-cyan-950">HF</span><span className="text-xs font-black text-ink dark:text-white">HireFlux</span></div><span className="text-[0.58rem] font-semibold text-ink-muted">Connected workspace</span></div>
      {children}
    </div>
  );
}
