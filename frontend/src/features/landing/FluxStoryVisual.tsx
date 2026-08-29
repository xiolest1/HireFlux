import { gsap } from "gsap";
import {
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import {
  landingStory,
  type LandingAdvancedHeroStage,
} from "./landingStoryModel";
import { FluxRail } from "./FluxRail";

const timing = {
  quick: 0.18,
  state: 0.32,
  travel: 0.56,
  handoff: 0.82,
  stagger: 0.08,
} as const;

const settledLabel = {
  capture: "capture:settled",
  progress: "progress:settled",
  prepare: "prepare:settled",
} satisfies Record<LandingAdvancedHeroStage, string>;

const targetDuration = {
  capture: 0.68,
  progress: 0.76,
  prepare: 0.95,
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
      gsap.set("[data-flux-application]", { autoAlpha: 0, x: 12, y: 6 });
      gsap.set("[data-flux-identity], [data-flux-metadata]", { autoAlpha: 0, y: 6 });
      gsap.set("[data-flux-capture-status]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-progress-status]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-rail-base]", { autoAlpha: 0 });
      gsap.set("[data-flux-rail-capture], [data-flux-rail-progress], [data-flux-rail-prepare]", {
        strokeDasharray: 1,
        strokeDashoffset: 1,
      });
      gsap.set("[data-flux-rail-progress], [data-flux-rail-prepare]", { autoAlpha: 0 });
      gsap.set("[data-flux-marker-desktop], [data-flux-marker-mobile]", { autoAlpha: 0 });
      gsap.set("[data-flux-capture-hint]", { autoAlpha: 0, y: 6 });
      gsap.set("[data-flux-interview]", { autoAlpha: 0, y: 10, scale: 0.985 });
      gsap.set("[data-flux-interview-detail]", { autoAlpha: 0, y: 5 });
      gsap.set("[data-flux-preparation]", {
        autoAlpha: 0,
        clipPath: "inset(0 0 100% 0 round 0.75rem)",
        scaleY: 0.88,
        transformOrigin: "top center",
      });
      gsap.set("[data-flux-prep-item]", { autoAlpha: 0, y: 6 });
      gsap.set("[data-flux-prep-progress]", { width: "0%" });

      const timeline = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      timeline
        .addLabel("capture:start", 0)
        .to("[data-flux-rail-base]", { autoAlpha: 0.72, duration: timing.quick })
        .to("[data-flux-application]", { autoAlpha: 1, x: 0, y: 0, duration: timing.travel, ease: "power3.out" }, 0.04)
        .to("[data-flux-identity]", { autoAlpha: 1, y: 0, duration: timing.state }, 0.14)
        .to("[data-flux-metadata]", { autoAlpha: 1, y: 0, duration: timing.state }, 0.22)
        .to("[data-flux-capture-status]", { autoAlpha: 1, y: 0, duration: timing.quick }, 0.28)
        .to("[data-flux-rail-capture]", { strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" }, 0.2)
        .to("[data-flux-marker-desktop], [data-flux-marker-mobile]", { autoAlpha: 1, duration: timing.quick }, 0.35)
        .to("[data-flux-capture-hint]", { autoAlpha: 1, y: 0, duration: timing.state }, 0.4)
        .addLabel("capture:settled")
        .addLabel("progress:start")
        .to("[data-flux-capture-hint]", { autoAlpha: 0, y: -5, duration: timing.quick })
        .to("[data-flux-rail-progress]", { autoAlpha: 1, strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" }, "<+0.04")
        .to("[data-flux-marker-desktop]", { x: 166, y: 27, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-marker-mobile]", { x: 162, y: 29, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-capture-status]", { autoAlpha: 0, y: -4, duration: timing.quick }, "<+0.08")
        .to("[data-flux-progress-status]", { autoAlpha: 1, y: 0, duration: timing.state }, "<+0.06")
        .to("[data-flux-interview]", { autoAlpha: 1, y: 0, scale: 1, duration: timing.state }, "<+0.04")
        .to("[data-flux-interview-detail]", { autoAlpha: 1, y: 0, duration: timing.state }, "<+0.1")
        .addLabel("progress:settled")
        .addLabel("prepare:start")
        .to("[data-flux-rail-prepare]", { autoAlpha: 1, strokeDashoffset: 0, duration: timing.travel, ease: "power2.inOut" })
        .to("[data-flux-marker-desktop]", { x: 416, y: 51, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-marker-mobile]", { x: 234, y: 54, duration: timing.travel, ease: "power2.inOut" }, "<")
        .to("[data-flux-interview]", { y: -5, scale: 0.99, duration: timing.state }, "<+0.08")
        .to("[data-flux-preparation]", {
          autoAlpha: 1,
          clipPath: "inset(0 0 0% 0 round 0.75rem)",
          scaleY: 1,
          duration: timing.handoff,
          ease: "power3.out",
        }, "<+0.05")
        .to("[data-flux-prep-item]", {
          autoAlpha: 1,
          y: 0,
          duration: timing.state,
          stagger: timing.stagger,
        }, "<+0.2")
        .to("[data-flux-prep-progress]", { width: "66.666%", duration: timing.travel, ease: "power2.inOut" }, "<")
        .addLabel("prepare:settled");

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
      ease: stage === "prepare" ? "power3.out" : "power2.out",
      onComplete: () => {
        if (targetTweenRef.current === targetTween) {
          root.dataset.fluxSettled = "true";
        }
      },
    });
    targetTweenRef.current = targetTween;
  }, [reducedMotion, stage]);

  return (
    <div
      ref={rootRef}
      className="hf-flux-story relative min-h-[26.25rem] overflow-hidden rounded-2xl border border-line bg-surface-raised/85 p-3 shadow-sm sm:min-h-[22.5rem] sm:p-4"
      data-flux-story
      data-visual-stage={stage}
      data-reduced-motion={reducedMotion || undefined}
      data-flux-settled={reducedMotion ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_4%,color-mix(in_srgb,var(--hf-accent)_10%,transparent),transparent_42%),radial-gradient(circle_at_92%_94%,color-mix(in_srgb,var(--hf-violet)_9%,transparent),transparent_38%)]" />

      <section
        className="absolute inset-x-3 top-3 z-10 rounded-xl border border-line bg-surface-raised px-3 py-3 shadow-sm sm:right-[26%] sm:px-4"
        data-flux-application
        data-persistent-opportunity
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-700">
            <BriefcaseBusiness className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1" data-flux-identity>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{landingStory.opportunity.company}</p>
            <p className="truncate text-xs font-black text-ink sm:text-sm">{landingStory.opportunity.role}</p>
          </div>
          <div className="relative h-6 w-16 shrink-0 text-right text-[0.62rem] font-bold">
            <span className="absolute right-0 top-0 rounded-full bg-info-soft px-2 py-1 text-info" data-flux-capture-status>Captured</span>
            <span className="invisible absolute right-0 top-0 rounded-full bg-violet-soft px-2 py-1 text-violet" data-flux-progress-status>Interview</span>
          </div>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-2 text-[0.62rem] font-semibold text-ink-muted sm:text-[0.68rem]" data-flux-metadata>
          <span>{landingStory.opportunity.source}</span><span aria-hidden="true">·</span>
          <span>{landingStory.opportunity.workMode}</span><span aria-hidden="true">·</span>
          <span className="truncate">{landingStory.opportunity.compensation}</span>
        </div>
      </section>

      <FluxRail />

      <div
        className="absolute inset-x-4 bottom-5 flex items-center gap-3 rounded-xl border border-line-subtle bg-surface/80 px-3 py-3 shadow-sm sm:bottom-6 sm:left-[30%]"
        data-flux-capture-hint
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
          <Check className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.13em] text-success">Opportunity record established</p>
          <p className="truncate text-xs font-semibold text-ink-muted">Ready for structured progression</p>
        </div>
      </div>

      <div className="absolute inset-x-3 top-[11.35rem] z-10 sm:left-[30%] sm:top-[9.9rem]">
        <section className="invisible rounded-xl border border-accent/30 bg-surface-raised p-3 shadow-sm" data-flux-interview>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
              <CalendarCheck2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.13em] text-accent-strong">Interview created</p>
              <p className="truncate text-xs font-black text-ink">{landingStory.interview.title}</p>
            </div>
            <span className="max-w-20 text-right text-[0.58rem] font-bold leading-3 text-ink-muted" data-flux-interview-detail>
              {landingStory.interview.dateLabel}
            </span>
          </div>
        </section>

        <section className="invisible mt-2 rounded-xl border border-violet/30 bg-surface-raised p-3 shadow-sm" data-flux-preparation>
          <div className="flex items-center gap-2" data-flux-prep-item>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-violet">
              <ClipboardCheck className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.13em] text-violet">Interview preparation</p>
              <p className="truncate text-xs font-black text-ink">Context carried forward</p>
            </div>
            <span className="rounded-full bg-warning-soft px-2 py-1 text-[0.6rem] font-bold text-warning">
              {landingStory.preparation.readyCount} of {landingStory.preparation.totalCount} ready
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" data-flux-prep-item>
            <div className="h-full rounded-full bg-violet" data-flux-prep-progress />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[0.62rem] font-semibold text-ink-muted" data-flux-prep-item>
            <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-success-soft px-2 py-2 text-success">
              <Check className="size-3 shrink-0" />Company context
            </span>
            <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-muted px-2 py-2">
              <MessageSquareText className="size-3 shrink-0 text-accent" />Questions ready
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
