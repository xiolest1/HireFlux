import { BriefcaseBusiness, CalendarCheck2, Check, ChevronRight, CircleCheckBig, Clock3, ListChecks, MessageSquareText, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "../../components/ui/motionHooks";
import { landingScrollChapters, landingStory, landingWorkspace, type LandingScrollChapter, type LandingWorkspaceStage } from "./landingStoryModel";
import {
  scrollChapterForProgress,
  scrollStoryAdaptedQuery,
  scrollStoryFullQuery,
  scrollStoryModeConfiguration,
  scrollStoryTimelineLabels,
  type ScrollStoryChoreographyMode,
} from "./scrollStoryConfig";

gsap.registerPlugin(ScrollTrigger);

const workspaceNavigation = [
  { stage: "applications", label: "Applications", icon: BriefcaseBusiness },
  { stage: "interviews", label: "Interviews", icon: CalendarCheck2 },
  { stage: "preparation", label: "Preparation", icon: ListChecks },
  { stage: "action-center", label: "Action Center", icon: Clock3 },
] as const;

const narrativeOutgoingProgress = 0.012;
const narrativeIncomingProgress = 0.012;
const narrativeOutgoingLead = 0.012;
const narrativeIncomingLead = 0.004;
const narrativeHandoffOffset = 4;
const actionEndpointHoldStart = 0.825;
const actionEndpointHoldDuration = 0.055;

function NorthstarMark({ compact = false }: { compact?: boolean }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-lg border border-violet/25 bg-violet-soft font-black tracking-[-0.04em] text-violet ${compact ? "size-7 text-[0.5rem]" : "size-9 text-[0.58rem]"}`} data-northstar-mark aria-hidden="true">NS</span>;
}

function OpportunityRows({ compact = false, supporting = false }: { compact?: boolean; supporting?: boolean }) {
  return <div className={compact ? "divide-y divide-line" : "mt-3 divide-y divide-line"}>
    {landingWorkspace.opportunities.map((opportunity, index) => <div key={opportunity.company} className={`flex min-w-0 items-center gap-3 ${compact ? "py-2" : "py-3"} ${index === 0 ? supporting ? "-mx-1 rounded-lg bg-violet-soft/25 px-1" : compact ? "-mx-1 rounded-lg bg-violet-soft/45 px-1 ring-1 ring-inset ring-violet/20" : "-mx-2 rounded-xl bg-violet-soft/60 px-2 shadow-sm ring-1 ring-inset ring-violet/25" : ""}`} data-workspace-opportunity={opportunity.company} data-workspace-opportunity-primary={index === 0 || undefined} data-northstar-identity={index === 0 ? "applications" : undefined} data-workspace-focus-primary={index === 0 && !supporting ? "applications" : undefined}>
      {index === 0 ? <NorthstarMark compact={compact} /> : <span className={`flex shrink-0 items-center justify-center rounded-lg font-black ${compact ? "size-7 text-[0.55rem]" : "size-9 text-[0.62rem]"} ${index === 1 ? "bg-surface-muted text-ink-muted" : "bg-accent-soft text-accent-strong"}`}>{opportunity.company.slice(0, 2).toUpperCase()}</span>}
      <div className="min-w-0 flex-1"><p className={`${compact ? "text-[0.62rem]" : index === 0 ? "text-sm" : "text-xs"} truncate ${index === 0 ? "font-black" : "font-extrabold"} text-ink dark:text-white`}>{opportunity.company}</p>{!compact ? <p className={`truncate text-[0.62rem] ${index === 0 ? "font-bold text-ink" : "font-semibold text-ink-muted"}`}>{opportunity.role}</p> : null}</div>
      <div className="shrink-0 text-right"><p className={`${compact ? "text-[0.54rem]" : index === 0 ? "text-[0.6rem]" : "text-[0.56rem]"} font-bold ${index === 0 ? "text-violet" : "text-ink-muted"}`}>{opportunity.status}</p>{!compact ? <p className={`mt-0.5 ${index === 0 ? "text-[0.55rem]" : "text-[0.52rem]"} text-ink-muted`}>{opportunity.next}</p> : null}</div>
    </div>)}
  </div>;
}

function WorkspaceNavigation() {
  return <nav className="border-r border-line bg-surface px-2 py-3 dark:bg-slate-950/45" aria-label="Product story navigation" data-workspace-navigation>
    <p className="px-2 text-[0.52rem] font-black uppercase tracking-[0.14em] text-ink-muted">Workspace</p>
    <ul className="mt-3 space-y-1">{workspaceNavigation.map(({ stage, label, icon: Icon }) => <li key={stage}><div className="relative flex items-center gap-2 rounded-lg px-2 py-2 text-[0.6rem] font-bold text-ink-muted" data-workspace-nav={stage}><span className="absolute inset-0 rounded-lg bg-accent-soft opacity-0" data-workspace-nav-active={stage} /><Icon className="relative size-3.5 shrink-0" /><span className="relative truncate">{label}</span></div></li>)}</ul>
  </nav>;
}

function InterviewSurface({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "flex min-w-0 items-center gap-3" : "grid h-full min-w-0 grid-rows-[auto_1fr]"} data-workspace-interview-content={!compact || undefined}>
    <div className={`flex min-w-0 items-center gap-3 ${compact ? "" : "border-b border-violet/15 bg-violet-soft/20 px-5 py-4"}`} data-northstar-identity="interviews"><NorthstarMark compact={compact} /><div className="min-w-0 flex-1"><p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-violet">Northstar Labs · Interview</p><p className={`truncate font-black text-ink dark:text-white ${compact ? "text-sm" : "text-base"}`}>Technical screen</p></div><p className="shrink-0 text-right text-[0.56rem] font-semibold leading-4 text-ink-muted">Sep 2<br />10:00 AM</p></div>
    {!compact ? <div className="grid min-h-0 grid-cols-[1.1fr_0.9fr] gap-5 p-5" data-workspace-interview-body><div className="min-w-0 border-r border-line pr-5" data-workspace-focus-primary="interviews"><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-violet">Conversation context</p><h4 className="mt-2 text-xl font-black tracking-tight text-ink dark:text-white" data-workspace-interview-title>Platform architecture and collaboration</h4><p className="mt-2 text-xs leading-5 text-ink-muted" data-workspace-interview-description>The referral source, role scope, and saved platform notes followed Northstar into this interview.</p><div className="mt-5 border-t border-line pt-4" data-workspace-interview-origin><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-ink-muted">From Applications</p><p className="mt-2 text-xs font-bold text-ink">Referral · Remote · $145k–$165k</p></div></div><div className="rounded-xl bg-surface-muted/45 p-4" data-workspace-interview-next-action data-workspace-focus-supporting="interviews"><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-ink-muted">Next preparation action</p><p className="mt-2 text-xs font-bold text-ink dark:text-white">{landingStory.preparation.remainingAction}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full w-2/3 rounded-full bg-violet" /></div><p className="mt-2 text-[0.58rem] font-semibold text-ink-muted">2 of 3 ready</p></div></div> : null}
  </div>;
}

function PreparationSurface() {
  return <div className="grid h-full min-w-0 grid-rows-[auto_1fr]" data-workspace-preparation-content>
    <div className="flex items-center justify-between gap-4 border-b border-violet/15 bg-violet-soft/15 px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-3" data-northstar-identity="preparation">
        <NorthstarMark />
        <div className="min-w-0">
          <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-violet">Preparation workspace</p>
          <p className="mt-1 truncate text-sm font-black text-ink dark:text-white">Technical screen · Northstar Labs</p>
        </div>
      </div>
      <div className="min-w-[7.25rem] shrink-0" data-workspace-preparation-readiness>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.54rem] font-black uppercase tracking-[0.1em] text-ink-muted">Readiness</span>
          <span className="text-[0.62rem] font-black text-warning">2 of 3</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full w-2/3 origin-left rounded-full bg-violet" data-workspace-preparation-readiness-bar />
        </div>
      </div>
    </div>
    <div className="grid min-h-0 grid-cols-[1.18fr_0.82fr] gap-0">
      <div className="min-w-0 bg-violet-soft/10 px-5 py-4" data-workspace-preparation-primary data-workspace-focus-primary="preparation">
        <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-violet">Focused checklist</p>
        <p className="mt-1.5 text-base font-black tracking-tight text-ink dark:text-white">Ready the technical-screen story</p>
        <div className="mt-3 divide-y divide-line text-[0.65rem] font-semibold text-ink-muted">
          <p className="flex items-center gap-2 py-2"><CircleCheckBig className="size-3.5 shrink-0 text-success" />Research Northstar and platform scope</p>
          <p className="flex items-center gap-2 py-2"><CircleCheckBig className="size-3.5 shrink-0 text-success" />Choose the collaboration evidence story</p>
          <p className="-mx-2 flex items-center gap-2 rounded-lg bg-warning-soft/65 px-2 py-2 font-bold text-ink"><Clock3 className="size-3.5 shrink-0 text-warning" />Write one more candidate question</p>
        </div>
      </div>
      <div className="min-w-0 border-l border-line bg-surface-muted/35 px-4 py-4" data-workspace-preparation-supporting data-workspace-focus-supporting="preparation">
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 shrink-0 text-ink-muted" />
          <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-ink-muted">Candidate question</p>
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-ink dark:text-white">How does the platform team measure adoption?</p>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-ink-muted">Inherited context</p>
          <p className="mt-1.5 text-[0.62rem] font-bold text-ink">Platform scope · Referral</p>
          <p className="mt-1 text-[0.6rem] leading-4 text-ink-muted">Company notes and interview focus remain attached.</p>
          <p className="mt-2 flex items-center gap-2 text-[0.6rem] font-bold text-success"><Check className="size-3.5 shrink-0" />Evidence story selected</p>
        </div>
      </div>
    </div>
  </div>;
}

function ActionCenterSurface({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <div className="divide-y divide-line">{landingWorkspace.priorities.map((priority, index) => <div key={priority.company} className={`flex min-w-0 items-start gap-3 py-2.5 ${index === 0 ? "-mx-1 rounded-lg bg-accent-soft/55 px-1 ring-1 ring-inset ring-accent/20" : ""}`} data-workspace-priority={priority.priority} data-northstar-identity={index === 0 ? "action-center" : undefined} data-workspace-focus-primary={index === 0 ? "action-center" : undefined}>{index === 0 ? <NorthstarMark compact /> : <span className={`mt-0.5 size-2.5 shrink-0 rounded-full ${index === 1 ? "bg-line-strong" : "bg-violet"}`} />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className={`${index === 0 ? "text-[0.58rem] font-bold text-ink-muted" : "text-[0.62rem] font-bold text-ink"} dark:text-white`}>{priority.company}</p><span className={`shrink-0 text-[0.52rem] font-black uppercase tracking-[0.08em] ${index === 0 ? "text-accent-strong" : "text-ink-muted"}`}>{priority.timing}</span></div><p className={`mt-0.5 ${index === 0 ? "text-[0.68rem] font-black text-ink" : "text-[0.56rem] font-semibold text-ink-muted"}`}>{priority.action}</p></div></div>)}</div>;
  }

  const [primaryPriority, ...supportingPriorities] = landingWorkspace.priorities;
  return <div className="grid h-full min-w-0 grid-rows-[auto_auto_1fr]" data-workspace-action-content>
    <div className="border-b border-line bg-surface-muted/35 px-5 py-3">
      <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-accent-strong">Action Center</p>
      <p className="mt-1 text-xs font-bold text-ink-muted">What deserves attention right now</p>
    </div>
    <div className="border-b border-accent/20 bg-accent-soft/50 px-5 py-3.5 shadow-sm ring-1 ring-inset ring-accent/20" data-workspace-priority={primaryPriority.priority} data-workspace-priority-primary data-northstar-identity="action-center" data-workspace-focus-primary="action-center">
      <div className="flex min-w-0 items-start gap-3">
        <NorthstarMark />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[0.54rem] font-black uppercase tracking-[0.1em] text-accent-strong">Do now</p><p className="mt-0.5 text-xs font-bold text-ink dark:text-white">{primaryPriority.company}</p></div>
            <span className="shrink-0 text-[0.58rem] font-black uppercase tracking-[0.08em] text-accent-strong">{primaryPriority.timing}</span>
          </div>
          <p className="mt-1 text-base font-black tracking-tight text-ink dark:text-white">{primaryPriority.action}</p>
          <p className="mt-1 flex items-center gap-1 text-[0.58rem] font-semibold text-ink-muted"><ChevronRight className="size-3" />{primaryPriority.provenance}</p>
        </div>
      </div>
    </div>
    <div className="min-h-0 divide-y divide-line px-5" data-workspace-priority-supporting data-workspace-focus-supporting="action-center">{supportingPriorities.map((priority, index) => <div key={priority.company} className="flex min-w-0 items-start gap-3 py-2.5" data-workspace-priority={priority.priority}><span className={`mt-1 size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-line-strong" : "bg-violet"}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-[0.68rem] font-bold text-ink dark:text-white">{priority.company}</p><span className="shrink-0 text-[0.54rem] font-black uppercase tracking-[0.08em] text-ink-muted">{priority.timing}</span></div><p className="mt-0.5 text-[0.65rem] font-semibold text-ink-muted">{priority.action}</p><p className="mt-0.5 flex items-center gap-1 text-[0.54rem] font-semibold text-ink-muted"><ChevronRight className="size-3" />{priority.provenance}</p></div></div>)}</div>
  </div>;
}

function ConnectedWorkspaceVisual() {
  return <div className="hf-connected-workspace relative h-[32rem] w-full min-w-0 overflow-hidden rounded-[1.6rem] border border-line-strong bg-surface-muted shadow-panel dark:border-slate-700 dark:bg-slate-950/70" data-connected-workspace data-workspace-shell data-landing-clip-check aria-hidden="true">
    <header className="flex h-12 items-center justify-between border-b border-line bg-surface-raised px-4 dark:bg-slate-900"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[0.55rem] font-black text-white">HF</span><span className="text-xs font-black text-ink dark:text-white">HireFlux</span></div><div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.58rem] font-semibold text-ink-muted"><Search className="size-3" />Search your workspace</div></header>
    <div className="grid h-[calc(100%-3rem)] grid-cols-[7.5rem_minmax(0,1fr)]" data-workspace-layout><WorkspaceNavigation /><div className="relative min-w-0 overflow-hidden p-4">
      <div className="absolute inset-x-4 top-3 flex items-end justify-between" data-workspace-heading><div><p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-ink-muted">Your search</p><p className="mt-0.5 text-base font-black text-ink dark:text-white">Connected workspace</p></div><span className="rounded-full border border-line bg-surface-raised px-2.5 py-1 text-[0.56rem] font-bold text-ink-muted">3 active</span></div>
      <section className="absolute inset-x-4 top-[4.1rem] h-[17.5rem] overflow-hidden rounded-2xl border border-line-strong bg-surface-raised px-5 py-4 dark:border-slate-700 dark:bg-slate-900" data-workspace-applications data-workspace-panel><div className="flex items-center justify-between gap-4"><div><p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-accent-strong">Applications workspace</p><p className="mt-1 text-sm font-black text-ink dark:text-white">Three opportunities moving at different speeds</p></div><span className="text-[0.58rem] font-bold text-ink-muted">Updated today</span></div><OpportunityRows /></section>
      <aside className="invisible absolute bottom-4 left-4 top-[4.1rem] z-20 w-[9.5rem] overflow-hidden rounded-2xl border border-line bg-surface-muted/80 p-3 dark:bg-slate-900" data-workspace-recent data-workspace-panel data-workspace-focus-supporting="interviews"><p className="text-[0.52rem] font-black uppercase tracking-[0.12em] text-ink-muted">Recent opportunities</p><OpportunityRows compact supporting /></aside>
      <div className="invisible absolute left-[10rem] top-[6.65rem] z-40 flex w-[3rem] items-center" data-workspace-handoff><span className="h-px flex-1 bg-violet opacity-60" data-workspace-handoff-line /><span className="size-2.5 shrink-0 rounded-full border-2 border-surface-raised bg-violet" data-workspace-handoff-node /></div>
      <section className="invisible absolute bottom-4 left-[11rem] right-4 top-[4.1rem] z-30 overflow-hidden rounded-2xl border border-violet/40 bg-surface-raised dark:bg-slate-900" data-workspace-interviews data-workspace-panel data-workspace-focus-primary="interviews"><InterviewSurface /></section>
      <section className="invisible absolute inset-x-4 top-[4.1rem] z-30 overflow-hidden rounded-2xl border border-line bg-surface-muted/80 dark:bg-slate-900" data-workspace-interview-context data-workspace-panel data-workspace-focus-supporting="preparation"><div className="px-4 py-3"><InterviewSurface compact /></div></section>
      <section className="invisible absolute inset-x-4 bottom-4 top-[8.6rem] z-40 overflow-hidden rounded-2xl border border-accent/35 bg-surface-raised dark:bg-slate-900" data-workspace-preparation data-workspace-panel data-workspace-focus-primary="preparation"><PreparationSurface /></section>
      <section className="invisible absolute inset-x-4 top-[4.1rem] z-30 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted/75 px-4 py-3 dark:bg-slate-900" data-workspace-history data-workspace-panel data-workspace-focus-supporting="action-center"><div className="flex min-w-0 items-center gap-2" data-workspace-history-origin><CircleCheckBig className="size-4 shrink-0 text-success" /><div className="min-w-0"><p className="truncate text-[0.62rem] font-black text-ink dark:text-white">Technical screen complete</p><p className="truncate text-[0.55rem] font-semibold text-ink-muted">Preparation retained · 3 readiness items</p></div></div><div className="flex shrink-0 items-center gap-1 text-[0.52rem] font-bold text-ink-muted"><ChevronRight className="size-3" /><span>Follow-up due today</span></div></section>
      <section className="invisible absolute inset-x-4 bottom-4 top-[8.6rem] z-40 overflow-hidden rounded-2xl border border-accent/45 bg-surface-raised dark:bg-slate-900" data-workspace-actions data-workspace-panel data-workspace-focus-primary="action-center"><ActionCenterSurface /></section>
    </div></div>
  </div>;
}

function StaticWorkspaceVisual({ stage }: { stage: LandingWorkspaceStage }) {
  return <div className="hf-static-workspace mt-5 min-w-0 overflow-hidden rounded-2xl border border-line-strong bg-surface-muted p-3 dark:border-slate-700 dark:bg-slate-950/70" data-scroll-static-stage={stage} aria-hidden="true"><div className="flex items-center justify-between border-b border-line pb-2"><span className="text-[0.58rem] font-black text-ink dark:text-white">HireFlux</span><span className="text-[0.52rem] font-bold text-accent-strong">{workspaceNavigation.find((item) => item.stage === stage)?.label}</span></div><div className="mt-2 rounded-xl bg-surface-raised px-3 dark:bg-slate-900">{stage === "applications" ? <OpportunityRows compact /> : null}{stage === "interviews" ? <div className="-mx-1 my-2 rounded-lg border border-violet/20 bg-violet-soft/20 p-2.5" data-workspace-focus-primary="interviews"><InterviewSurface compact /><p className="mt-3 border-t border-violet/15 pt-2 text-[0.58rem] font-semibold text-ink-muted">Application context retained</p></div> : null}{stage === "preparation" ? <div className="-mx-1 my-2 flex items-center gap-3 rounded-lg border border-violet/15 bg-violet-soft/15 p-2.5" data-northstar-identity="preparation" data-workspace-focus-primary="preparation"><NorthstarMark compact /><div className="min-w-0 flex-1"><p className="truncate text-[0.65rem] font-black text-ink dark:text-white">Technical screen · Northstar Labs</p><div className="mt-3 h-1.5 rounded-full bg-line"><div className="h-full w-2/3 rounded-full bg-violet" /></div><p className="mt-2 text-[0.58rem] font-semibold text-ink-muted">Company context and evidence ready · <span className="font-black text-warning">One question remaining</span></p></div></div> : null}{stage === "action-center" ? <ActionCenterSurface compact /> : null}</div></div>;
}

function ChapterCopy({ chapter, visual = false }: { chapter: LandingScrollChapter; visual?: boolean }) {
  return <div aria-hidden={visual || undefined} data-scroll-copy-content={visual || undefined}><p className="text-xs font-black uppercase tracking-[0.14em] text-accent-strong" data-scroll-copy-label={visual || undefined}>{chapter.number} · {chapter.label}</p><p className="mt-4 text-sm font-bold leading-6 text-ink-muted dark:text-slate-300" data-scroll-copy-question={visual || undefined}>{chapter.question}</p><h3 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white" data-scroll-copy-headline={visual || undefined}>{chapter.title}</h3><p className="mt-4 max-w-xl leading-7 text-ink-muted dark:text-slate-300" data-scroll-copy-body={visual || undefined}>{chapter.description}</p></div>;
}

export function ScrollProductStory() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeChapterRef = useRef<LandingWorkspaceStage>("applications");
  const [activeChapter, setActiveChapter] = useState<LandingWorkspaceStage>("applications");

  useLayoutEffect(() => {
    if (reducedMotion || !rootRef.current || !stageRef.current) return;
    const root = rootRef.current;
    const stage = stageRef.current;
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      let activeBranch: symbol | null = null;
      const createChoreography = (mode: ScrollStoryChoreographyMode) => {
        const branch = Symbol(mode);
        const configuration = scrollStoryModeConfiguration[mode];
        activeBranch = branch;
        root.dataset.scrollMode = mode;
        const selectChapter = (progress: number) => { const next = scrollChapterForProgress(progress); if (activeChapterRef.current !== next) { activeChapterRef.current = next; setActiveChapter(next); } };
        const timeline = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { trigger: stage, pin: stage, pinSpacing: true, start: "top top", end: () => `+=${Math.round(window.innerHeight * configuration.travelViewportHeights)}`, scrub: 0.35, anticipatePin: 1, invalidateOnRefresh: true } });
        timeline.eventCallback("onUpdate", () => selectChapter(timeline.progress()));
        timeline
          .addLabel("applications", scrollStoryTimelineLabels.applications)
          .set('[data-scroll-copy-stage]:not([data-scroll-copy-stage="applications"])', { autoAlpha: 0, y: narrativeHandoffOffset }, 0)
          .set("[data-workspace-panel]:not([data-workspace-applications])", { autoAlpha: 0 }, 0)
          .set("[data-workspace-handoff]", { autoAlpha: 0 }, 0)
          .set("[data-workspace-handoff-line]", { scaleX: 0, transformOrigin: "left center" }, 0)
          .set('[data-workspace-nav-active]:not([data-workspace-nav-active="applications"])', { opacity: 0 }, 0)
          .set("[data-workspace-applications]", { zIndex: 10 }, 0)
          .set("[data-workspace-shell]", { x: 0, y: 0, scale: 1, transformOrigin: "center center" }, 0)
          .fromTo("[data-workspace-applications]", { y: 8 }, { y: 0, duration: 0.12 }, 0)

          .addLabel("interviews", scrollStoryTimelineLabels.interviews)
          .to('[data-workspace-nav-active="applications"]', { opacity: 0, duration: 0.04 }, 0.205)
          .to('[data-workspace-nav-active="interviews"]', { opacity: 1, duration: 0.04 }, 0.225)
          .to("[data-workspace-applications]", { x: configuration.applicationCompressX, scaleX: 0.28, scaleY: 1.06, duration: 0.13, transformOrigin: "left top" }, 0.08)
          .to("[data-workspace-applications]", { autoAlpha: 0, duration: 0.04 }, 0.17)
          .set("[data-workspace-recent]", { zIndex: 20 }, 0.095)
          .set("[data-workspace-interviews]", { zIndex: 30, autoAlpha: 1 }, 0.15)
          .fromTo("[data-workspace-recent]", { x: configuration.recentEnterX, y: 5, scale: 0.92, autoAlpha: 0 }, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.12 }, 0.095)
          .fromTo("[data-workspace-handoff]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.12)
          .to("[data-workspace-handoff-line]", { scaleX: 1, duration: 0.17, ease: "power2.inOut" }, 0.12)
          .fromTo("[data-workspace-handoff-node]", { x: -8, scale: 0.72 }, { x: 0, scale: 1, duration: 0.17, ease: "power3.out" }, 0.13)
          .fromTo("[data-workspace-interviews]", { x: configuration.interviewEnterX, scaleX: 0.82, scaleY: 0.96 }, { x: 0, scaleX: 1, scaleY: 1, duration: 0.19, ease: "power3.out", transformOrigin: "right center" }, 0.15)
          .fromTo("[data-workspace-interview-content]", { y: 4, autoAlpha: 0.4 }, { y: 0, autoAlpha: 1, duration: 0.18, ease: "power3.out" }, 0.15)

          .addLabel("preparation", scrollStoryTimelineLabels.preparation)
          .to('[data-workspace-nav-active="interviews"]', { opacity: 0, duration: 0.04 }, 0.415)
          .to('[data-workspace-nav-active="preparation"]', { opacity: 1, duration: 0.05 }, 0.435)
          .to("[data-workspace-recent]", { x: -14, autoAlpha: 0, duration: 0.055 }, 0.375)
          .to("[data-workspace-handoff]", { autoAlpha: 0, duration: 0.055 }, 0.375)
          .to("[data-workspace-interviews]", { y: -10, scaleX: 0.9, scaleY: 0.74, autoAlpha: 0, duration: 0.07, ease: "power2.inOut", transformOrigin: "top center" }, 0.38)
          .set("[data-workspace-interview-context]", { zIndex: 30 }, 0.39)
          .set("[data-workspace-preparation]", { zIndex: 40 }, 0.41)
          .fromTo("[data-workspace-interview-context]", { y: 18, scaleX: 0.82, scaleY: 0.74, autoAlpha: 0 }, { y: 0, scaleX: 1, scaleY: 1, autoAlpha: 1, duration: 0.135, ease: "power3.out", transformOrigin: "top center" }, 0.39)
          .fromTo("[data-workspace-preparation]", { y: configuration.preparationEnterY, scaleX: 0.94, scaleY: 0.62, autoAlpha: 0, clipPath: "inset(18% 0% 0% 0% round 1rem)" }, { y: 0, scaleX: 1, scaleY: 1, autoAlpha: 1, clipPath: "inset(0% 0% 0% 0% round 1rem)", duration: 0.18, ease: "power3.out", transformOrigin: "top center" }, 0.41)
          .fromTo("[data-workspace-preparation-primary]", { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.12 }, 0.42)
          .fromTo("[data-workspace-preparation-supporting]", { x: 10, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.11 }, 0.44)
          .fromTo("[data-workspace-preparation-readiness]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.415)
          .fromTo("[data-workspace-preparation-readiness-bar]", { scaleX: 0.48 }, { scaleX: 1, duration: 0.13, ease: "power2.inOut", transformOrigin: "left center" }, 0.425)

          .addLabel("action-center", scrollStoryTimelineLabels.actionCenter)
          .to('[data-workspace-nav-active="preparation"]', { opacity: 0, duration: 0.04 }, 0.7)
          .to('[data-workspace-nav-active="action-center"]', { opacity: 1, duration: 0.05 }, 0.72)
          .to("[data-workspace-preparation-primary]", { y: -6, autoAlpha: 0, duration: 0.05 }, 0.66)
          .to("[data-workspace-preparation-supporting]", { x: -8, autoAlpha: 0, duration: 0.05 }, 0.665)
          .to("[data-workspace-preparation-readiness]", { autoAlpha: 0, duration: 0.05 }, 0.665)
          .to("[data-workspace-interview-context]", { y: -8, scaleX: 0.94, scaleY: 0.72, autoAlpha: 0, duration: 0.06, ease: "power2.inOut", transformOrigin: "top center" }, 0.655)
          .to("[data-workspace-preparation]", { y: -22, scaleX: 0.9, scaleY: 0.26, autoAlpha: 0, clipPath: "inset(0% 0% 70% 0% round 1rem)", duration: 0.06, ease: "power2.inOut", transformOrigin: "top center" }, 0.655)
          .set("[data-workspace-history]", { zIndex: 30 }, 0.655)
          .set("[data-workspace-actions]", { zIndex: 40, autoAlpha: 1 }, 0.67)
          .fromTo("[data-workspace-history]", { y: 10, scaleX: 0.9, autoAlpha: 0 }, { y: 0, scaleX: 1, autoAlpha: 1, duration: 0.11, ease: "power3.out", transformOrigin: "top center" }, 0.655)
          .fromTo("[data-workspace-actions]", { y: configuration.actionEnterY, scaleX: 0.94, scaleY: 0.78, clipPath: "inset(12% 0% 0% 0% round 1rem)" }, { y: 0, scaleX: 1, scaleY: 1, clipPath: "inset(0% 0% 0% 0% round 1rem)", duration: 0.135, ease: "power3.out", transformOrigin: "top center" }, 0.67)
          .fromTo("[data-workspace-action-content]", { y: 6, autoAlpha: 0.45 }, { y: 0, autoAlpha: 1, duration: 0.11, ease: "power3.out" }, 0.68)
          .fromTo("[data-workspace-priority-primary]", { y: 8 }, { y: 0, duration: 0.08 }, 0.7)
          .fromTo("[data-workspace-priority-supporting]", { y: 10 }, { y: 0, duration: 0.09 }, 0.735)
          .to("[data-workspace-actions]", { duration: actionEndpointHoldDuration }, actionEndpointHoldStart)
          .addLabel("settled", scrollStoryTimelineLabels.settled);
        const timelineDuration = timeline.duration();
        const addNarrativeHandoff = (outgoing: LandingWorkspaceStage, incoming: LandingWorkspaceStage, boundary: number) => {
          timeline
            .to(`[data-scroll-copy-stage="${outgoing}"]`, { autoAlpha: 0, y: -narrativeHandoffOffset, duration: timelineDuration * narrativeOutgoingProgress, ease: "power1.out" }, timelineDuration * (boundary - narrativeOutgoingLead))
            .to(`[data-scroll-copy-stage="${incoming}"]`, { autoAlpha: 1, y: 0, duration: timelineDuration * narrativeIncomingProgress, ease: "power2.out" }, timelineDuration * (boundary - narrativeIncomingLead));
        };
        addNarrativeHandoff("applications", "interviews", scrollStoryTimelineLabels.interviews);
        addNarrativeHandoff("interviews", "preparation", scrollStoryTimelineLabels.preparation);
        addNarrativeHandoff("preparation", "action-center", scrollStoryTimelineLabels.actionCenter);
        return () => {
          if (activeBranch === branch) {
            activeBranch = null;
            root.dataset.scrollMode = "static";
          }
          timeline.scrollTrigger?.kill();
          timeline.kill();
        };
      };
      media.add(
        { full: scrollStoryFullQuery, adapted: scrollStoryAdaptedQuery },
        (mediaContext) => {
          const conditions = mediaContext.conditions as { full?: boolean; adapted?: boolean };
          if (conditions.full) return createChoreography("full");
          if (conditions.adapted) return createChoreography("adapted");
        },
      );
    }, root);
    return () => { media.revert(); context.revert(); };
  }, [reducedMotion]);

  return <div ref={rootRef} className="hf-scroll-story mt-12 sm:mt-14 lg:mt-12" data-scroll-story data-scroll-mode="static" data-active-chapter={activeChapter} data-reduced-motion={reducedMotion}>
    <div className="hf-scroll-story-desktop" data-testid="desktop-product-story">
      <div ref={stageRef} className="hf-scroll-story-stage relative grid h-[min(43rem,100vh)] min-h-[40rem] grid-cols-[minmax(0,0.52fr)_minmax(0,1.18fr)] items-center gap-8 xl:grid-cols-[minmax(0,0.48fr)_minmax(0,1.22fr)] xl:gap-6" data-scroll-story-pin>
        <div className="relative min-h-[31rem] min-w-0">
          <ol className="sr-only">{landingScrollChapters.map((chapter) => <li key={chapter.stage}><ChapterCopy chapter={chapter} /></li>)}</ol>
          <div className="absolute inset-x-0 top-8" data-scroll-narrative>
            <div className="grid" data-scroll-copy-stack>{landingScrollChapters.map((chapter) => <div key={chapter.stage} className="invisible col-start-1 row-start-1" data-scroll-copy-stage={chapter.stage}><ChapterCopy chapter={chapter} visual /></div>)}</div>
            <ol className="mt-7 grid grid-cols-4 gap-2" data-scroll-progress aria-hidden="true">{landingScrollChapters.map((chapter) => <li key={chapter.stage} className={`h-1 rounded-full ${chapter.stage === activeChapter ? "bg-accent" : "bg-line-strong/60"}`} data-scroll-progress-segment={chapter.stage} data-active={chapter.stage === activeChapter || undefined} />)}</ol>
          </div>
        </div>
        <div className="relative flex h-[36rem] min-w-0 items-center overflow-hidden p-1" data-workspace-stage-envelope>
          <ConnectedWorkspaceVisual />
        </div>
      </div>
      <div className="hf-scroll-story-release-buffer" data-scroll-story-release-buffer aria-hidden="true" />
    </div>
    <ol className="hf-scroll-story-fallback grid gap-8 md:grid-cols-2" data-testid="mobile-product-story">{landingScrollChapters.map((chapter) => <li key={chapter.stage} className="min-w-0"><article className="h-full min-w-0 border-t border-line pt-6" data-scroll-fallback-chapter={chapter.stage} data-landing-clip-check><ChapterCopy chapter={chapter} /><StaticWorkspaceVisual stage={chapter.stage} /></article></li>)}</ol>
  </div>;
}
