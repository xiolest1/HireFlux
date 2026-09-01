import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useReducedMotion } from "../../components/ui/motionHooks";
import { FluxStoryVisual } from "./FluxStoryVisual";

export function HeroApplicationStory() {
  const reducedMotion = useReducedMotion();

  return (
    <figure
      className="relative mx-auto w-full min-w-0 max-w-xl lg:mx-0"
      aria-labelledby="hero-story-caption"
      data-hero-story
      data-story-scene="resolved"
      data-landing-clip-check
    >
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-gradient-to-br from-cyan-200/60 to-violet-200/60 blur-sm dark:from-cyan-950/50 dark:to-violet-950/50 sm:-inset-5 sm:rounded-[2.25rem]"
      />
      <FluxStoryVisual reducedMotion={reducedMotion} />
      <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-ink-muted">
        <Sparkles aria-hidden="true" className="size-3.5 text-accent-strong" />
        One opportunity, connected from capture to action.
      </div>
      <figcaption id="hero-story-caption" className="sr-only">
        Northstar Labs stays connected to its completed interview and preparation
        history, so HireFlux can surface a thoughtful follow-up as the next useful
        action.
      </figcaption>
    </figure>
  );
}

export function LandingReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hf-section-reveal ${className}`}>{children}</div>;
}
