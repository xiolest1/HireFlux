import { ArrowRight, Check, Clock3, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDemoSession } from "../auth/demoSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel } from "../components/ui/Feedback";
import { ThemeToggle } from "../components/ui/ThemeToggle";

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
    <div className="min-h-screen overflow-hidden bg-canvas text-ink dark:bg-slate-950 dark:text-slate-50">
      <a href="#landing-main" className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0">Skip to content</a>
      <header className="relative z-20 border-b border-line bg-surface/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 font-bold tracking-tight"><span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-brand-700 text-sm font-black text-white shadow-lg shadow-cyan-950/10">HF</span><span>HireFlux</span></div>
          <div className="flex items-center gap-2 sm:gap-3"><span className="hidden rounded-full border border-line bg-surface-raised px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted dark:border-slate-700 dark:bg-slate-900 sm:inline-flex">Demo workspace</span><ThemeToggle /></div>
        </div>
      </header>

      <main id="landing-main">
        <section className="relative isolate">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.08),transparent_28rem),radial-gradient(circle_at_82%_4%,rgba(139,92,246,0.07),transparent_30rem)] dark:bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.12),transparent_28rem),radial-gradient(circle_at_82%_4%,rgba(139,92,246,0.13),transparent_30rem)]" />
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-accent-strong shadow-sm backdrop-blur dark:border-cyan-900 dark:bg-slate-900/70"><Sparkles aria-hidden="true" className="size-3.5" />A focused job-search workspace</p>
              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-6xl sm:leading-[1.03] dark:text-white">Keep every opportunity moving forward.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">Turn scattered applications into a clear, actionable search. Explore realistic status changes, follow-ups, interviews, and an auditable activity history—without creating an account.</p>

              {notice ? <div className="mt-7 max-w-xl rounded-xl border border-line border-l-4 border-l-warning bg-warning-soft px-4 py-3 text-sm font-medium text-warning" role="status">{notice}</div> : null}
              {error ? <div className="mt-7 max-w-xl"><ErrorPanel compact title="Demo workspace could not be prepared" error={error} /></div> : null}

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button className="min-w-48 gap-2 shadow-lg shadow-cyan-950/10" disabled={isCreating} onClick={() => void enterDemo()}>{isCreating ? "Preparing your workspace…" : status === "active" ? "Continue Demo" : "Explore the Demo"}<ArrowRight aria-hidden="true" className="size-4" /></Button>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">No sign-up · Fictional data · Resets anytime</p>
              </div>
            </div>

            <figure className="relative mx-auto w-full max-w-xl lg:mx-0" aria-label="Decorative preview of the HireFlux applications workspace">
              <div aria-hidden="true" className="absolute -inset-5 -z-10 rotate-2 rounded-[2.25rem] bg-gradient-to-br from-cyan-200/60 to-violet-200/60 blur-sm dark:from-cyan-950/50 dark:to-violet-950/50" />
              <div className="overflow-hidden rounded-3xl border border-line-strong bg-surface-raised shadow-panel dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-slate-700"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Demo workspace</p><p className="mt-1 font-bold text-ink dark:text-white">Needs attention</p></div><span className="rounded-full bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger">3 actions</span></div>
                <div className="space-y-3 bg-surface-muted p-4 sm:p-5 dark:bg-slate-950/60">
                  {[
                    ["Juniper Systems", "Platform Engineer", "Offer", "Follow up today", "emerald"],
                    ["Cedar Analytics", "Senior Product Analyst", "Interview", "Tomorrow · 10:00 AM", "violet"],
                    ["Atlas Health", "Frontend Engineer", "Applied", "Waiting 6 days", "sky"],
                  ].map(([company, role, stage, next, tone]) => (
                    <div key={company} className="flex items-center gap-4 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white dark:bg-slate-700">{company.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink dark:text-white">{role}</p><p className="mt-0.5 truncate text-xs text-ink-muted dark:text-slate-400">{company}</p><p className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-ink-muted"><Clock3 aria-hidden="true" className="size-3" />{next}</p></div><span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold ${tone === "emerald" ? "bg-emerald-100 text-emerald-800" : tone === "violet" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{stage}</span></div>
                  ))}
                </div>
              </div>
              <figcaption className="sr-only">A sample action center showing fictional job applications in offer, interview, and applied stages.</figcaption>
            </figure>
          </div>
        </section>

        <section className="border-y border-line bg-surface dark:border-slate-800 dark:bg-slate-900/80" aria-label="Demo guarantees">
          <div className="mx-auto grid max-w-7xl gap-px bg-line dark:bg-slate-800 sm:grid-cols-3">
            {[
              [ShieldCheck, "Isolated by design", "Every visitor receives a separate temporary workspace."],
              [Layers3, "Ready to explore", "Sixteen fictional opportunities cover realistic stages and outcomes."],
              [Check, "Safe to experiment", "Edit, archive, restore, or reset without affecting anyone else."],
            ].map(([Icon, title, description]) => <article key={String(title)} className="bg-surface px-6 py-9 dark:bg-slate-900 lg:px-8"><Icon aria-hidden="true" className="size-5 text-brand-700" /><h2 className="mt-4 font-bold text-ink dark:text-white">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-muted dark:text-slate-300">{String(description)}</p></article>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="proof-title">
          <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Product proof</p><h2 id="proof-title" className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">A clearer loop from application to outcome.</h2><p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">HireFlux keeps the next decision visible while preserving the history behind every application.</p></div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">{[
            ["01", "Capture the opportunity", "Store role details, source, work mode, salary context, and the next follow-up."],
            ["02", "Move with confidence", "Use server-approved status transitions, schedule interviews, and preserve useful notes."],
            ["03", "Learn from the search", "Review historical milestones and descriptive outcomes with honest denominators."],
          ].map(([number, title, description]) => <li key={number} className="rounded-3xl border border-line bg-surface-raised p-6 shadow-panel dark:border-slate-800 dark:bg-slate-900"><span className="text-sm font-black text-brand-700">{number}</span><h3 className="mt-6 text-lg font-bold text-ink dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-muted dark:text-slate-300">{description}</p></li>)}</ol>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-white shadow-2xl sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 dark:border dark:border-slate-800">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(34,211,238,0.2),transparent_22rem),radial-gradient(circle_at_90%_80%,rgba(139,92,246,0.24),transparent_25rem)]" />
            <div className="relative"><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Try the real workflow</p><h2 className="mt-3 text-3xl font-black tracking-tight">See how the workspace feels in your hands.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Your temporary environment is private, pre-populated, and ready in one click.</p></div>
            <Button className="relative mt-7 shrink-0 gap-2 lg:mt-0" disabled={isCreating} onClick={() => void enterDemo()}>{status === "active" ? "Return to Workspace" : "Start Demo Workspace"}<ArrowRight aria-hidden="true" className="size-4" /></Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-line px-4 py-8 text-sm text-ink-muted dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><p>HireFlux · Portfolio demonstration</p><p>Temporary workspaces expire automatically after 24 hours.</p></footer>
    </div>
  );
}
