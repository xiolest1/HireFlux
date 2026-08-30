import {
  CirclePause,
  CirclePlay,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useReducedMotion } from "../../components/ui/motionHooks";
import {
  landingHeroMilestoneByStage,
  landingHeroMilestones,
  landingStory,
} from "./landingStoryModel";
import { FluxStoryVisual } from "./FluxStoryVisual";
import { useLandingStoryController } from "./useLandingStoryController";

export function HeroApplicationStory() {
  const reducedMotion = useReducedMotion();
  const controller = useLandingStoryController(reducedMotion);
  const activeStep = landingHeroMilestoneByStage[controller.currentStage];
  const activeIndex = landingHeroMilestones.findIndex(
    ({ stage }) => stage === controller.currentStage,
  );
  const replayAvailable = controller.currentScene === "act" || controller.playbackMode === "complete";
  const storyControl = replayAvailable
    ? { label: "Replay application story", action: controller.replay, Icon: CirclePlay }
    : controller.playbackMode === "autoplay"
      ? { label: "Pause application story", action: controller.pause, Icon: CirclePause }
      : { label: "Play application story", action: controller.play, Icon: CirclePlay };

  return (
    <figure
      className="relative mx-auto min-w-0 w-full max-w-xl lg:mx-0"
      aria-labelledby="hero-story-caption"
      data-hero-story
      data-story-step={activeStep.stage}
      data-story-scene={controller.currentScene}
      data-landing-clip-check
    >
      <div aria-hidden="true" className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-gradient-to-br from-cyan-200/60 to-violet-200/60 blur-sm dark:from-cyan-950/50 dark:to-violet-950/50 sm:-inset-5 sm:rounded-[2.25rem]" />
      <div className="overflow-hidden rounded-3xl border border-line-strong bg-surface-raised shadow-panel dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-4 dark:border-slate-700 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink-muted">{landingStory.opportunity.company}</p>
            <p className="mt-1 truncate text-sm font-bold text-ink dark:text-white sm:text-base">{landingStory.opportunity.role}</p>
          </div>
          {!reducedMotion ? (
            <button
              type="button"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              aria-label={storyControl.label}
              onClick={storyControl.action}
            >
              <storyControl.Icon aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>

        <div className="bg-surface-muted p-4 dark:bg-slate-950/60 sm:p-5">
          <ol className="grid grid-cols-4 gap-1.5" aria-label="Application story stages">
            {landingHeroMilestones.map((step, index) => {
              const reached = index <= activeIndex;
              const current = index === activeIndex;
              return (
                <li key={step.stage} className="min-w-0">
                  <button
                    type="button"
                    className={`group min-h-11 w-full rounded-xl px-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98] ${current ? "bg-surface-raised shadow-sm" : "hover:bg-surface-raised/60"}`}
                    aria-label={`Show ${step.label} stage`}
                    aria-pressed={current}
                    aria-current={current ? "step" : undefined}
                    onClick={() => controller.selectStage(step.stage)}
                  >
                    <span className={`block h-1 rounded-full transition-colors duration-300 ${current ? "bg-accent" : reached ? "bg-accent/55" : "bg-line-strong/60 group-hover:bg-line-strong"}`} />
                    <span className={`mt-2 block truncate text-[0.62rem] font-bold sm:text-[0.68rem] ${current ? "text-ink" : "text-ink-muted group-hover:text-ink"}`}>{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div
            className="mt-4 min-h-[29.75rem] sm:min-h-[25.75rem]"
            aria-live="off"
          >
            <FluxStoryVisual
              stage={controller.currentScene}
              reducedMotion={reducedMotion}
            />
            <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-ink-muted">
              <Sparkles aria-hidden="true" className="size-3.5 text-accent-strong" />
              One opportunity, connected from capture to action.
            </div>
          </div>
        </div>
      </div>
      <figcaption id="hero-story-caption" className="sr-only">Northstar Labs becomes an organized application, carries context into interview preparation, preserves completed work, and surfaces a clear follow-up action.</figcaption>
    </figure>
  );
}

export function LandingReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hf-section-reveal ${className}`}>{children}</div>;
}
