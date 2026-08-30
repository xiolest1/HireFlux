import { ArrowRight, Check, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDemoSession } from "../auth/demoSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel } from "../components/ui/Feedback";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { HeroApplicationStory, LandingReveal } from "../features/landing/LandingProductStory";
import { ScrollProductStory } from "../features/landing/ScrollProductStory";

interface LandingLocationState {
  from?: string;
  reason?: "required" | "expired";
}

function locationState(value: unknown): LandingLocationState {
  if (!value || typeof value !== "object") return {};
  const state = value as Record<string, unknown>;
  const candidatePath = typeof state.from === "string" ? state.from : undefined;
  const requestedPath = candidatePath && ["/dashboard", "/applications", "/interviews", "/analytics", "/settings"].some((path) => candidatePath === path || candidatePath.startsWith(`${path}/`)) ? candidatePath : undefined;
  return { from: requestedPath, reason: state.reason === "required" || state.reason === "expired" ? state.reason : undefined };
}

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, isCreating, error, start } = useDemoSession();
  const routeState = locationState(location.state);

  async function enterDemo() {
    if (status === "active") {
      navigate(routeState.from ?? "/dashboard");
      return;
    }
    try {
      await start();
      navigate(routeState.from ?? "/dashboard", { replace: true });
    } catch {
      return;
    }
  }

  const notice = routeState.reason === "expired" || status === "expired"
    ? "Your previous demo workspace expired. Start a fresh one to keep exploring."
    : routeState.reason === "required"
      ? "Start a demo workspace to explore the page."
      : null;

  return (
    <div className="min-h-screen bg-canvas text-ink dark:bg-slate-950 dark:text-slate-50">
      <a href="#landing-main" className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0">Skip to content</a>
      <header className="relative z-20 border-b border-line bg-surface/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" data-landing-clip-check>
          <div className="flex min-w-0 items-center gap-3 font-bold tracking-tight"><span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-brand-700 text-sm font-black text-white shadow-lg shadow-cyan-950/10">HF</span><span className="truncate">HireFlux</span></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3"><span className="hidden rounded-full border border-line bg-surface-raised px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted dark:border-slate-700 dark:bg-slate-900 sm:inline-flex">Demo workspace</span><ThemeToggle /></div>
        </div>
      </header>

      <main id="landing-main">
        <section className="relative isolate overflow-x-clip">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.08),transparent_28rem),radial-gradient(circle_at_82%_4%,rgba(139,92,246,0.07),transparent_30rem)] dark:bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.12),transparent_28rem),radial-gradient(circle_at_82%_4%,rgba(139,92,246,0.13),transparent_30rem)]" />
          <div className="mx-auto grid max-w-7xl min-w-0 gap-12 px-4 py-14 sm:px-6 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:px-8 lg:py-28">
            <div className="min-w-0" data-landing-clip-check>
              <p className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.11em] text-accent-strong shadow-sm backdrop-blur dark:border-cyan-900 dark:bg-slate-900/70 sm:text-xs sm:tracking-[0.16em]"><Sparkles aria-hidden="true" className="size-3.5 shrink-0" />A focused job-search workspace</p>
              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-6xl sm:leading-[1.03] dark:text-white">Keep every opportunity moving forward.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">Capture an opportunity, move it through the search, prepare with context, and act on the next step—without creating an account.</p>

              {notice ? <div className="mt-7 max-w-xl rounded-xl border border-line border-l-4 border-l-warning bg-warning-soft px-4 py-3 text-sm font-medium text-warning" role="status">{notice}</div> : null}
              {error ? <div className="mt-7 max-w-xl"><ErrorPanel compact title="Demo workspace could not be prepared" error={error} /></div> : null}

              <div className="mt-8 flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button className="group min-w-48 gap-2 shadow-lg shadow-cyan-950/10" disabled={isCreating} onClick={() => void enterDemo()}>{isCreating ? "Preparing your workspace…" : status === "active" ? "Continue Demo" : "Explore the Demo"}<ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1" /></Button>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">No sign-up · Fictional data · Resets anytime</p>
              </div>
            </div>
            <HeroApplicationStory />
          </div>
        </section>

        <LandingReveal>
          <section className="border-y border-line bg-surface dark:border-slate-800 dark:bg-slate-900/80" aria-label="Demo guarantees">
            <div className="mx-auto grid max-w-7xl gap-px bg-line dark:bg-slate-800 sm:grid-cols-3">
              {[
                [ShieldCheck, "Isolated by design", "Every visitor receives a separate temporary workspace."],
                [Layers3, "Ready to explore", "Follow one coherent workflow across applications, interviews, notes, and analytics."],
                [Check, "Safe to experiment", "Edit, archive, restore, or reset without affecting anyone else."],
              ].map(([Icon, title, description]) => <article key={String(title)} className="min-w-0 bg-surface px-6 py-9 dark:bg-slate-900 lg:px-8" data-landing-clip-check><Icon aria-hidden="true" className="size-5 text-brand-700" /><h2 className="mt-4 font-bold text-ink dark:text-white">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-muted dark:text-slate-300">{String(description)}</p></article>)}
            </div>
          </section>
        </LandingReveal>

        <LandingReveal className="hf-scroll-story-reveal">
          <section className="mx-auto max-w-7xl min-w-0 px-4 py-16 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="proof-title">
            <div className="max-w-2xl" data-landing-clip-check><p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Connected workspace</p><h2 id="proof-title" className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">The workspace adapts around your search.</h2><p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">See applications become interview context, preparation become a working plan, and the full search return as clear priorities.</p></div>
            <ScrollProductStory ctaDisabled={isCreating} ctaLabel={status === "active" ? "Return to Workspace" : "Start Demo Workspace"} onCta={() => void enterDemo()} />
          </section>
        </LandingReveal>
      </main>

      <footer className="mx-auto flex max-w-7xl min-w-0 flex-col gap-2 border-t border-line px-4 py-8 text-sm text-ink-muted dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8" data-landing-clip-check><p>HireFlux · Candidate job-search demo</p><p>Temporary workspaces expire automatically after 24 hours.</p></footer>
    </div>
  );
}
