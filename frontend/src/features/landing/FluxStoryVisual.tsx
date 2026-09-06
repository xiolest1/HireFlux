import { gsap } from "gsap";
import { ArrowUpRight, BriefcaseBusiness, Clock3 } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { landingStory } from "./landingStoryModel";
import { FluxRail } from "./FluxRail";

export interface FluxStoryVisualProps {
  reducedMotion: boolean;
  motionEligible: boolean;
}

export function FluxStoryVisual({
  reducedMotion,
  motionEligible,
}: FluxStoryVisualProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const motionActive = motionEligible && !reducedMotion;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !motionActive) return;

    root.dataset.heroSettled = "false";
    const context = gsap.context(() => {
      gsap.set("[data-flux-opportunity]", {
        autoAlpha: 0,
        x: -8,
        y: 7,
        scale: 0.985,
      });
      gsap.set("[data-flux-connection-base]", { autoAlpha: 0 });
      gsap.set("[data-flux-connection-line]", {
        strokeDasharray: 1,
        strokeDashoffset: 1,
      });
      gsap.set("[data-flux-connection-marker]", {
        autoAlpha: 0,
        scale: 0.75,
        transformOrigin: "center",
      });
      gsap.set("[data-flux-provenance]", { autoAlpha: 0, y: 4 });
      gsap.set("[data-flux-next-action]", {
        autoAlpha: 0,
        x: 8,
        y: 9,
        scale: 0.975,
      });
      gsap.set("[data-flux-next-action-content]", { autoAlpha: 0, y: 5 });

      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: () => {
          root.dataset.heroSettled = "true";
        },
      });
      timeline
        .addLabel("opportunity", 0)
        .to("[data-flux-opportunity]", {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.46,
          ease: "power3.out",
        })
        .addLabel("connection", 0.28)
        .to(
          "[data-flux-connection-base]",
          { autoAlpha: 0.76, duration: 0.18 },
          0.28,
        )
        .to(
          "[data-flux-connection-line]",
          { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" },
          0.32,
        )
        .to(
          "[data-flux-connection-marker]",
          { autoAlpha: 1, scale: 1, duration: 0.24 },
          0.68,
        )
        .to(
          "[data-flux-provenance]",
          { autoAlpha: 1, y: 0, duration: 0.32 },
          0.5,
        )
        .addLabel("action", 0.7)
        .to(
          "[data-flux-next-action]",
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.58,
            ease: "power3.out",
          },
          0.7,
        )
        .to(
          "[data-flux-next-action-content]",
          { autoAlpha: 1, y: 0, duration: 0.34 },
          0.92,
        )
        .addLabel("settled", 1.28);
      timelineRef.current = timeline;
    }, root);

    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      context.revert();
    };
  }, [motionActive]);

  return (
    <div
      ref={rootRef}
      className="hf-flux-story relative min-h-[20.5rem] overflow-hidden rounded-3xl border border-line-strong/80 bg-surface-raised/90 p-4 shadow-panel sm:min-h-[21rem] sm:p-5"
      data-flux-story
      data-visual-stage="resolved"
      data-reduced-motion={reducedMotion || undefined}
      data-hero-motion-eligible={motionEligible ? "true" : "false"}
      data-hero-settled={motionActive ? "false" : "true"}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_4%,color-mix(in_srgb,var(--hf-accent)_9%,transparent),transparent_42%),radial-gradient(circle_at_92%_94%,color-mix(in_srgb,var(--hf-violet)_7%,transparent),transparent_38%)]" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-accent-strong">
          Connected opportunity
        </p>
        <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.56rem] font-bold text-ink-muted">
          Context retained
        </span>
      </div>

      <section
        className="relative z-10 mt-4 max-w-[92%] rounded-2xl border border-line-strong/80 bg-surface-raised p-3.5 shadow-sm sm:max-w-[82%] sm:p-4"
        data-flux-opportunity
        data-persistent-opportunity
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-700">
            <BriefcaseBusiness className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {landingStory.opportunity.company}
            </p>
            <p className="mt-0.5 text-sm font-black leading-5 text-ink dark:text-white">
              {landingStory.opportunity.role}
            </p>
            <p className="mt-1.5 text-[0.62rem] font-semibold text-ink-muted">
              {landingStory.opportunity.source} · {landingStory.opportunity.workMode}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-success-soft px-2 py-1 text-[0.56rem] font-bold text-success max-[429px]:hidden">
            Interview complete
          </span>
        </div>
      </section>

      <FluxRail />

      <section
        className="relative z-10 ml-auto max-w-[96%] rounded-2xl border border-accent/35 bg-surface-raised p-4 shadow-panel sm:max-w-[88%]"
        data-flux-next-action
      >
        <div className="flex min-w-0 items-start gap-3" data-flux-next-action-content>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.13em] text-accent-strong">
              Action Center · {landingStory.action.status}
            </p>
            <p className="mt-1 text-base font-black leading-5 text-ink dark:text-white">
              {landingStory.action.nextAction}
            </p>
            <p className="mt-2 text-[0.64rem] font-semibold leading-4 text-ink-muted">
              {landingStory.action.proofAction}
            </p>
          </div>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-accent-strong" />
        </div>
      </section>
    </div>
  );
}
