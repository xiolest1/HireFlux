import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDemoSession } from "../auth/demoSessionContext";
import { useMe } from "../features/applications/queries";
import { Button } from "./ui/Button";
import { ThemeToggle } from "./ui/ThemeToggle";
import { useModalFocus } from "./ui/useModalFocus";

function navClassName({ isActive }: { isActive: boolean }): string {
  return `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-brand-50 text-brand-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
  }`;
}

function useExpiryLabel(expiresAt: string | undefined): {
  label: string;
  isExpiringSoon: boolean;
} {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!expiresAt) return { label: "Temporary workspace", isExpiringSoon: false };
  const minutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 60_000),
  );
  if (minutes < 60) {
    return {
      label: `Expires in ${minutes} min`,
      isExpiringSoon: true,
    };
  }
  const hours = Math.ceil(minutes / 60);
  return {
    label: `Expires in ${hours} hr`,
    isExpiringSoon: hours <= 2,
  };
}

export function AppLayout() {
  const navigate = useNavigate();
  const meQuery = useMe();
  const { session, reset, exit, isCreating, error } = useDemoSession();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const resetDialogRef = useRef<HTMLElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const expiry = useExpiryLabel(session?.expires_at);

  function closeResetDialog() {
    if (!isCreating) setConfirmingReset(false);
  }

  useModalFocus({
    isOpen: confirmingReset,
    containerRef: resetDialogRef,
    initialFocusRef: resetButtonRef,
    onClose: closeResetDialog,
  });

  async function resetWorkspace() {
    try {
      await reset();
      setConfirmingReset(false);
      navigate("/applications", {
        replace: true,
        state: { notice: "Demo workspace reset." },
      });
    } catch {
      return;
    }
  }

  function exitWorkspace() {
    exit();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <NavLink
            to="/applications"
            className="flex items-center gap-2.5 rounded-lg font-bold tracking-tight text-slate-950"
            aria-label="HireFlux applications"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white shadow-sm"
            >
              HF
            </span>
            <span className="hidden sm:inline">HireFlux</span>
          </NavLink>

          <nav className="sm:ml-2" aria-label="Primary navigation">
            <NavLink to="/applications" className={navClassName}>
              Applications
            </NavLink>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span
              className={`hidden rounded-full border px-2.5 py-1 text-xs font-bold md:inline-flex ${
                expiry.isExpiringSoon
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-sky-200 bg-sky-50 text-sky-800"
              }`}
            >
              {expiry.label}
            </span>
            {meQuery.isPending ? (
              <span className="hidden text-sm text-slate-500 sm:inline" role="status">
                Connecting…
              </span>
            ) : meQuery.isError ? (
              <button
                type="button"
                onClick={() => void meQuery.refetch()}
                className="hidden min-h-11 rounded-lg px-2 text-sm font-semibold text-rose-700 underline decoration-rose-300 underline-offset-4 sm:inline"
              >
                Reconnect
              </button>
            ) : (
              <div className="hidden min-w-0 text-right lg:block">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {meQuery.data.name}
                </p>
                <p className="truncate text-xs text-slate-500">Isolated demo</p>
              </div>
            )}
            <button
              ref={resetTriggerRef}
              type="button"
              aria-label="Reset demo"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setConfirmingReset(true)}
            >
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset demo</span>
            </button>
          </div>
        </div>
      </header>

      {expiry.isExpiringSoon ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
          This workspace {expiry.label.toLowerCase()}. Save any changes you want to try now.
        </div>
      ) : null}

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      >
        <Outlet />
      </main>

      {confirmingReset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResetDialog();
          }}
        >
          <section
            ref={resetDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-demo-title"
            aria-describedby="reset-demo-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              Fresh workspace
            </p>
            <h2 id="reset-demo-title" className="mt-2 text-xl font-bold text-slate-950">
              Reset this demo?
            </h2>
            <p id="reset-demo-description" className="mt-3 text-sm leading-6 text-slate-600">
              You will switch to a newly seeded, isolated workspace. The applications in
              this workspace will no longer be visible in this browser session.
            </p>
            {error ? (
              <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
                {error instanceof Error
                  ? error.message
                  : "The workspace could not be reset. Please try again."}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={isCreating}
                onClick={closeResetDialog}
              >
                Cancel
              </Button>
              <button
                type="button"
                className="min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                disabled={isCreating}
                onClick={exitWorkspace}
              >
                Exit demo
              </button>
              <Button
                ref={resetButtonRef}
                disabled={isCreating}
                onClick={() => void resetWorkspace()}
              >
                {isCreating ? "Resetting…" : "Reset workspace"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
