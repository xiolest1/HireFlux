import { NavLink, Outlet } from "react-router-dom";
import { useMe } from "../features/applications/queries";

function navClassName({ isActive }: { isActive: boolean }): string {
  return `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-brand-50 text-brand-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
  }`;
}

export function AppLayout() {
  const meQuery = useMe();

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
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

          <nav className="ml-2" aria-label="Primary navigation">
            <NavLink to="/applications" className={navClassName}>
              Applications
            </NavLink>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 sm:inline-flex">
              Local workspace
            </span>
            {meQuery.isPending ? (
              <span className="text-sm text-slate-500" role="status">
                Connecting…
              </span>
            ) : meQuery.isError ? (
              <button
                type="button"
                onClick={() => void meQuery.refetch()}
                className="min-h-11 rounded-lg px-2 text-sm font-semibold text-rose-700 underline decoration-rose-300 underline-offset-4"
              >
                Reconnect
              </button>
            ) : (
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {meQuery.data.name}
                </p>
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {meQuery.data.email}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      >
        <Outlet />
      </main>
    </div>
  );
}
