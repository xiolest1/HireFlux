import { ArrowRight, BriefcaseBusiness, CalendarCheck2, Check, ChevronRight, CircleCheckBig, Clock3, ListChecks, MessageSquareText, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "../../components/ui/motionHooks";
import { landingScrollChapters, landingStory, landingWorkspace, type LandingScrollChapter, type LandingWorkspaceStage } from "./landingStoryModel";
import {
  scrollChapterForProgress,
  scrollStoryDesktopQuery,
  scrollStoryTimelineLabels,
  scrollStoryTravelViewportHeights,
} from "./scrollStoryConfig";

gsap.registerPlugin(ScrollTrigger);

const workspaceNavigation = [
  { stage: "applications", label: "Applications", icon: BriefcaseBusiness },
  { stage: "interviews", label: "Interviews", icon: CalendarCheck2 },
  { stage: "preparation", label: "Preparation", icon: ListChecks },
  { stage: "action-center", label: "Action Center", icon: Clock3 },
] as const;

interface ScrollProductStoryProps { ctaLabel: string; ctaDisabled?: boolean; onCta: () => void; }

function OpportunityRows({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "divide-y divide-line" : "mt-3 divide-y divide-line"}>
    {landingWorkspace.opportunities.map((opportunity, index) => <div key={opportunity.company} className={`flex min-w-0 items-center gap-3 ${compact ? "py-2" : "py-3"} ${!compact && index === 0 ? "-mx-2 rounded-xl bg-violet-soft/45 px-2" : ""}`} data-workspace-opportunity={opportunity.company} data-workspace-opportunity-primary={index === 0 || undefined}>
      <span className={`flex shrink-0 items-center justify-center rounded-lg font-black ${compact ? "size-7 text-[0.55rem]" : "size-9 text-[0.62rem]"} ${index === 0 ? "bg-violet-soft text-violet" : index === 1 ? "bg-surface-muted text-ink-muted" : "bg-accent-soft text-accent-strong"}`}>{opportunity.company.slice(0, 2).toUpperCase()}</span>
      <div className="min-w-0 flex-1"><p className={`${compact ? "text-[0.62rem]" : "text-xs"} truncate font-black text-ink dark:text-white`}>{opportunity.company}</p>{!compact ? <p className="truncate text-[0.62rem] font-semibold text-ink-muted">{opportunity.role}</p> : null}</div>
      <div className="shrink-0 text-right"><p className={`${compact ? "text-[0.54rem]" : "text-[0.6rem]"} font-bold ${index === 0 ? "text-violet" : "text-ink-muted"}`}>{opportunity.status}</p>{!compact ? <p className="mt-0.5 text-[0.55rem] text-ink-muted">{opportunity.next}</p> : null}</div>
    </div>)}
  </div>;
}

function WorkspaceNavigation() {
  return <nav className="border-r border-line bg-surface px-2 py-3 dark:bg-slate-950/45" aria-label="Product story navigation">
    <p className="px-2 text-[0.52rem] font-black uppercase tracking-[0.14em] text-ink-muted">Workspace</p>
    <ul className="mt-3 space-y-1">{workspaceNavigation.map(({ stage, label, icon: Icon }) => <li key={stage}><div className="relative flex items-center gap-2 rounded-lg px-2 py-2 text-[0.6rem] font-bold text-ink-muted" data-workspace-nav={stage}><span className="absolute inset-0 rounded-lg bg-accent-soft opacity-0" data-workspace-nav-active={stage} /><Icon className="relative size-3.5 shrink-0" /><span className="relative truncate">{label}</span></div></li>)}</ul>
  </nav>;
}

function InterviewSurface({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "flex min-w-0 items-center gap-3" : "grid h-full min-w-0 grid-rows-[auto_1fr]"} data-workspace-interview-content={!compact || undefined}>
    <div className={`flex min-w-0 items-center gap-3 ${compact ? "" : "border-b border-line px-5 py-4"}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet"><CalendarCheck2 className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-violet">Northstar Labs · Interview</p><p className="truncate text-sm font-black text-ink dark:text-white">Technical screen</p></div><p className="shrink-0 text-right text-[0.58rem] font-bold leading-4 text-ink-muted">Sep 2<br />10:00 AM</p></div>
    {!compact ? <div className="grid min-h-0 grid-cols-[1.1fr_0.9fr] gap-5 p-5"><div className="min-w-0"><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-ink-muted">Conversation context</p><h4 className="mt-2 text-lg font-black text-ink dark:text-white">Platform architecture and collaboration</h4><p className="mt-2 text-xs leading-5 text-ink-muted">The referral source, role scope, and saved platform notes followed Northstar into this interview.</p><div className="mt-5 border-t border-line pt-4"><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-ink-muted">From Applications</p><p className="mt-2 text-xs font-bold text-ink">Referral · Remote · $145k–$165k</p></div></div><div className="rounded-xl bg-surface-muted p-4"><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-accent-strong">Next preparation action</p><p className="mt-2 text-sm font-black text-ink dark:text-white">{landingStory.preparation.remainingAction}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full w-2/3 rounded-full bg-violet" /></div><p className="mt-2 text-[0.6rem] font-bold text-ink-muted">2 of 3 ready</p></div></div> : null}
  </div>;
}

function PreparationSurface() {
  return <div className="grid h-full min-w-0 grid-rows-[auto_1fr]" data-workspace-preparation-content>
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-violet">Preparation workspace</p>
        <p className="mt-1 truncate text-sm font-black text-ink dark:text-white">Technical screen · Northstar Labs</p>
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
      <div className="min-w-0 px-5 py-4" data-workspace-preparation-primary>
        <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-ink-muted">Focused checklist</p>
        <p className="mt-1.5 text-sm font-black text-ink dark:text-white">Ready the technical-screen story</p>
        <div className="mt-3 divide-y divide-line text-[0.65rem] font-semibold text-ink-muted">
          <p className="flex items-center gap-2 py-2"><CircleCheckBig className="size-3.5 shrink-0 text-success" />Research Northstar and platform scope</p>
          <p className="flex items-center gap-2 py-2"><CircleCheckBig className="size-3.5 shrink-0 text-success" />Choose the collaboration evidence story</p>
          <p className="flex items-center gap-2 py-2"><Clock3 className="size-3.5 shrink-0 text-warning" />Write one more candidate question</p>
        </div>
      </div>
      <div className="min-w-0 border-l border-line bg-surface-muted/55 px-4 py-4" data-workspace-preparation-supporting>
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 shrink-0 text-accent-strong" />
          <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-accent-strong">Candidate question</p>
        </div>
        <p className="mt-2 text-xs font-black leading-5 text-ink dark:text-white">How does the platform team measure adoption?</p>
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
    return <div className="divide-y divide-line">{landingWorkspace.priorities.map((priority, index) => <div key={priority.company} className="flex min-w-0 items-start gap-3 py-2.5" data-workspace-priority={priority.priority}><span className={`mt-0.5 size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-accent" : index === 1 ? "bg-line-strong" : "bg-violet"}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-[0.65rem] font-black text-ink dark:text-white">{priority.company}</p><span className={`shrink-0 text-[0.52rem] font-black uppercase tracking-[0.08em] ${index === 0 ? "text-accent-strong" : "text-ink-muted"}`}>{priority.timing}</span></div><p className="mt-0.5 text-[0.58rem] font-bold text-ink">{priority.action}</p></div></div>)}</div>;
  }

  const [primaryPriority, ...supportingPriorities] = landingWorkspace.priorities;
  return <div className="grid h-full min-w-0 grid-rows-[auto_auto_1fr]" data-workspace-action-content>
    <div className="border-b border-line px-5 py-3">
      <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-accent-strong">Action Center</p>
      <p className="mt-1 text-sm font-black text-ink dark:text-white">What deserves attention right now</p>
    </div>
    <div className="border-b border-line bg-accent-soft/20 px-5 py-3.5" data-workspace-priority={primaryPriority.priority} data-workspace-priority-primary>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 size-2.5 shrink-0 rounded-full bg-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[0.54rem] font-black uppercase tracking-[0.1em] text-accent-strong">Do now</p><p className="mt-0.5 text-sm font-black text-ink dark:text-white">{primaryPriority.company}</p></div>
            <span className="shrink-0 text-[0.58rem] font-black uppercase tracking-[0.08em] text-accent-strong">{primaryPriority.timing}</span>
          </div>
          <p className="mt-1 text-sm font-black text-ink">{primaryPriority.action}</p>
          <p className="mt-1 flex items-center gap-1 text-[0.58rem] font-semibold text-ink-muted"><ChevronRight className="size-3" />{primaryPriority.provenance}</p>
        </div>
      </div>
    </div>
    <div className="min-h-0 divide-y divide-line px-5" data-workspace-priority-supporting>{supportingPriorities.map((priority, index) => <div key={priority.company} className="flex min-w-0 items-start gap-3 py-2.5" data-workspace-priority={priority.priority}><span className={`mt-1 size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-line-strong" : "bg-violet"}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-xs font-black text-ink dark:text-white">{priority.company}</p><span className="shrink-0 text-[0.56rem] font-black uppercase tracking-[0.08em] text-ink-muted">{priority.timing}</span></div><p className="mt-0.5 text-xs font-bold text-ink">{priority.action}</p><p className="mt-0.5 flex items-center gap-1 text-[0.56rem] font-semibold text-ink-muted"><ChevronRight className="size-3" />{priority.provenance}</p></div></div>)}</div>
  </div>;
}

function ConnectedWorkspaceVisual() {
  return <div className="hf-connected-workspace relative h-[32rem] min-w-0 overflow-hidden rounded-[1.6rem] border border-line-strong bg-surface-muted shadow-panel dark:border-slate-700 dark:bg-slate-950/70" data-connected-workspace data-workspace-shell data-landing-clip-check aria-hidden="true">
    <header className="flex h-12 items-center justify-between border-b border-line bg-surface-raised px-4 dark:bg-slate-900"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[0.55rem] font-black text-white">HF</span><span className="text-xs font-black text-ink dark:text-white">HireFlux</span></div><div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.58rem] font-semibold text-ink-muted"><Search className="size-3" />Search your workspace</div></header>
    <div className="grid h-[calc(100%-3rem)] grid-cols-[7.5rem_minmax(0,1fr)]"><WorkspaceNavigation /><div className="relative min-w-0 overflow-hidden p-4">
      <div className="absolute inset-x-4 top-3 flex items-end justify-between" data-workspace-heading><div><p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-ink-muted">Your search</p><p className="mt-0.5 text-base font-black text-ink dark:text-white">Connected workspace</p></div><span className="rounded-full border border-line bg-surface-raised px-2.5 py-1 text-[0.56rem] font-bold text-ink-muted">3 active</span></div>
      <section className="absolute inset-x-4 top-[4.1rem] h-[17.5rem] overflow-hidden rounded-2xl border border-line-strong bg-surface-raised px-5 py-4 dark:border-slate-700 dark:bg-slate-900" data-workspace-applications data-workspace-panel><div className="flex items-center justify-between gap-4"><div><p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-accent-strong">Applications workspace</p><p className="mt-1 text-sm font-black text-ink dark:text-white">Three opportunities moving at different speeds</p></div><span className="text-[0.58rem] font-bold text-ink-muted">Updated today</span></div><OpportunityRows /></section>
      <aside className="invisible absolute bottom-4 left-4 top-[4.1rem] z-20 w-[9.5rem] overflow-hidden rounded-2xl border border-line bg-surface-raised p-3 dark:bg-slate-900" data-workspace-recent data-workspace-panel><p className="text-[0.52rem] font-black uppercase tracking-[0.12em] text-ink-muted">Recent opportunities</p><OpportunityRows compact /></aside>
      <div className="invisible absolute left-[10rem] top-[6.65rem] z-40 flex w-[3rem] items-center" data-workspace-handoff><span className="h-px flex-1 bg-violet opacity-60" data-workspace-handoff-line /><span className="size-2.5 shrink-0 rounded-full border-2 border-surface-raised bg-violet" data-workspace-handoff-node /></div>
      <section className="invisible absolute bottom-4 left-[11rem] right-4 top-[4.1rem] z-30 overflow-hidden rounded-2xl border border-violet/30 bg-surface-raised dark:bg-slate-900" data-workspace-interviews data-workspace-panel><InterviewSurface /></section>
      <section className="invisible absolute inset-x-4 top-[4.1rem] z-30 overflow-hidden rounded-2xl border border-violet/30 bg-surface-raised dark:bg-slate-900" data-workspace-interview-context data-workspace-panel><div className="px-4 py-3"><InterviewSurface compact /></div></section>
      <section className="invisible absolute inset-x-4 bottom-4 top-[8.6rem] z-40 overflow-hidden rounded-2xl border border-accent/30 bg-surface-raised dark:bg-slate-900" data-workspace-preparation data-workspace-panel><PreparationSurface /></section>
      <section className="invisible absolute inset-x-4 top-[4.1rem] z-30 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 dark:bg-slate-900" data-workspace-history data-workspace-panel><div className="flex min-w-0 items-center gap-2" data-workspace-history-origin><CircleCheckBig className="size-4 shrink-0 text-success" /><div className="min-w-0"><p className="truncate text-[0.62rem] font-black text-ink dark:text-white">Technical screen complete</p><p className="truncate text-[0.55rem] font-semibold text-ink-muted">Preparation retained · 3 readiness items</p></div></div><div className="flex shrink-0 items-center gap-1 text-[0.54rem] font-bold text-accent-strong"><ChevronRight className="size-3" /><span>Follow-up due today</span></div></section>
      <section className="invisible absolute inset-x-4 bottom-4 top-[8.6rem] z-40 overflow-hidden rounded-2xl border border-accent/35 bg-surface-raised dark:bg-slate-900" data-workspace-actions data-workspace-panel><ActionCenterSurface /></section>
    </div></div>
  </div>;
}

function StaticWorkspaceVisual({ stage }: { stage: LandingWorkspaceStage }) {
  return <div className="hf-static-workspace mt-5 min-w-0 overflow-hidden rounded-2xl border border-line-strong bg-surface-muted p-3 dark:border-slate-700 dark:bg-slate-950/70" data-scroll-static-stage={stage} aria-hidden="true"><div className="flex items-center justify-between border-b border-line pb-2"><span className="text-[0.58rem] font-black text-ink dark:text-white">HireFlux</span><span className="text-[0.52rem] font-bold text-accent-strong">{workspaceNavigation.find((item) => item.stage === stage)?.label}</span></div><div className="mt-2 rounded-xl bg-surface-raised px-3 dark:bg-slate-900">{stage === "applications" ? <OpportunityRows compact /> : null}{stage === "interviews" ? <div className="py-3"><InterviewSurface compact /><p className="mt-3 border-t border-line pt-2 text-[0.58rem] font-semibold text-ink-muted">Application context retained</p></div> : null}{stage === "preparation" ? <div className="py-3"><p className="text-[0.6rem] font-black text-ink dark:text-white">Technical screen · Northstar Labs</p><div className="mt-3 h-1.5 rounded-full bg-line"><div className="h-full w-2/3 rounded-full bg-violet" /></div><p className="mt-2 text-[0.58rem] font-bold text-ink-muted">Company context and evidence ready · One question remaining</p></div> : null}{stage === "action-center" ? <ActionCenterSurface compact /> : null}</div></div>;
}

function ChapterCopy({ chapter, visual = false }: { chapter: LandingScrollChapter; visual?: boolean }) {
  return <div aria-hidden={visual || undefined}><p className="text-xs font-black uppercase tracking-[0.14em] text-accent-strong">{chapter.number} · {chapter.label}</p><p className="mt-4 text-sm font-bold leading-6 text-ink-muted dark:text-slate-300">{chapter.question}</p><h3 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">{chapter.title}</h3><p className="mt-4 max-w-xl leading-7 text-ink-muted dark:text-slate-300">{chapter.description}</p></div>;
}

export function ScrollProductStory({ ctaLabel, ctaDisabled = false, onCta }: ScrollProductStoryProps) {
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
      media.add(scrollStoryDesktopQuery, () => {
        const selectChapter = (progress: number) => { const next = scrollChapterForProgress(progress); if (activeChapterRef.current !== next) { activeChapterRef.current = next; setActiveChapter(next); } };
        // E1 moves through a 44–60px viewport relationship change while the
        // Applications surface physically compresses into supporting context.
        const interviewShift = () => Math.min(46, Math.max(30, window.innerWidth * 0.04));
        const preparationShift = () => interviewShift() + Math.min(14, Math.max(10, window.innerWidth * 0.01));
        const actionShift = () => Math.min(22, Math.max(16, window.innerWidth * 0.015));
        const timeline = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { trigger: stage, pin: stage, pinSpacing: true, start: "top top", end: () => `+=${Math.round(window.innerHeight * scrollStoryTravelViewportHeights)}`, scrub: 0.35, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: (self) => selectChapter(self.progress) } });
        timeline
          .addLabel("applications", scrollStoryTimelineLabels.applications)
          .set('[data-scroll-copy-stage]:not([data-scroll-copy-stage="applications"])', { autoAlpha: 0 }, 0)
          .set("[data-workspace-panel]:not([data-workspace-applications])", { autoAlpha: 0 }, 0)
          .set("[data-workspace-handoff]", { autoAlpha: 0 }, 0)
          .set("[data-workspace-handoff-line]", { scaleX: 0, transformOrigin: "left center" }, 0)
          .set('[data-workspace-nav-active]:not([data-workspace-nav-active="applications"])', { opacity: 0 }, 0)
          .set("[data-workspace-applications]", { zIndex: 10 }, 0)
          .set("[data-workspace-shell]", { x: 14, y: 8, scale: 0.975, transformOrigin: "center center" }, 0)
          .fromTo("[data-workspace-applications]", { y: 8 }, { y: 0, duration: 0.12 }, 0)

          .addLabel("interviews", scrollStoryTimelineLabels.interviews)
          .set('[data-scroll-copy-stage="applications"]', { autoAlpha: 0, y: -7 }, 0.226)
          .set('[data-scroll-copy-stage="interviews"]', { autoAlpha: 1, y: 0 }, 0.226)
          .to('[data-workspace-nav-active="applications"]', { opacity: 0, duration: 0.04 }, 0.205)
          .to('[data-workspace-nav-active="interviews"]', { opacity: 1, duration: 0.04 }, 0.225)
          .to("[data-workspace-shell]", { x: () => -interviewShift(), y: 0, scale: 1.035, duration: 0.3, transformOrigin: "center center" }, 0.1)
          .to("[data-workspace-applications]", { x: -10, scaleX: 0.28, scaleY: 1.06, duration: 0.13, transformOrigin: "left top" }, 0.08)
          .to("[data-workspace-applications]", { autoAlpha: 0, duration: 0.04 }, 0.17)
          .set("[data-workspace-recent]", { zIndex: 20 }, 0.095)
          .set("[data-workspace-interviews]", { zIndex: 30, autoAlpha: 1 }, 0.15)
          .fromTo("[data-workspace-recent]", { x: -18, y: 5, scale: 0.92, autoAlpha: 0 }, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.12 }, 0.095)
          .fromTo("[data-workspace-handoff]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.12)
          .to("[data-workspace-handoff-line]", { scaleX: 1, duration: 0.17, ease: "power2.inOut" }, 0.12)
          .fromTo("[data-workspace-handoff-node]", { x: -8, scale: 0.72 }, { x: 0, scale: 1, duration: 0.17, ease: "power3.out" }, 0.13)
          .fromTo("[data-workspace-interviews]", { x: 48, scaleX: 0.82, scaleY: 0.96 }, { x: 0, scaleX: 1, scaleY: 1, duration: 0.19, ease: "power3.out", transformOrigin: "right center" }, 0.15)
          .fromTo("[data-workspace-interview-content]", { y: 4, autoAlpha: 0.4 }, { y: 0, autoAlpha: 1, duration: 0.18, ease: "power3.out" }, 0.15)

          .addLabel("preparation", scrollStoryTimelineLabels.preparation)
          .set('[data-scroll-copy-stage="interviews"]', { autoAlpha: 0, y: -7 }, 0.432)
          .set('[data-scroll-copy-stage="preparation"]', { autoAlpha: 1, y: 0 }, 0.432)
          .to('[data-workspace-nav-active="interviews"]', { opacity: 0, duration: 0.04 }, 0.415)
          .to('[data-workspace-nav-active="preparation"]', { opacity: 1, duration: 0.05 }, 0.435)
          .to("[data-workspace-shell]", { x: () => -preparationShift(), y: -6, scale: 1.065, duration: 0.24, ease: "power2.inOut", transformOrigin: "center center" }, 0.37)
          .to("[data-workspace-recent]", { x: -14, autoAlpha: 0, duration: 0.055 }, 0.375)
          .to("[data-workspace-handoff]", { autoAlpha: 0, duration: 0.055 }, 0.375)
          .to("[data-workspace-interviews]", { y: -10, scaleX: 0.9, scaleY: 0.74, autoAlpha: 0, duration: 0.07, ease: "power2.inOut", transformOrigin: "top center" }, 0.38)
          .set("[data-workspace-interview-context]", { zIndex: 30 }, 0.39)
          .set("[data-workspace-preparation]", { zIndex: 40 }, 0.41)
          .fromTo("[data-workspace-interview-context]", { y: 18, scaleX: 0.82, scaleY: 0.74, autoAlpha: 0 }, { y: 0, scaleX: 1, scaleY: 1, autoAlpha: 1, duration: 0.135, ease: "power3.out", transformOrigin: "top center" }, 0.39)
          .fromTo("[data-workspace-preparation]", { y: 30, scaleX: 0.94, scaleY: 0.62, autoAlpha: 0, clipPath: "inset(18% 0% 0% 0% round 1rem)" }, { y: 0, scaleX: 1, scaleY: 1, autoAlpha: 1, clipPath: "inset(0% 0% 0% 0% round 1rem)", duration: 0.18, ease: "power3.out", transformOrigin: "top center" }, 0.41)
          .fromTo("[data-workspace-preparation-primary]", { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.12 }, 0.42)
          .fromTo("[data-workspace-preparation-supporting]", { x: 10, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.11 }, 0.44)
          .fromTo("[data-workspace-preparation-readiness]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.415)
          .fromTo("[data-workspace-preparation-readiness-bar]", { scaleX: 0.48 }, { scaleX: 1, duration: 0.13, ease: "power2.inOut", transformOrigin: "left center" }, 0.425)

          .addLabel("action-center", scrollStoryTimelineLabels.actionCenter)
          .set('[data-scroll-copy-stage="preparation"]', { autoAlpha: 0, y: -7 }, 0.714)
          .set('[data-scroll-copy-stage="action-center"]', { autoAlpha: 1, y: 0 }, 0.714)
          .to('[data-workspace-nav-active="preparation"]', { opacity: 0, duration: 0.04 }, 0.7)
          .to('[data-workspace-nav-active="action-center"]', { opacity: 1, duration: 0.05 }, 0.72)
          .to("[data-workspace-shell]", { x: () => -actionShift(), y: 2, scale: 1.01, duration: 0.17, ease: "power2.inOut", transformOrigin: "center center" }, 0.69)
          .to("[data-workspace-preparation-primary]", { y: -6, autoAlpha: 0, duration: 0.05 }, 0.66)
          .to("[data-workspace-preparation-supporting]", { x: -8, autoAlpha: 0, duration: 0.05 }, 0.665)
          .to("[data-workspace-preparation-readiness]", { autoAlpha: 0, duration: 0.05 }, 0.665)
          .to("[data-workspace-interview-context]", { y: -8, scaleX: 0.94, scaleY: 0.72, autoAlpha: 0, duration: 0.06, ease: "power2.inOut", transformOrigin: "top center" }, 0.655)
          .to("[data-workspace-preparation]", { y: -22, scaleX: 0.9, scaleY: 0.26, autoAlpha: 0, clipPath: "inset(0% 0% 70% 0% round 1rem)", duration: 0.06, ease: "power2.inOut", transformOrigin: "top center" }, 0.655)
          .set("[data-workspace-history]", { zIndex: 30 }, 0.655)
          .set("[data-workspace-actions]", { zIndex: 40, autoAlpha: 1 }, 0.67)
          .fromTo("[data-workspace-history]", { y: 10, scaleX: 0.9, autoAlpha: 0 }, { y: 0, scaleX: 1, autoAlpha: 1, duration: 0.11, ease: "power3.out", transformOrigin: "top center" }, 0.655)
          .fromTo("[data-workspace-actions]", { y: 12, scaleX: 0.94, scaleY: 0.78, clipPath: "inset(12% 0% 0% 0% round 1rem)" }, { y: 0, scaleX: 1, scaleY: 1, clipPath: "inset(0% 0% 0% 0% round 1rem)", duration: 0.135, ease: "power3.out", transformOrigin: "top center" }, 0.67)
          .fromTo("[data-workspace-action-content]", { y: 6, autoAlpha: 0.45 }, { y: 0, autoAlpha: 1, duration: 0.11, ease: "power3.out" }, 0.68)
          .fromTo("[data-workspace-priority-primary]", { y: 8 }, { y: 0, duration: 0.08 }, 0.7)
          .fromTo("[data-workspace-priority-supporting]", { y: 10 }, { y: 0, duration: 0.09 }, 0.735)
          .fromTo("[data-workspace-story-cta]", { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.08 }, 0.8)
          .addLabel("settled", scrollStoryTimelineLabels.settled);
        return () => { timeline.scrollTrigger?.kill(); timeline.kill(); };
      });
    }, root);
    return () => { media.revert(); context.revert(); };
  }, [reducedMotion]);

  return <div ref={rootRef} className="hf-scroll-story mt-12 sm:mt-14 lg:mt-12" data-scroll-story data-active-chapter={activeChapter} data-reduced-motion={reducedMotion}>
    <div className="hf-scroll-story-desktop" data-testid="desktop-product-story">
      <div ref={stageRef} className="hf-scroll-story-stage relative grid h-[min(43rem,100vh)] min-h-[40rem] grid-cols-[minmax(0,0.52fr)_minmax(0,1.18fr)] items-center gap-8 xl:grid-cols-[minmax(0,0.48fr)_minmax(0,1.22fr)] xl:gap-6" data-scroll-story-pin>
        <div className="relative min-h-[31rem] min-w-0">
          <ol className="sr-only">{landingScrollChapters.map((chapter) => <li key={chapter.stage}><ChapterCopy chapter={chapter} /></li>)}</ol>
          <div className="absolute inset-x-0 top-8" data-scroll-narrative>
            <div className="grid" data-scroll-copy-stack>{landingScrollChapters.map((chapter) => <div key={chapter.stage} className="invisible col-start-1 row-start-1" data-scroll-copy-stage={chapter.stage}><ChapterCopy chapter={chapter} visual /></div>)}</div>
            <ol className="mt-7 grid grid-cols-4 gap-2" data-scroll-progress aria-hidden="true">{landingScrollChapters.map((chapter) => <li key={chapter.stage} className={`h-1 rounded-full transition-colors ${chapter.stage === activeChapter ? "bg-accent" : "bg-line-strong/60"}`} />)}</ol>
            <div className="invisible mt-5" data-workspace-story-cta><p className="mb-3 text-xs font-semibold leading-5 text-ink-muted">Your next move is already in view.</p><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60" disabled={ctaDisabled} onClick={onCta}>{ctaLabel}<ArrowRight className="size-4" /></button></div>
          </div>
        </div>
        <ConnectedWorkspaceVisual />
      </div>
      <div className="hf-scroll-story-release-buffer" data-scroll-story-release-buffer aria-hidden="true" />
    </div>
    <ol className="hf-scroll-story-fallback grid gap-8 md:grid-cols-2" data-testid="mobile-product-story">{landingScrollChapters.map((chapter) => <li key={chapter.stage} className="min-w-0"><article className="h-full min-w-0 border-t border-line pt-6" data-scroll-fallback-chapter={chapter.stage} data-landing-clip-check><ChapterCopy chapter={chapter} /><StaticWorkspaceVisual stage={chapter.stage} />{chapter.stage === "action-center" ? <button type="button" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60" disabled={ctaDisabled} onClick={onCta}>{ctaLabel}<ArrowRight className="size-4" /></button> : null}</article></li>)}</ol>
  </div>;
}
