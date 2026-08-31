import { gsap } from "gsap";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { landingStory, type LandingAdvancedHeroStage } from "./landingStoryModel";
import { FluxRail } from "./FluxRail";

const timing = {
  quick: 0.18,
  state: 0.32,
  travel: 0.56,
  handoff: 0.82,
  signature: 0.92,
  stagger: 0.08,
} as const;

const settledLabel = {
  capture: "capture:settled",
  context: "context:settled",
  progress: "progress:settled",
  prepare: "prepare:settled",
  resolve: "resolve:settled",
  act: "act:settled",
} satisfies Record<LandingAdvancedHeroStage, string>;

const targetDuration = {
  capture: 0.76,
  context: 0.72,
  progress: 0.82,
  prepare: 0.95,
  resolve: 0.78,
  act: 1.02,
} satisfies Record<LandingAdvancedHeroStage, number>;

export interface FluxStoryVisualProps {
  stage: LandingAdvancedHeroStage;
  reducedMotion: boolean;
}

export function FluxStoryVisual({ stage, reducedMotion }: FluxStoryVisualProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const targetTweenRef = useRef<gsap.core.Tween | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;

    const context = gsap.context(() => {
      gsap.set("[data-flux-application]", { autoAlpha: 0, x: -10, y: 7, scaleX: 0.72, transformOrigin: "left center" });
      gsap.set("[data-flux-incoming]", { autoAlpha: 0, x: -6 });
      gsap.set("[data-flux-identity], [data-flux-metadata], [data-flux-capture-status], [data-flux-capture-link]", { autoAlpha: 0, y: 5 });
      gsap.set("[data-flux-progress-status]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-context]", { autoAlpha: 0, clipPath: "inset(0 55% 0 0 round 0.75rem)", y: -4 });
      gsap.set("[data-flux-context-item]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-decision-context]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-rail-base]", { autoAlpha: 0 });
      gsap.set("[data-flux-rail-field]", { y: 0 });
      gsap.set("[data-flux-journey-labels]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-rail-capture], [data-flux-rail-context], [data-flux-rail-progress], [data-flux-rail-prepare], [data-flux-rail-act]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-flux-rail-context], [data-flux-rail-progress], [data-flux-rail-prepare], [data-flux-rail-act], [data-flux-context-node], [data-flux-resolve-node], [data-flux-act-node]", { autoAlpha: 0 });
      gsap.set("[data-flux-marker-desktop], [data-flux-marker-mobile]", { autoAlpha: 0 });
      gsap.set("[data-flux-interview]", { autoAlpha: 0, y: 9, scale: 0.985 });
      gsap.set("[data-flux-interview-content]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-interview-detail]", { autoAlpha: 0, y: 5 });
      gsap.set("[data-flux-preparation]", { autoAlpha: 0, clipPath: "inset(0 0 100% 0 round 0.75rem)", scaleY: 0.88, transformOrigin: "top center" });
      gsap.set("[data-flux-prep-item]", { autoAlpha: 0, y: 6 });
      gsap.set("[data-flux-prep-progress]", { width: "0%" });
      gsap.set("[data-flux-prep-pending]", { autoAlpha: 1 });
      gsap.set("[data-flux-prep-complete], [data-flux-resolve-proof]", { autoAlpha: 0, y: 5 });
      gsap.set("[data-flux-action]", { autoAlpha: 0, y: 12, scale: 0.965 });
      gsap.set("[data-flux-action-item]", { autoAlpha: 0, y: 6 });

      const timeline = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      timeline
        .addLabel("capture:start", 0)
        .to("[data-flux-incoming]", { autoAlpha: 1, x: 0, duration: timing.state })
        .to("[data-flux-application]", { autoAlpha: 1, x: 0, y: 0, scaleX: 1, duration: timing.travel, ease: "power3.out" }, 0.08)
        .to("[data-flux-incoming]", { autoAlpha: 0, x: 6, duration: timing.quick }, 0.22)
        .to("[data-flux-identity]", { autoAlpha: 1, y: 0, duration: timing.state }, 0.2)
        .to("[data-flux-metadata]", { autoAlpha: 1, y: 0, duration: timing.state }, 0.29)
        .to("[data-flux-capture-status]", { autoAlpha: 1, y: 0, duration: timing.quick }, 0.34)
        .to("[data-flux-capture-link]", { autoAlpha: 1, y: 0, duration: timing.state }, 0.38)
        .to("[data-flux-rail-base]", { autoAlpha: 0.78, duration: timing.quick }, 0.28)
        .to("[data-flux-rail-capture]", { strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" }, 0.32)
        .to("[data-flux-marker-desktop], [data-flux-marker-mobile]", { autoAlpha: 1, duration: timing.quick }, 0.48)
        .to("[data-flux-journey-labels]", { autoAlpha: 0.68, y: 0, duration: timing.state }, 0.5)
        .addLabel("capture:settled")

        .addLabel("context:start")
        .to("[data-flux-capture-link]", { autoAlpha: 0.42, duration: timing.quick })
        .to("[data-flux-journey-labels]", { autoAlpha: 0, y: -3, duration: timing.quick }, "<")
        .to("[data-flux-rail-field]", { y: 40, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-rail-context], [data-flux-context-node]", { autoAlpha: 1, strokeDashoffset: 0, duration: timing.state }, "<")
        .to("[data-flux-marker-desktop]", { x: 142, duration: timing.state, ease: "power2.inOut" }, "<")
        .to("[data-flux-marker-mobile]", { x: 74, duration: timing.state, ease: "power2.inOut" }, "<")
        .to("[data-flux-context]", { autoAlpha: 1, clipPath: "inset(0 0 0 0 round 0.75rem)", y: 0, duration: timing.travel, ease: "power3.out" }, "<+0.04")
        .to("[data-flux-context-item]", { autoAlpha: 1, y: 0, duration: timing.state, stagger: timing.stagger }, "<+0.14")
        .to("[data-flux-decision-context]", { autoAlpha: 1, y: 0, duration: timing.state }, "<")
        .addLabel("context:settled")

        .addLabel("progress:start")
        .to("[data-flux-context], [data-flux-decision-context], [data-flux-capture-link], [data-flux-metadata]", { autoAlpha: 0, y: -3, duration: 0.22 })
        .to("[data-flux-rail-progress]", { autoAlpha: 1, strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" }, "<+0.04")
        .to("[data-flux-marker-desktop]", { x: 310, y: 28, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-marker-mobile]", { x: 176, y: 28, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-capture-status]", { autoAlpha: 0, y: -4, duration: 0.14 }, "<+0.02")
        .set("[data-flux-progress-status]", { autoAlpha: 1 }, "<+0.11")
        .to("[data-flux-progress-status]", { y: 0, duration: timing.quick }, "<")
        .set("[data-flux-interview]", { autoAlpha: 1 }, "<+0.14")
        .to("[data-flux-interview]", { y: 0, scale: 1, duration: timing.state }, "<")
        .to("[data-flux-interview-content]", { autoAlpha: 1, y: 0, duration: timing.state }, "<+0.04")
        .to("[data-flux-interview-detail]", { autoAlpha: 1, y: 0, duration: timing.state }, "<")
        .addLabel("progress:settled")

        .addLabel("prepare:start")
        .to("[data-flux-rail-prepare]", { autoAlpha: 1, strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" })
        .to("[data-flux-marker-desktop]", { x: 384, y: 54, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-marker-mobile]", { x: 220, y: 52, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-interview-detail]", { autoAlpha: 0, y: -3, duration: timing.quick }, "<+0.06")
        .to("[data-flux-interview-content]", { autoAlpha: 0.8, y: -1, duration: 0.22 }, "<")
        .to("[data-flux-interview]", { autoAlpha: 0.72, y: -7, scaleX: 0.96, scaleY: 0.86, duration: timing.state, transformOrigin: "top center" }, "<")
        .set("[data-flux-preparation]", { autoAlpha: 1 }, "<+0.14")
        .to("[data-flux-preparation]", { clipPath: "inset(0 0 0% 0 round 0.75rem)", scaleY: 1, duration: timing.handoff, ease: "power3.out" }, "<")
        .to("[data-flux-prep-item]", { autoAlpha: 1, y: 0, duration: timing.state, stagger: timing.stagger }, "<+0.18")
        .to("[data-flux-prep-progress]", { width: "66.666%", duration: timing.travel, ease: "power2.inOut" }, "<")
        .addLabel("prepare:settled")

        .addLabel("resolve:start")
        .to("[data-flux-prep-progress]", { width: "100%", duration: timing.travel, ease: "power2.inOut" })
        .to("[data-flux-prep-pending]", { autoAlpha: 0, y: -4, duration: timing.quick }, "<+0.08")
        .to("[data-flux-prep-complete]", { autoAlpha: 1, y: 0, duration: timing.state }, "<+0.05")
        .to("[data-flux-resolve-node]", { autoAlpha: 1, scale: 1.12, transformOrigin: "center", duration: timing.state }, "<")
        .to("[data-flux-resolve-node]", { scale: 1, duration: timing.quick })
        .to("[data-flux-resolve-proof]", { autoAlpha: 1, y: 0, duration: timing.state }, "<")
        .to("[data-flux-interview]", { autoAlpha: 0.58, duration: timing.state }, "<")
        .addLabel("resolve:settled")

        .addLabel("act:start")
        .to("[data-flux-rail-act], [data-flux-act-node]", { autoAlpha: 1, strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" })
        .to("[data-flux-marker-desktop]", { x: 418, y: 29, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-marker-mobile]", { x: 238, y: 30, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-preparation]", { autoAlpha: 0, y: -5, scale: 0.96, duration: timing.state }, "<+0.1")
        .to("[data-flux-interview]", { autoAlpha: 0, y: -8, duration: timing.state }, "<")
        .to("[data-flux-action]", { autoAlpha: 1, y: 0, scale: 1, duration: timing.signature, ease: "power3.out" }, "<+0.05")
        .to("[data-flux-action-item]", { autoAlpha: 1, y: 0, duration: timing.state, stagger: timing.stagger }, "<+0.28")
        .addLabel("act:settled");

      timelineRef.current = timeline;
    }, root);

    return () => {
      targetTweenRef.current?.kill();
      targetTweenRef.current = null;
      timelineRef.current?.kill();
      timelineRef.current = null;
      context.revert();
    };
  }, [reducedMotion]);

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const timeline = timelineRef.current;
    const root = rootRef.current;
    if (!timeline || !root) return;
    root.dataset.fluxSettled = "false";
    targetTweenRef.current?.kill();
    const targetTween = timeline.tweenTo(settledLabel[stage], {
      duration: targetDuration[stage],
      ease: stage === "prepare" || stage === "act" ? "power3.out" : "power2.out",
      onComplete: () => {
        if (targetTweenRef.current === targetTween) root.dataset.fluxSettled = "true";
      },
    });
    targetTweenRef.current = targetTween;
  }, [reducedMotion, stage]);

  return (
    <div
      ref={rootRef}
      className="hf-flux-story relative min-h-[27.5rem] overflow-hidden rounded-2xl border border-line-strong/80 bg-surface-raised/90 p-3 shadow-sm sm:min-h-[23.5rem] sm:p-4"
      data-flux-story
      data-visual-stage={stage}
      data-reduced-motion={reducedMotion || undefined}
      data-flux-settled={reducedMotion ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_4%,color-mix(in_srgb,var(--hf-accent)_8%,transparent),transparent_42%),radial-gradient(circle_at_92%_94%,color-mix(in_srgb,var(--hf-violet)_7%,transparent),transparent_38%)]" />

      <section className="absolute inset-x-3 top-3 z-20 rounded-xl border border-line-strong/75 bg-surface-raised px-3 py-1.5 shadow-sm sm:right-[24%] sm:px-4" data-flux-application data-flux-scene-owner="opportunity" data-persistent-opportunity>
        <div className="relative h-3 overflow-hidden" data-flux-cue-strip>
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 text-[0.6rem] font-bold leading-3 text-accent-strong" data-flux-incoming>
            <span className="size-1.5 rounded-full bg-accent" /> Incoming referral opportunity
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-slate-700 sm:size-10 sm:rounded-xl"><BriefcaseBusiness className="size-4" /></span>
          <div className="min-w-0 flex-1" data-flux-identity>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{landingStory.opportunity.company}</p>
            <p className="text-[0.7rem] font-black leading-4 text-ink sm:text-sm">{landingStory.opportunity.role}</p>
          </div>
          <div className="relative h-6 w-14 shrink-0 text-right text-[0.6rem] font-bold max-[359px]:hidden sm:w-16">
            <span className="absolute right-0 top-0 rounded-full bg-info-soft px-2 py-1 text-info" data-flux-capture-status>Applied</span>
            <span className="invisible absolute right-0 top-0 rounded-full bg-violet-soft px-2 py-1 text-violet" data-flux-progress-status>Interview</span>
          </div>
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[0.6rem] font-semibold text-ink-muted sm:text-[0.66rem]" data-flux-metadata>
          <span>{landingStory.opportunity.source}</span><span aria-hidden="true">·</span><span>{landingStory.opportunity.workMode}</span><span className="hidden sm:inline" aria-hidden="true">·</span><span className="hidden truncate sm:inline">{landingStory.opportunity.compensation}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-success" data-flux-capture-link><Check className="size-3 shrink-0" />Organized</span>
        </div>
      </section>

      <section className="absolute inset-x-3 top-[5.9rem] z-10 grid grid-cols-3 gap-1.5 rounded-xl border border-line bg-surface/95 p-2 shadow-sm sm:right-[10%] sm:top-[6rem] sm:gap-2" data-flux-context data-flux-scene-owner="context">
        <div className="min-w-0 rounded-lg bg-surface-muted px-2 py-1.5" data-flux-context-item><p className="text-[0.5rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Location</p><p className="truncate text-[0.62rem] font-bold text-ink">{landingStory.opportunity.location}</p></div>
        <div className="min-w-0 rounded-lg bg-surface-muted px-2 py-1.5" data-flux-context-item><p className="text-[0.5rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Compensation</p><p className="truncate text-[0.62rem] font-bold text-ink">{landingStory.opportunity.compensation}</p></div>
        <div className="min-w-0 rounded-lg bg-accent-soft px-2 py-1.5" data-flux-context-item><p className="text-[0.5rem] font-bold uppercase tracking-[0.1em] text-accent-strong">Next check</p><p className="truncate text-[0.62rem] font-bold text-ink">September 5</p></div>
      </section>

      <FluxRail />

      <div className="absolute inset-x-3 top-[11.15rem] z-20 sm:left-[29%] sm:top-[10.55rem]">
        <section className="invisible rounded-xl border border-accent/30 bg-surface-raised p-2.5 shadow-sm" data-flux-interview data-flux-scene-owner="progress">
          <div className="flex items-center gap-2.5" data-flux-interview-content>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong"><CalendarCheck2 className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-[0.54rem] font-bold uppercase tracking-[0.12em] text-accent-strong">Interview created</p><p className="text-[0.68rem] font-black leading-4 text-ink sm:text-xs">{landingStory.interview.title}</p></div>
            <span className="max-w-20 text-right text-[0.54rem] font-bold leading-3 text-ink-muted" data-flux-interview-detail>{landingStory.interview.dateLabel}</span>
          </div>
        </section>

        <section className="invisible mt-2 rounded-xl border border-violet/30 bg-surface-raised p-2.5 shadow-sm" data-flux-preparation data-flux-scene-owner="prepare">
          <div className="flex items-center gap-2" data-flux-prep-item>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-violet"><ClipboardCheck className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-[0.54rem] font-bold uppercase tracking-[0.12em] text-violet">Interview preparation</p><p className="truncate text-[0.68rem] font-black text-ink sm:text-xs">Context carried forward</p></div>
            <span className="rounded-full bg-warning-soft px-2 py-1 text-[0.56rem] font-bold text-warning" data-flux-prep-pending>{landingStory.preparation.readyCount} of {landingStory.preparation.totalCount} ready</span>
            <span className="invisible absolute right-2.5 top-2.5 rounded-full bg-success-soft px-2 py-1 text-[0.56rem] font-bold text-success" data-flux-prep-complete>3 of 3 ready</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted" data-flux-prep-item><div className="h-full rounded-full bg-violet" data-flux-prep-progress /></div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[0.58rem] font-semibold text-ink-muted" data-flux-prep-item>
            <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-success-soft px-2 py-1.5 text-success"><Check className="size-3 shrink-0" />Company context</span>
            <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-muted px-2 py-1.5"><MessageSquareText className="size-3 shrink-0 text-accent" />Questions ready</span>
          </div>
          <div className="invisible mt-2 flex items-center gap-2 rounded-lg bg-success-soft px-2 py-1.5 text-[0.58rem] font-bold text-success" data-flux-resolve-proof><CircleCheckBig className="size-3.5 shrink-0" />Preparation saved to the interview history</div>
        </section>

        <section className="invisible absolute inset-x-0 top-8 z-20 rounded-xl border border-accent/35 bg-surface-raised p-3 shadow-panel" data-flux-action data-flux-scene-owner="act">
          <div className="flex items-start gap-2.5" data-flux-action-item>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong"><Clock3 className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-[0.54rem] font-bold uppercase tracking-[0.13em] text-accent-strong">Action Center · Due today</p><p className="mt-0.5 text-sm font-black leading-5 text-ink">{landingStory.action.nextAction}</p></div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-accent-soft px-2.5 py-2" data-flux-action-item>
            <div className="min-w-0"><p className="text-[0.52rem] font-bold uppercase tracking-[0.1em] text-ink-muted">Grounded in your progress</p><p className="truncate text-[0.62rem] font-semibold text-ink">Interview complete · Preparation retained</p></div>
            <ArrowUpRight className="size-4 shrink-0 text-accent-strong" />
          </div>
        </section>
      </div>

      <div className="absolute bottom-3 left-3 hidden items-center gap-1.5 text-[0.55rem] font-semibold text-ink-muted sm:flex" data-flux-decision-context><MapPin className="size-3 text-accent" />{landingStory.opportunity.decisionContext}</div>
    </div>
  );
}
