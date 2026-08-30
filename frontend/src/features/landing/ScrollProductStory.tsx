import {
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  CircleCheckBig,
  Clock3,
  Sparkles,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "../../components/ui/motionHooks";
import { FluxRail } from "./FluxRail";
import {
  landingScrollChapters,
  landingStory,
  type LandingHeroStage,
  type LandingScrollChapter,
} from "./landingStoryModel";
import {
  scrollChapterForProgress,
  scrollStoryDesktopQuery,
  scrollStoryTimelineLabels,
} from "./scrollStoryConfig";

gsap.registerPlugin(ScrollTrigger);

const endpointCopy: Record<LandingHeroStage, { eyebrow: string; title: string; detail: string }> = {
  capture: {
    eyebrow: "Opportunity organized",
    title: "One reliable record",
    detail: `${landingStory.opportunity.source} · ${landingStory.opportunity.workMode} · ${landingStory.opportunity.compensation}`,
  },
  progress: {
    eyebrow: "Interview created",
    title: landingStory.interview.title,
    detail: landingStory.interview.dateLabel,
  },
  prepare: {
    eyebrow: "Interview preparation",
    title: `${landingStory.preparation.readyCount} of ${landingStory.preparation.totalCount} ready`,
    detail: landingStory.preparation.remainingAction,
  },
  act: {
    eyebrow: `Action Center · ${landingStory.action.status}`,
    title: landingStory.action.nextAction,
    detail: "Interview complete · Preparation retained",
  },
};

function OpportunityIdentity() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-950">
        <BriefcaseBusiness className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{landingStory.opportunity.company}</p>
        <p className="truncate text-xs font-black text-ink sm:text-sm dark:text-white">{landingStory.opportunity.role}</p>
      </div>
    </div>
  );
}

function ScrollProductVisual() {
  return (
    <div
      className="hf-scroll-product-visual relative h-[36rem] min-w-0 overflow-hidden rounded-[1.75rem] border border-line-strong bg-surface-muted p-4 shadow-panel dark:border-slate-700 dark:bg-slate-950/70"
      data-scroll-product-visual
      data-landing-clip-check
      aria-hidden="true"
    >
      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-2 text-[0.62rem] font-bold text-ink-muted shadow-sm" data-scroll-incoming>
        <Sparkles className="size-3.5 text-accent" />Referral opportunity
      </div>

      <section className="absolute inset-x-4 top-4 z-20 rounded-2xl border border-line-strong bg-surface-raised p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900" data-scroll-application data-scroll-story-panel data-persistent-scroll-opportunity>
        <div className="flex items-start justify-between gap-3">
          <OpportunityIdentity />
          <div className="relative shrink-0">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.58rem] font-bold text-accent-strong" data-scroll-capture-status>Organized</span>
            <span className="invisible absolute right-0 top-0 rounded-full bg-violet-soft px-2.5 py-1 text-[0.58rem] font-bold text-violet" data-scroll-progress-status>Interview</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] font-semibold text-ink-muted" data-scroll-metadata>
          <span>{landingStory.opportunity.source}</span><span>·</span><span>{landingStory.opportunity.workMode}</span><span>·</span><span>{landingStory.opportunity.compensation}</span>
        </div>
      </section>

      <section className="invisible absolute inset-x-7 top-[6.7rem] z-10 grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface-raised/95 p-2.5 shadow-sm dark:bg-slate-900/95" data-scroll-context data-scroll-story-panel>
        <div className="rounded-lg bg-surface-muted px-2 py-2" data-scroll-context-item><p className="text-[0.48rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Location</p><p className="truncate text-[0.62rem] font-bold text-ink">{landingStory.opportunity.location}</p></div>
        <div className="rounded-lg bg-surface-muted px-2 py-2" data-scroll-context-item><p className="text-[0.48rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Follow-up</p><p className="truncate text-[0.62rem] font-bold text-ink">September 5</p></div>
        <div className="rounded-lg bg-surface-muted px-2 py-2" data-scroll-context-item><p className="text-[0.48rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Decision</p><p className="truncate text-[0.62rem] font-bold text-ink">Platform scope</p></div>
      </section>

      <FluxRail />

      <div className="absolute inset-x-6 top-[15.75rem] z-20">
        <section className="invisible rounded-2xl border border-accent/35 bg-surface-raised p-3.5 shadow-sm dark:bg-slate-900" data-scroll-interview data-scroll-story-panel>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong"><CalendarCheck2 className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-accent-strong">Interview created</p><p className="truncate text-xs font-black text-ink dark:text-white">{landingStory.interview.title}</p></div>
            <span className="max-w-24 text-right text-[0.55rem] font-bold leading-3 text-ink-muted">{landingStory.interview.dateLabel}</span>
          </div>
        </section>

        <section className="invisible mt-3 rounded-2xl border border-violet/30 bg-surface-raised p-3.5 shadow-sm dark:bg-slate-900" data-scroll-preparation data-scroll-story-panel>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-violet">Preparation workspace</p><p className="mt-1 text-xs font-black text-ink dark:text-white">Turn interview context into a plan</p></div>
            <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[0.58rem] font-bold text-warning" data-scroll-prep-count>{landingStory.preparation.readyCount} of {landingStory.preparation.totalCount} ready</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full w-2/3 rounded-full bg-violet" data-scroll-prep-progress /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[0.62rem] font-semibold text-ink-muted">
            <div className="rounded-xl bg-surface-muted p-2.5" data-scroll-prep-item><Check className="mb-1 size-3.5 text-success" />Company context saved</div>
            <div className="rounded-xl bg-surface-muted p-2.5" data-scroll-prep-item><Clock3 className="mb-1 size-3.5 text-violet" />{landingStory.preparation.remainingAction}</div>
          </div>
          <div className="invisible mt-3 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-[0.6rem] font-bold text-success" data-scroll-resolve-proof><CircleCheckBig className="size-3.5" />Preparation saved to interview history</div>
        </section>

        <section className="invisible absolute inset-x-0 top-8 rounded-2xl border border-accent/35 bg-surface-raised p-4 shadow-panel dark:bg-slate-900" data-scroll-action data-scroll-story-panel>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong"><Clock3 className="size-4.5" /></span>
            <div className="min-w-0 flex-1"><p className="text-[0.55rem] font-bold uppercase tracking-[0.13em] text-accent-strong">Action Center · Due today</p><p className="mt-1 text-base font-black text-ink dark:text-white">{landingStory.action.nextAction}</p></div>
          </div>
          <div className="mt-3 rounded-xl bg-success-soft px-3 py-2 text-[0.62rem] font-bold text-success" data-scroll-action-proof>Interview complete · Preparation retained</div>
        </section>
      </div>

      <div className="absolute bottom-4 left-5 flex items-center gap-2 text-[0.58rem] font-semibold text-ink-muted" data-scroll-settle-anchor><Sparkles className="size-3.5 text-accent" />Each next step keeps the context behind it.</div>
    </div>
  );
}

function StaticChapterVisual({ chapter }: { chapter: LandingScrollChapter }) {
  const endpoint = endpointCopy[chapter.stage];
  return (
    <div className="hf-scroll-static-visual relative mt-5 h-64 overflow-hidden rounded-2xl border border-line-strong bg-surface-muted p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/70" data-scroll-static-stage={chapter.stage} aria-hidden="true">
      <div className="rounded-xl border border-line bg-surface-raised p-3 dark:bg-slate-900" data-scroll-static-identity><OpportunityIdentity /></div>
      <FluxRail />
      <div className="absolute inset-x-4 bottom-4 rounded-xl border border-line bg-surface-raised p-3 shadow-sm dark:bg-slate-900" data-scroll-static-endpoint>
        <p className="text-[0.52rem] font-bold uppercase tracking-[0.12em] text-accent-strong">{endpoint.eyebrow}</p>
        <p className="mt-1 text-sm font-black text-ink dark:text-white">{endpoint.title}</p>
        <p className="mt-1 truncate text-[0.62rem] font-semibold text-ink-muted">{endpoint.detail}</p>
      </div>
    </div>
  );
}

function ChapterCopy({ chapter, visual = false }: { chapter: LandingScrollChapter; visual?: boolean }) {
  return (
    <div aria-hidden={visual || undefined}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-accent-strong">{chapter.number} · {chapter.label}</p>
      <p className="mt-4 text-sm font-bold leading-6 text-ink-muted dark:text-slate-300">{chapter.question}</p>
      <h3 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">{chapter.title}</h3>
      <p className="mt-4 max-w-xl leading-7 text-ink-muted dark:text-slate-300">{chapter.description}</p>
    </div>
  );
}

export function ScrollProductStory() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeChapterRef = useRef<LandingHeroStage>("capture");
  const [activeChapter, setActiveChapter] = useState<LandingHeroStage>("capture");

  useLayoutEffect(() => {
    if (reducedMotion || !rootRef.current || !stageRef.current) return;

    const root = rootRef.current;
    const stage = stageRef.current;
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add(scrollStoryDesktopQuery, () => {
        const selectChapter = (progress: number) => {
          const nextChapter = scrollChapterForProgress(progress);
          if (activeChapterRef.current === nextChapter) return;
          activeChapterRef.current = nextChapter;
          setActiveChapter(nextChapter);
        };

        const timeline = gsap.timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: {
            trigger: stage,
            pin: stage,
            pinSpacing: true,
            start: "top top",
            end: () => `+=${Math.round(window.innerHeight * 3.4)}`,
            scrub: 0.35,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => selectChapter(self.progress),
          },
        });

        timeline
          .addLabel("capture", scrollStoryTimelineLabels.capture)
          .set("[data-scroll-copy-stage]", { autoAlpha: 0 }, 0)
          .set('[data-scroll-copy-stage="capture"]', { autoAlpha: 1 }, 0)
          .fromTo("[data-scroll-incoming]", { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0)
          .fromTo("[data-scroll-application]", { y: 8 }, { y: 0, duration: 0.16 }, 0.02)
          .to("[data-scroll-incoming]", { autoAlpha: 0, y: -5, duration: 0.04 }, 0.07)
          .addLabel("context", scrollStoryTimelineLabels.context)
          .to('[data-scroll-copy-stage="capture"]', { autoAlpha: 0, y: -6, duration: 0.04 }, 0.18)
          .fromTo('[data-scroll-copy-stage="progress"]', { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.2)
          .to("[data-scroll-context]", { autoAlpha: 1, y: 0, duration: 0.08 }, 0.2)
          .to("[data-flux-rail-context]", { strokeDashoffset: 0, duration: 0.08 }, 0.2)
          .to("[data-flux-context-node]", { autoAlpha: 1, duration: 0.05 }, 0.24)
          .to("[data-flux-marker-desktop]", { x: 142, duration: 0.1, ease: "power2.inOut" }, 0.2)
          .addLabel("progress", scrollStoryTimelineLabels.progress)
          .to("[data-scroll-context]", { autoAlpha: 0.5, y: -4, duration: 0.06 }, 0.32)
          .to("[data-scroll-capture-status]", { autoAlpha: 0, duration: 0.04 }, 0.32)
          .to("[data-scroll-progress-status]", { autoAlpha: 1, duration: 0.05 }, 0.33)
          .to("[data-flux-rail-progress]", { strokeDashoffset: 0, duration: 0.08 }, 0.32)
          .to("[data-flux-marker-desktop]", { x: 310, y: 28, duration: 0.08, ease: "power2.inOut" }, 0.32)
          .to("[data-scroll-interview]", { autoAlpha: 1, y: 0, duration: 0.08 }, 0.33)
          .addLabel("prepare", scrollStoryTimelineLabels.prepare)
          .to('[data-scroll-copy-stage="progress"]', { autoAlpha: 0, y: -6, duration: 0.04 }, 0.38)
          .fromTo('[data-scroll-copy-stage="prepare"]', { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.4)
          .to("[data-scroll-context]", { autoAlpha: 0, duration: 0.06 }, 0.4)
          .to("[data-scroll-interview]", { y: -10, duration: 0.1 }, 0.41)
          .to("[data-flux-rail-prepare]", { strokeDashoffset: 0, duration: 0.16, ease: "power2.inOut" }, 0.42)
          .to("[data-flux-marker-desktop]", { x: 384, y: 54, duration: 0.16, ease: "power2.inOut" }, 0.42)
          .fromTo("[data-scroll-preparation]", { autoAlpha: 0, y: 10, clipPath: "inset(0 0 100% 0 round 1rem)" }, { autoAlpha: 1, y: 0, clipPath: "inset(0 0 0% 0 round 1rem)", duration: 0.18 }, 0.45)
          .addLabel("resolve", scrollStoryTimelineLabels.resolve)
          .to("[data-scroll-prep-progress]", { width: "100%", duration: 0.1 }, 0.68)
          .to("[data-scroll-prep-count]", { autoAlpha: 0, scale: 0.96, duration: 0.05 }, 0.68)
          .to("[data-scroll-resolve-proof]", { autoAlpha: 1, y: 0, duration: 0.08 }, 0.7)
          .to("[data-scroll-interview]", { autoAlpha: 0.45, y: -13, duration: 0.08 }, 0.71)
          .to("[data-flux-resolve-node]", { autoAlpha: 1, duration: 0.06 }, 0.72)
          .to("[data-flux-marker-desktop]", { x: 432, y: 54, duration: 0.1, ease: "power2.inOut" }, 0.72)
          .addLabel("act", scrollStoryTimelineLabels.act)
          .to('[data-scroll-copy-stage="prepare"]', { autoAlpha: 0, y: -6, duration: 0.04 }, 0.83)
          .fromTo('[data-scroll-copy-stage="act"]', { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.85)
          .to("[data-scroll-interview], [data-scroll-preparation]", { autoAlpha: 0, y: -12, duration: 0.07 }, 0.85)
          .to("[data-flux-rail-act]", { strokeDashoffset: 0, duration: 0.09, ease: "power2.inOut" }, 0.85)
          .to("[data-flux-act-node]", { autoAlpha: 1, duration: 0.05 }, 0.88)
          .to("[data-flux-marker-desktop]", { x: 454, y: 29, duration: 0.09, ease: "power2.inOut" }, 0.85)
          .fromTo("[data-scroll-action]", { autoAlpha: 0, y: 12, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.09 }, 0.86)
          .addLabel("settled", scrollStoryTimelineLabels.settled)
          .to("[data-scroll-settle-anchor]", { opacity: 1, duration: 0.06 }, scrollStoryTimelineLabels.settled);

        return () => {
          timeline.scrollTrigger?.kill();
          timeline.kill();
        };
      });
    }, root);

    return () => {
      media.revert();
      context.revert();
    };
  }, [reducedMotion]);

  return (
    <div ref={rootRef} className="hf-scroll-story mt-14 sm:mt-16" data-scroll-story data-active-chapter={activeChapter} data-reduced-motion={reducedMotion}>
      <div className="hf-scroll-story-desktop" data-testid="desktop-product-story">
        <div ref={stageRef} className="hf-scroll-story-stage grid h-[min(44rem,100vh)] min-h-[40rem] grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] items-center gap-10" data-scroll-story-pin>
          <div className="relative min-h-[23rem] min-w-0">
            <ol className="sr-only">
              {landingScrollChapters.map((chapter) => <li key={chapter.stage}><ChapterCopy chapter={chapter} /></li>)}
            </ol>
            <div className="absolute inset-x-0 top-0" aria-hidden="true">
              {landingScrollChapters.map((chapter) => (
                <div key={chapter.stage} className="invisible absolute inset-x-0 top-0" data-scroll-copy-stage={chapter.stage}>
                  <ChapterCopy chapter={chapter} visual />
                </div>
              ))}
            </div>
            <ol className="absolute inset-x-0 bottom-0 grid grid-cols-4 gap-2" aria-hidden="true">
              {landingScrollChapters.map((chapter) => <li key={chapter.stage} className={`h-1 rounded-full transition-colors ${chapter.stage === activeChapter ? "bg-accent" : "bg-line-strong/60"}`} />)}
            </ol>
          </div>
          <ScrollProductVisual />
        </div>
      </div>

      <ol className="hf-scroll-story-fallback grid gap-8 md:grid-cols-2" data-testid="mobile-product-story">
        {landingScrollChapters.map((chapter) => (
          <li key={chapter.stage} className="min-w-0">
            <article className="h-full min-w-0 rounded-3xl border border-line bg-surface-raised p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6" data-scroll-fallback-chapter={chapter.stage} data-landing-clip-check>
              <ChapterCopy chapter={chapter} />
              <StaticChapterVisual chapter={chapter} />
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
