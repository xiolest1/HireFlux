import { Check, CircleCheckBig, Clock3 } from "lucide-react";
import { landingScrollChapters, landingStory, landingWorkspace, type LandingWorkspaceStage } from "./landingStoryModel";
import { ConnectedNorthstarMark } from "./ConnectedStoryPrimitives";

function CompactApplicationsEndpoint() {
  return (
    <div className="hf-connected-compact-surface" data-connected-compact-product-surface="applications">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-2.5">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.11em] text-accent-strong">Applications</p>
          <p className="mt-1 text-sm font-black text-ink dark:text-white">Three opportunities in view</p>
        </div>
        <span className="shrink-0 text-[0.64rem] font-bold text-ink-muted">Updated today</span>
      </div>
      <div className="divide-y divide-line">
        {landingWorkspace.opportunities.map((opportunity, index) => (
          <div key={opportunity.company} className={`flex min-w-0 items-center gap-2.5 py-2.5 ${index === 0 ? "-mx-1 rounded-xl bg-violet-soft/45 px-2 ring-1 ring-inset ring-violet/20" : "px-1"}`}>
            {index === 0 ? <ConnectedNorthstarMark small /> : <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[0.58rem] font-black text-ink-muted">{opportunity.company.slice(0, 2).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-ink dark:text-white">{opportunity.company}</p>
              <p className="truncate text-[0.66rem] font-semibold text-ink-muted">{index === 0 ? landingStory.opportunity.role : opportunity.role}</p>
              {index === 0 ? <p className="mt-1 text-[0.64rem] font-bold text-violet">Referral · Remote</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.66rem] font-black text-ink-muted">{opportunity.status}</p>
              {index === 0 ? <p className="mt-0.5 text-[0.6rem] text-ink-muted">Screen · Sep 2</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactInterviewsEndpoint() {
  return (
    <div className="hf-connected-compact-surface" data-connected-compact-product-surface="interviews">
      <p className="hf-connected-compact-provenance">From Applications · Referral · Remote</p>
      <div className="mt-3 flex items-start gap-3 border-b border-line pb-3">
        <ConnectedNorthstarMark small />
        <div className="min-w-0 flex-1">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.1em] text-violet">Northstar Labs</p>
          <p className="mt-1 text-base font-black text-ink dark:text-white">Technical screen</p>
        </div>
        <p className="shrink-0 text-right text-[0.66rem] font-bold leading-4 text-ink-muted">Sep 2<br />10:00 AM</p>
      </div>
      <div className="mt-3 rounded-xl bg-surface-muted/55 p-3">
        <p className="text-[0.64rem] font-black uppercase tracking-[0.1em] text-accent-strong">Context carried forward</p>
        <p className="mt-1.5 text-sm font-bold text-ink dark:text-white">Platform architecture and collaboration</p>
        <p className="mt-1 text-[0.68rem] leading-4 text-ink-muted">Role scope and saved platform notes remain attached.</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-violet/20 px-3 py-2.5">
        <p className="text-[0.68rem] font-bold text-ink-muted">Next: {landingStory.preparation.remainingAction}</p>
        <span className="shrink-0 text-[0.64rem] font-black text-warning">2 of 3</span>
      </div>
    </div>
  );
}

function CompactPreparationEndpoint() {
  return (
    <div className="hf-connected-compact-surface" data-connected-compact-product-surface="preparation">
      <p className="hf-connected-compact-provenance">From Technical screen · Context retained</p>
      <div className="mt-3 flex items-center gap-3 border-b border-line pb-3">
        <ConnectedNorthstarMark small />
        <div className="min-w-0 flex-1">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.1em] text-violet">Preparation</p>
          <p className="mt-1 truncate text-sm font-black text-ink dark:text-white">Northstar technical screen</p>
        </div>
        <span className="shrink-0 text-[0.68rem] font-black text-warning">2 of 3 ready</span>
      </div>
      <div className="mt-2 divide-y divide-line text-[0.7rem] font-semibold text-ink-muted">
        <p className="flex items-center gap-2 py-2"><CircleCheckBig aria-hidden="true" className="size-3.5 shrink-0 text-success" />Research Northstar and platform scope</p>
        <p className="flex items-center gap-2 py-2"><CircleCheckBig aria-hidden="true" className="size-3.5 shrink-0 text-success" />Choose the collaboration evidence story</p>
        <p className="flex items-center gap-2 py-2 font-bold text-ink dark:text-white"><Clock3 aria-hidden="true" className="size-3.5 shrink-0 text-warning" />Write one more candidate question</p>
      </div>
      <div className="mt-2 rounded-xl bg-violet-soft/20 px-3 py-2.5">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-ink-muted">Candidate question</p>
        <p className="mt-1 text-[0.72rem] font-bold leading-4 text-ink dark:text-white">How does the platform team measure adoption?</p>
      </div>
    </div>
  );
}

function CompactActionEndpoint() {
  return (
    <div className="hf-connected-compact-surface" data-connected-compact-product-surface="action-center">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-accent/20 pb-2.5 text-[0.64rem] font-bold text-ink-muted">
        <span className="flex items-center gap-1.5"><CircleCheckBig aria-hidden="true" className="size-3.5 text-success" />Screen complete</span>
        <span className="flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5 text-success" />Preparation retained</span>
      </div>
      <div className="divide-y divide-line">
        {landingWorkspace.priorities.map((priority, index) => (
          <div key={priority.company} className={`flex min-w-0 items-start gap-2.5 py-2.5 ${index === 0 ? "-mx-1 rounded-xl bg-accent-soft/50 px-2 ring-1 ring-inset ring-accent/20" : "px-1"}`}>
            {index === 0 ? <ConnectedNorthstarMark small /> : <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${index === 1 ? "bg-line-strong" : "bg-violet"}`} />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-black text-ink dark:text-white">{priority.company}</p>
                <span className="shrink-0 text-[0.6rem] font-black uppercase tracking-[0.06em] text-ink-muted" data-connected-compact-priority={priority.timing}>{priority.timing}</span>
              </div>
              <p className="mt-1 text-[0.7rem] font-bold text-ink-muted">{priority.action}</p>
              {index === 0 ? <p className="mt-1 text-[0.62rem] font-semibold text-ink-muted">Interview complete · Preparation retained</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactEndpoint({ stage }: { stage: LandingWorkspaceStage }) {
  if (stage === "applications") return <CompactApplicationsEndpoint />;
  if (stage === "interviews") return <CompactInterviewsEndpoint />;
  if (stage === "preparation") return <CompactPreparationEndpoint />;
  return <CompactActionEndpoint />;
}

export function ConnectedStoryCCompactWorkspace({ activeChapter }: { activeChapter: LandingWorkspaceStage }) {
  const activeIndex = landingScrollChapters.findIndex((chapter) => chapter.stage === activeChapter);
  return (
    <div
      aria-hidden="true"
      className="hf-connected-c-compact-workspace"
      data-connected-c-compact-workspace
      data-connected-visual-chapter={activeChapter}
      inert
    >
      <div className="flex h-11 items-center justify-between border-b border-line bg-surface-raised px-3 dark:bg-slate-900">
        <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[0.58rem] font-black text-white dark:text-cyan-950">HF</span><span className="text-xs font-black text-ink dark:text-white">HireFlux</span></div>
        <span className="text-[0.64rem] font-bold text-ink-muted">Northstar journey</span>
      </div>
      <div className="border-b border-line bg-surface/55 px-3 py-2" data-connected-c-compact-progress>
        <div className="grid grid-cols-4 gap-2">
          {landingScrollChapters.map((chapter, index) => (
            <div key={chapter.stage} className="min-w-0" data-connected-c-compact-progress-item={chapter.stage} data-active={index === activeIndex || undefined}>
              <span className={`block h-1 rounded-full ${index <= activeIndex ? "bg-violet" : "bg-line-strong"}`} />
              <span className={`mt-1 block truncate text-[0.58rem] font-black uppercase tracking-[0.04em] ${index === activeIndex ? "text-violet" : "text-ink-muted"}`}>{chapter.label === "Action Center" ? "Action" : chapter.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden p-3" data-connected-c-compact-endpoint-viewport>
        {landingScrollChapters.map((chapter) => (
          <div
            key={chapter.stage}
            className="hf-connected-c-compact-endpoint absolute inset-3"
            data-connected-c-compact-endpoint={chapter.stage}
            data-active={chapter.stage === activeChapter || undefined}
          >
            <CompactEndpoint stage={chapter.stage} />
          </div>
        ))}
      </div>
    </div>
  );
}
