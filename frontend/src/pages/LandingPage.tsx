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
  const requestedPath =
    typeof state.from === "string" &&
    (state.from === "/applications" || state.from.startsWith("/applications/"))
      ? state.from
      : undefined;
  return {
    from: requestedPath,
    reason:
      state.reason === "required" || state.reason === "expired"
        ? state.reason
        : undefined,
  };
}

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, isCreating, error, start } = useDemoSession();
  const routeState = locationState(location.state);

  async function enterDemo() {
    if (status === "active") {
      navigate(routeState.from ?? "/applications");
      return;
    }
    try {
      await start();
      navigate(routeState.from ?? "/applications", { replace: true });
    } catch {
      return;
    }
  }

  const notice =
    routeState.reason === "expired" || status === "expired"
      ? "Your previous demo workspace expired. Start a fresh one to keep exploring."
      : routeState.reason === "required"
        ? "Start a demo workspace to explore the page."
        : null;

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f8fa] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <a
        href="#landing-main"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 font-bold tracking-tight">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white shadow-sm"
            >
              HF
            </span>
            <span>HireFlux</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-600 sm:inline-flex">
              Recruiter demo
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="landing-main">
        <section className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.17),transparent_32rem),radial-gradient(circle_at_82%_4%,rgba(14,116,144,0.13),transparent_28rem)]"
          />
          <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">
                A focused job-search workspace
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-6xl sm:leading-[1.03]">
                Keep every opportunity moving forward.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Explore a realistic HireFlux workspace with applications, status
                transitions, follow-ups, and an auditable activity timeline—without
                creating an account.
              </p>

              {notice ? (
                <div
                  className="mt-7 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
                  role="status"
                >
                  {notice}
                </div>
              ) : null}
              {error ? (
                <div className="mt-7 max-w-xl">
                  <ErrorPanel
                    compact
                    title="Demo workspace could not be prepared"
                    error={error}
                  />
                </div>
              ) : null}

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button
                  className="min-w-48 shadow-lg shadow-blue-900/10"
                  disabled={isCreating}
                  onClick={() => void enterDemo()}
                >
                  {isCreating
                    ? "Preparing your workspace…"
                    : status === "active"
                      ? "Continue Demo"
                      : "Explore the Demo"}
                </Button>
                <p className="text-sm leading-6 text-slate-500">
                  No sign-up · Fictional data · Resets anytime
                </p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-brand-100/70" />
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.14)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Demo workspace
                    </p>
                    <p className="mt-1 font-bold text-slate-950">Applications</p>
                  </div>
                  <span className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">
                    + New
                  </span>
                </div>
                <div className="space-y-3 bg-slate-50/80 p-4 sm:p-5">
                  {[
                    ["Juniper Systems", "Platform Engineer", "Offer", "emerald"],
                    ["Cedar Analytics", "Senior Product Analyst", "Interview", "violet"],
                    ["Atlas Health", "Frontend Engineer", "Applied", "sky"],
                  ].map(([company, role, stage, tone]) => (
                    <article
                      key={company}
                      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div
                        aria-hidden="true"
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white"
                      >
                        {company.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-950">{role}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{company}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          tone === "emerald"
                            ? "bg-emerald-100 text-emerald-800"
                            : tone === "violet"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {stage}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-px bg-slate-200 sm:grid-cols-3">
            {[
              ["Isolated by design", "Every visitor receives a separate temporary workspace."],
              ["Ready to explore", "Five fictional opportunities arrive across realistic stages."],
              ["Safe to experiment", "Edit, archive, restore, or reset without affecting anyone else."],
            ].map(([title, description]) => (
              <div key={title} className="bg-white px-6 py-9 lg:px-8">
                <p className="font-bold text-slate-950">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>HireFlux · Portfolio demonstration</p>
        <p>Temporary workspaces expire automatically after 24 hours.</p>
      </footer>
    </div>
  );
}
