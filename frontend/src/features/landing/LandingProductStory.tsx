import {
  ArrowUpRight,
  BellRing,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  CirclePause,
  CirclePlay,
  ClipboardCheck,
  Clock3,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useReducedMotion } from "../../components/ui/motionHooks";
import {
  landingHeroAutoplayStageOrder,
  landingHeroMilestoneByStage,
  landingHeroMilestones,
  landingProofSteps,
  landingStory,
  type LandingAdvancedHeroStage,
  type LandingHeroMilestone,
  type LandingHeroStage,
  type LandingProofStep,
} from "./landingStoryModel";
import { FluxStoryVisual } from "./FluxStoryVisual";
import { useLandingStoryController } from "./useLandingStoryController";

const heroIcons = {
  capture: BriefcaseBusiness,
  progress: CalendarCheck2,
  prepare: ClipboardCheck,
  act: BellRing,
} satisfies Record<LandingHeroStage, typeof BriefcaseBusiness>;

const heroStatusTones = {
  capture: "bg-sky-100 text-sky-800",
  progress: "bg-violet-100 text-violet-800",
  prepare: "bg-warning-soft text-warning",
  act: "bg-danger-soft text-danger",
} satisfies Record<LandingHeroStage, string>;

const proofIcons = {
  capture: BriefcaseBusiness,
  progress: MessageSquareText,
  act: BellRing,
} satisfies Record<LandingProofStep["stage"], typeof BriefcaseBusiness>;

function isAdvancedHeroStage(
  stage: LandingHeroStage,
): stage is LandingAdvancedHeroStage {
  return landingHeroAutoplayStageOrder.some((candidate) => candidate === stage);
}

function StoryCard({ step, compact = false }: { step: LandingHeroMilestone; compact?: boolean }) {
  const Icon = heroIcons[step.stage];
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-700">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{step.eyebrow}</p>
          <p className="mt-1 text-sm font-bold text-ink dark:text-white">{step.title}</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted dark:text-slate-400">{step.detail}</p>
        </div>
        <span className={`max-w-24 shrink-0 rounded-full px-2.5 py-1 text-center text-[0.68rem] font-bold leading-4 ${heroStatusTones[step.stage]}`}>{step.status}</span>
      </div>
      <div className={`${compact ? "mt-4" : "mt-6"} flex min-w-0 items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft px-3 py-3`}>
        <Clock3 aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-muted">{step.nextLabel}</p>
          <p className="text-sm font-bold leading-5 text-ink">{step.nextAction}</p>
        </div>
        <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-accent-strong" />
      </div>
    </div>
  );
}

export function HeroApplicationStory() {
  const reducedMotion = useReducedMotion();
  const controller = useLandingStoryController(reducedMotion);
  const activeStep = landingHeroMilestoneByStage[controller.currentStage];
  const advancedStage = isAdvancedHeroStage(controller.currentStage)
    ? controller.currentStage
    : null;
  const activeIndex = landingHeroMilestones.findIndex(
    ({ stage }) => stage === controller.currentStage,
  );
  const replayAvailable = controller.currentStage === "act" ||
    controller.currentStage === "prepare" ||
    controller.playbackMode === "complete";
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
                    className="group min-h-11 w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98]"
                    aria-label={`Show ${step.label} stage`}
                    aria-pressed={current}
                    aria-current={current ? "step" : undefined}
                    onClick={() => controller.selectStage(step.stage)}
                  >
                    <span className={`block h-1.5 rounded-full transition-colors duration-300 ${reached ? "bg-accent" : "bg-line group-hover:bg-line-strong"}`} />
                    <span className={`mt-2 block truncate text-[0.62rem] font-bold sm:text-[0.68rem] ${current ? "text-ink" : "text-ink-muted group-hover:text-ink"}`}>{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div
            className={`mt-4 ${advancedStage ? "min-h-[28.5rem] sm:min-h-[24.75rem]" : "min-h-[14.5rem] sm:min-h-[15rem]"}`}
            aria-live="off"
          >
            {advancedStage ? (
              <FluxStoryVisual
                stage={advancedStage}
                reducedMotion={reducedMotion}
              />
            ) : (
              <div key={activeStep.stage} className="hf-story-swap">
                <StoryCard step={activeStep} />
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-ink-muted">
              <Sparkles aria-hidden="true" className="size-3.5 text-accent-strong" />
              One opportunity, connected from capture to action.
            </div>
          </div>
        </div>
      </div>
      <figcaption id="hero-story-caption" className="sr-only">Northstar Labs moves from captured opportunity to application progress, interview preparation, and a clear follow-up action.</figcaption>
    </figure>
  );
}

function ProofSnapshot({ step }: { step: LandingProofStep }) {
  const Icon = proofIcons[step.stage];
  return (
    <div className="min-w-0 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900 sm:p-7" data-landing-clip-check>
      <div className="flex min-w-0 items-center gap-3 border-b border-line pb-5 dark:border-slate-700">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong"><Icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{landingStory.opportunity.company}</p>
          <p className="truncate text-sm font-bold text-ink dark:text-white">{landingStory.opportunity.role}</p>
        </div>
      </div>
      <div className="py-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-strong">{step.label} result</p>
        <p className="mt-2 text-xl font-black text-ink dark:text-white">{step.result}</p>
      </div>
      <div className="rounded-2xl bg-slate-950 p-4 text-white dark:border dark:border-slate-700">
        <p className="text-xs font-semibold text-cyan-300">{step.question}</p>
        <p className="mt-2 text-sm font-bold leading-6">{step.answer}</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-300"><Check aria-hidden="true" className="size-3.5 text-emerald-300" />Grounded in the opportunity history</div>
      </div>
    </div>
  );
}

export function ProgressiveProductStory() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <>
      <div className="mt-12 hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-12 lg:grid" data-testid="desktop-product-story">
        <ol className="space-y-6">
          {landingProofSteps.map((step, index) => (
            <li key={step.stage}>
              <article
                className={`min-h-[18rem] rounded-3xl border p-7 transition-colors ${activeIndex === index ? "border-accent/50 bg-accent-soft" : "border-line bg-surface-raised dark:bg-slate-900"}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
              >
                <span className="text-sm font-black text-accent-strong">{step.number} · {step.label}</span>
                <h3 className="mt-5 text-2xl font-black text-ink dark:text-white">{step.title}</h3>
                <p className="mt-3 max-w-xl leading-7 text-ink-muted dark:text-slate-300">{step.description}</p>
                <button
                  type="button"
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-accent-strong"
                  aria-label={`Show ${step.label} moment`}
                  aria-pressed={activeIndex === index}
                  onClick={() => setActiveIndex(index)}
                >
                  Show this moment <ArrowUpRight aria-hidden="true" className="size-4" />
                </button>
              </article>
            </li>
          ))}
        </ol>
        <div className="relative">
          <div className="sticky top-8 min-h-[31rem]" aria-live="polite">
            <div key={landingProofSteps[activeIndex].stage} className="hf-story-swap"><ProofSnapshot step={landingProofSteps[activeIndex]} /></div>
          </div>
        </div>
      </div>

      <ol className="mt-10 space-y-6 lg:hidden" data-testid="mobile-product-story">
        {landingProofSteps.map((step) => (
          <li key={step.stage} className="min-w-0">
            <article className="min-w-0">
              <span className="text-sm font-black text-accent-strong">{step.number} · {step.label}</span>
              <h3 className="mt-3 text-xl font-black text-ink dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted dark:text-slate-300">{step.description}</p>
              <div className="mt-4"><ProofSnapshot step={step} /></div>
            </article>
          </li>
        ))}
      </ol>
    </>
  );
}

export function LandingReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hf-section-reveal ${className}`}>{children}</div>;
}
