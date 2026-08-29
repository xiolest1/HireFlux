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
import { useEffect, useRef, useState, type ReactNode } from "react";

const STORY_DURATION_MS = 3_000;

const heroSteps = [
  {
    key: "capture",
    label: "Capture",
    eyebrow: "Opportunity captured",
    status: "Draft",
    statusTone: "bg-sky-100 text-sky-800",
    title: "Role details are together",
    detail: "Referral · Remote · $145k–$165k",
    nextLabel: "Next",
    nextAction: "Review role details",
    icon: BriefcaseBusiness,
  },
  {
    key: "progress",
    label: "Progress",
    eyebrow: "Application progressing",
    status: "Interview",
    statusTone: "bg-violet-100 text-violet-800",
    title: "Technical screen scheduled",
    detail: "September 2 · 10:00 AM",
    nextLabel: "Next",
    nextAction: "Prepare for the interview",
    icon: CalendarCheck2,
  },
  {
    key: "prepare",
    label: "Prepare",
    eyebrow: "Interview preparation",
    status: "2 of 3 ready",
    statusTone: "bg-warning-soft text-warning",
    title: "Your prep has a clear finish line",
    detail: "Company context and examples saved",
    nextLabel: "Remaining",
    nextAction: "Write two questions to ask",
    icon: ClipboardCheck,
  },
  {
    key: "act",
    label: "Act",
    eyebrow: "Action center",
    status: "Due today",
    statusTone: "bg-danger-soft text-danger",
    title: "The next move is visible",
    detail: "Interview completed · Follow-up pending",
    nextLabel: "Do now",
    nextAction: "Send a thoughtful follow-up",
    icon: BellRing,
  },
] as const;

type HeroStep = (typeof heroSteps)[number];

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function StoryCard({ step, compact = false }: { step: HeroStep; compact?: boolean }) {
  const Icon = step.icon;
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
        <span className={`max-w-24 shrink-0 rounded-full px-2.5 py-1 text-center text-[0.68rem] font-bold leading-4 ${step.statusTone}`}>{step.status}</span>
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
  const reducedMotion = useReducedMotionPreference();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setActiveIndex(heroSteps.length - 1);
      return;
    }
    if (paused) return;
    const timer = window.setTimeout(
      () => setActiveIndex((current) => (current + 1) % heroSteps.length),
      STORY_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion]);

  const activeStep = heroSteps[activeIndex];

  return (
    <figure
      className="relative mx-auto min-w-0 w-full max-w-xl lg:mx-0"
      aria-labelledby="hero-story-caption"
      data-hero-story
      data-story-step={activeStep.key}
      data-landing-clip-check
    >
      <div aria-hidden="true" className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-gradient-to-br from-cyan-200/60 to-violet-200/60 blur-sm dark:from-cyan-950/50 dark:to-violet-950/50 sm:-inset-5 sm:rounded-[2.25rem]" />
      <div className="overflow-hidden rounded-3xl border border-line-strong bg-surface-raised shadow-panel dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-4 dark:border-slate-700 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink-muted">Northstar Labs</p>
            <p className="mt-1 truncate text-sm font-bold text-ink dark:text-white sm:text-base">Senior Frontend Platform Engineer</p>
          </div>
          {!reducedMotion ? (
            <button
              type="button"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              aria-label={paused ? "Play application story" : "Pause application story"}
              onClick={() => setPaused((current) => !current)}
            >
              {paused ? <CirclePlay aria-hidden="true" className="size-5" /> : <CirclePause aria-hidden="true" className="size-5" />}
            </button>
          ) : null}
        </div>

        <div className="bg-surface-muted p-4 dark:bg-slate-950/60 sm:p-5">
          <ol className="grid grid-cols-4 gap-1.5" aria-label="Application story stages">
            {heroSteps.map((step, index) => {
              const reached = reducedMotion || index <= activeIndex;
              const current = index === activeIndex;
              return (
                <li key={step.key} aria-current={current ? "step" : undefined} className="min-w-0">
                  <span className={`block h-1.5 rounded-full transition-colors duration-300 ${reached ? "bg-accent" : "bg-line"}`} />
                  <span className={`mt-2 block truncate text-[0.62rem] font-bold sm:text-[0.68rem] ${current ? "text-ink" : "text-ink-muted"}`}>{step.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 min-h-[14.5rem] sm:min-h-[15rem]" aria-live="off">
            <div key={activeStep.key} className="hf-story-swap">
              <StoryCard step={activeStep} />
              <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-ink-muted">
                <Sparkles aria-hidden="true" className="size-3.5 text-accent-strong" />
                One opportunity, connected from capture to action.
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption id="hero-story-caption" className="sr-only">Northstar Labs moves from captured opportunity to application progress, interview preparation, and a clear follow-up action.</figcaption>
    </figure>
  );
}

const proofSteps = [
  {
    key: "capture",
    number: "01",
    label: "Capture",
    title: "Turn a job post into an opportunity",
    description: "Keep the role, source, work mode, compensation context, and follow-up date in one reliable record.",
    result: "Captured from a referral",
    question: "What needs a decision?",
    answer: "Review the role and submit by Friday.",
    icon: BriefcaseBusiness,
  },
  {
    key: "move",
    number: "02",
    label: "Move",
    title: "Carry context into every conversation",
    description: "Advance through valid stages, schedule the technical screen, and keep preparation attached to the same opportunity.",
    result: "Interview · September 2",
    question: "What should I prepare?",
    answer: "Finish one checklist item and two candidate questions.",
    icon: MessageSquareText,
  },
  {
    key: "learn",
    number: "03",
    label: "Learn",
    title: "Use history to choose the next move",
    description: "See the milestones that already happened and let the action center surface what deserves attention now.",
    result: "Follow-up due today",
    question: "What should I do next?",
    answer: "Send a concise follow-up while the interview is fresh.",
    icon: BellRing,
  },
] as const;

type ProofStep = (typeof proofSteps)[number];

function ProofSnapshot({ step }: { step: ProofStep }) {
  const Icon = step.icon;
  return (
    <div className="min-w-0 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900 sm:p-7" data-landing-clip-check>
      <div className="flex min-w-0 items-center gap-3 border-b border-line pb-5 dark:border-slate-700">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong"><Icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-muted">Northstar Labs</p>
          <p className="truncate text-sm font-bold text-ink dark:text-white">Senior Frontend Platform Engineer</p>
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
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = visible ? Number((visible.target as HTMLElement).dataset.proofIndex) : -1;
        if (index >= 0) setActiveIndex(index);
      },
      { rootMargin: "-30% 0px -45%", threshold: [0.2, 0.55] },
    );
    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="mt-12 hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-12 lg:grid" data-testid="desktop-product-story">
        <ol className="space-y-6">
          {proofSteps.map((step, index) => (
            <li key={step.key}>
              <article
                ref={(node) => { stepRefs.current[index] = node; }}
                data-proof-index={index}
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
            <div key={proofSteps[activeIndex].key} className="hf-story-swap"><ProofSnapshot step={proofSteps[activeIndex]} /></div>
          </div>
        </div>
      </div>

      <ol className="mt-10 space-y-6 lg:hidden" data-testid="mobile-product-story">
        {proofSteps.map((step) => (
          <li key={step.key} className="min-w-0">
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
