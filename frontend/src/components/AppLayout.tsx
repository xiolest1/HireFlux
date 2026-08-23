import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Home,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useDemoSession } from "../auth/demoSessionContext";
import { useMe } from "../features/applications/queries";
import {
  useAutoDetectTimeZone,
  useSettings,
  useUpdateSettings,
} from "../features/resources/queries";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Drawer } from "./ui/Drawer";
import { LoadingState } from "./ui/Feedback";
import { ThemeToggle } from "./ui/ThemeToggle";
import { ToastProvider } from "./ui/Toast";
import {
  applyTheme,
  setColorThemePreference,
  storedThemePreference,
} from "./ui/themePreference";

const SIDEBAR_STORAGE_KEY = "hireflux-sidebar-collapsed";
const RECRUITER_GUIDE_STORAGE_KEY = "hireflux-recruiter-guide";

interface NavigationItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

const primaryNavigation: readonly NavigationItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  {
    to: "/applications",
    label: "Applications",
    shortLabel: "Apps",
    icon: BriefcaseBusiness,
  },
  { to: "/interviews", label: "Interviews", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function routeTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Home";
  if (pathname === "/applications/new") return "Add application";
  if (/^\/applications\/[^/]+\/edit$/.test(pathname)) return "Edit application";
  if (/^\/applications\/[^/]+$/.test(pathname)) return "Application overview";
  if (pathname === "/applications") return "Applications";
  if (pathname === "/interviews") return "Interviews";
  if (pathname === "/analytics") return "Analytics";
  if (pathname === "/settings") return "Settings";
  return "Workspace";
}

function readSidebarPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function navClassName(
  { isActive }: { isActive: boolean },
): string {
  return `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-[color,background-color,box-shadow] duration-200 ${
    isActive
      ? "bg-accent-soft text-accent-strong shadow-sm ring-1 ring-accent/15"
      : "text-ink-muted hover:bg-surface-muted hover:text-ink"
  }`;
}

function sidebarNavClassName(
  { isActive }: { isActive: boolean },
  collapsed: boolean,
): string {
  return `${navClassName({ isActive })} md:justify-center md:gap-0 md:px-0 ${
    collapsed
      ? "lg:justify-center lg:gap-0 lg:px-0"
      : "lg:justify-start lg:gap-3 lg:px-3"
  }`;
}

function mobileNavClassName({ isActive }: { isActive: boolean }): string {
  return `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-semibold transition-colors ${
    isActive ? "text-accent" : "text-ink-muted hover:text-ink"
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
    return { label: `Expires in ${minutes} min`, isExpiringSoon: true };
  }
  const hours = Math.ceil(minutes / 60);
  return { label: `Expires in ${hours} hr`, isExpiringSoon: hours <= 2 };
}

function clearRecruiterGuide() {
  try {
    window.sessionStorage.removeItem(RECRUITER_GUIDE_STORAGE_KEY);
  } catch {
    // The workspace can still be reset or exited when storage is unavailable.
  }
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, status, reset, exit, isCreating, error } = useDemoSession();
  const identityReady = status === "active";
  const meQuery = useMe({ enabled: identityReady });
  const settingsQuery = useSettings({ enabled: identityReady });
  const updateSettingsMutation = useUpdateSettings();
  useAutoDetectTimeZone(settingsQuery.data, identityReady);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tabletNavOpen, setTabletNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const tabletNavTriggerRef = useRef<HTMLButtonElement>(null);
  const resetErrorRef = useRef<HTMLParagraphElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const expiry = useExpiryLabel(session?.expires_at);
  const currentRouteTitle = routeTitle(location.pathname);

  useEffect(() => {
    if (!settingsQuery.data) return;
    if (
      settingsQuery.data.theme === "SYSTEM" &&
      storedThemePreference() === null
    ) {
      applyTheme("dark");
      return;
    }
    setColorThemePreference(settingsQuery.data.theme);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (confirmingReset && error) resetErrorRef.current?.focus();
  }, [confirmingReset, error]);

  useEffect(() => {
    document.title = `${currentRouteTitle} · HireFlux`;
    if (!navigator.userAgent.toLowerCase().includes("jsdom")) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    const main = mainRef.current;
    if (!main) return;
    let focused = false;
    const focusHeading = () => {
      if (focused) return;
      const heading = main.querySelector<HTMLElement>("h1");
      if (!heading) return;
      focused = true;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      heading.addEventListener(
        "blur",
        () => heading.removeAttribute("tabindex"),
        { once: true },
      );
    };
    focusHeading();
    const observer = new MutationObserver(focusHeading);
    if (!focused) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [currentRouteTitle, location.pathname]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // The sidebar still changes for the current page.
      }
      return next;
    });
  }

  function closeResetDialog() {
    if (!isCreating) setConfirmingReset(false);
  }

  function requestReset() {
    setMoreOpen(false);
    setConfirmingReset(true);
  }

  async function resetWorkspace() {
    try {
      await reset();
      clearRecruiterGuide();
      setConfirmingReset(false);
      navigate("/dashboard", {
        replace: true,
        state: { notice: "Demo workspace reset." },
      });
    } catch {
      return;
    }
  }

  function exitWorkspace() {
    clearRecruiterGuide();
    exit();
    navigate("/", { replace: true });
  }

  async function persistHeaderTheme(theme: "LIGHT" | "DARK") {
    if (!settingsQuery.data) return;
    await updateSettingsMutation.mutateAsync({
      expected_version: settingsQuery.data.version,
      theme,
    });
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas text-ink md:flex">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[70] -translate-y-24 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast shadow-float focus:translate-y-0"
        >
          Skip to content
        </a>

        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface/95 backdrop-blur-xl transition-[width] duration-200 md:flex md:w-[4.5rem] ${
            sidebarCollapsed ? "lg:w-[4.5rem]" : "lg:w-60"
          }`}
          aria-label="Workspace navigation"
        >
          <div className="flex min-h-20 items-center border-b border-line px-4">
            <NavLink
              to="/dashboard"
              className="flex min-w-0 items-center gap-3 rounded-xl text-ink"
              aria-label="HireFlux home"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/15"
              >
                HF
              </span>
              {!sidebarCollapsed ? (
                <span className="hidden font-display text-lg font-bold tracking-tight lg:inline">
                  HireFlux
                </span>
              ) : null}
            </NavLink>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 px-3 py-5">
            <Link
              to="/applications/new"
              className={`flex min-h-11 items-center justify-center rounded-xl bg-accent px-3 text-sm font-bold text-accent-contrast shadow-sm transition-[background-color,transform] duration-200 hover:bg-accent-strong active:scale-[0.98] md:gap-0 md:px-0 ${
                sidebarCollapsed
                  ? "lg:gap-0 lg:px-0"
                  : "lg:gap-2 lg:px-3"
              }`}
              aria-label="Add application"
              title="Add application"
            >
              <Plus aria-hidden="true" className="size-5 shrink-0" />
              {!sidebarCollapsed ? <span className="hidden lg:inline">Add application</span> : null}
            </Link>

            <nav className="space-y-1" aria-label="Primary navigation">
              {primaryNavigation.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={(state) => sidebarNavClassName(state, sidebarCollapsed)}
                  aria-label={label}
                  title={label}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
                  {!sidebarCollapsed ? <span className="hidden lg:inline">{label}</span> : null}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="space-y-3 border-t border-line p-3">
            {!sidebarCollapsed ? (
              <div className="hidden rounded-xl bg-surface-muted p-3 lg:block">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-violet">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {meQuery.data?.name ?? (meQuery.isError ? "Demo guest" : "Connecting…")}
                    </p>
                    <p className="truncate text-xs text-ink-muted">Isolated demo</p>
                  </div>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`hidden min-h-10 w-full items-center justify-center rounded-xl font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink lg:flex ${
                sidebarCollapsed
                  ? "text-sm"
                  : "gap-2 text-sm"
              }`}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen aria-hidden="true" className="size-5" />
              ) : (
                <>
                  <PanelLeftClose aria-hidden="true" className="size-5" />
                  <span>Collapse</span>
                </>
              )}
            </button>
            <button
              ref={tabletNavTriggerRef}
              type="button"
              onClick={() => setTabletNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={tabletNavOpen}
              aria-controls="tablet-navigation-drawer"
              title="Open navigation"
              className="hidden min-h-10 w-full items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink md:flex lg:hidden"
            >
              <PanelLeftOpen aria-hidden="true" className="size-5" />
            </button>
          </div>
        </aside>

        <Drawer
          id="tablet-navigation-drawer"
          open={tabletNavOpen}
          onClose={() => setTabletNavOpen(false)}
          title="Workspace navigation"
          description="Navigate your isolated HireFlux demo workspace."
          size="sm"
          placement="left"
          sideBreakpoint="md"
        >
          <Link
            to="/applications/new"
            onClick={() => setTabletNavOpen(false)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-bold text-accent-contrast shadow-sm transition-[background-color,transform] duration-200 hover:bg-accent-strong active:scale-[0.98]"
          >
            <Plus aria-hidden="true" className="size-5 shrink-0" />
            <span>Add application</span>
          </Link>

          <nav className="mt-5 space-y-1" aria-label="Primary navigation">
            {primaryNavigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setTabletNavOpen(false)}
                className={navClassName}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 border-t border-line pt-5">
            <div className="rounded-xl bg-surface-muted p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-violet">
                  <UserRound aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {meQuery.data?.name ?? (meQuery.isError ? "Demo guest" : "Connecting…")}
                  </p>
                  <p className="truncate text-xs text-ink-muted">Isolated demo</p>
                </div>
              </div>
            </div>
          </div>
        </Drawer>

        <div className="min-w-0 flex-1">
          <header className="hf-glass sticky top-0 z-30 border-b">
            <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 md:min-h-14 lg:px-8">
              <NavLink
                to="/dashboard"
                className="flex items-center gap-2.5 rounded-xl md:hidden"
                aria-label="HireFlux home"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-slate-950"
                >
                  HF
                </span>
                <span className="font-display font-bold tracking-tight text-ink">HireFlux</span>
              </NavLink>

              <div className="hidden min-w-0 items-center gap-2 md:flex">
                <Sparkles aria-hidden="true" className="size-4 text-accent" />
                <p className="truncate text-sm font-semibold text-ink">{currentRouteTitle}</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span
                  className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold sm:inline-flex ${
                    expiry.isExpiringSoon
                      ? "border-warning/30 bg-warning-soft text-warning"
                      : "border-accent/25 bg-accent-soft text-accent-strong"
                  }`}
                >
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {expiry.label}
                </span>
                <div className="hidden lg:block">
                  <ThemeToggle
                    disabled={settingsQuery.isPending || updateSettingsMutation.isPending}
                    onPreferenceChange={
                      settingsQuery.data ? persistHeaderTheme : undefined
                    }
                  />
                </div>
                <button
                  ref={resetTriggerRef}
                  type="button"
                  aria-label="Reset demo"
                  className="hidden min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-muted hover:text-ink lg:inline-flex"
                  onClick={() => setConfirmingReset(true)}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Reset demo
                </button>
              </div>
            </div>
          </header>

          {expiry.isExpiringSoon ? (
            <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning">
              This workspace {expiry.label.toLowerCase()}. Save any changes you want to try now.
            </div>
          ) : null}

          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {currentRouteTitle} page loaded
          </p>

          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[100rem] px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10 lg:px-8 lg:py-10 xl:px-10"
          >
            {status === "replacing" ? (
              <LoadingState label="Preparing a fresh demo workspace..." />
            ) : (
              <Outlet />
            )}
          </main>
        </div>

        <nav
          className="hf-glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
          aria-label="Mobile navigation"
        >
          {primaryNavigation.slice(0, 2).map(({ to, label, shortLabel, icon: Icon }) => (
            <NavLink key={to} to={to} className={mobileNavClassName}>
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
              <span>{shortLabel ?? label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/applications/new"
            aria-label="Add application"
            className="relative flex min-h-14 flex-col items-center justify-end gap-1 pb-1 text-[0.68rem] font-bold text-accent"
          >
            <span className="absolute -top-5 flex size-12 items-center justify-center rounded-2xl border-4 border-canvas bg-accent text-accent-contrast shadow-lg shadow-cyan-950/20">
              <Plus aria-hidden="true" className="size-6" />
            </span>
            <span>Add</span>
          </NavLink>
          <NavLink to="/interviews" className={mobileNavClassName}>
            <CalendarDays aria-hidden="true" className="size-5" strokeWidth={1.8} />
            <span>Interviews</span>
          </NavLink>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-semibold transition-colors ${
              location.pathname === "/analytics" || location.pathname === "/settings"
                ? "text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
            aria-label="More navigation"
          >
            <MenuIcon aria-hidden="true" className="size-5" strokeWidth={1.8} />
            <span>More</span>
          </button>
        </nav>

        <Drawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title="Workspace"
          description="Demo tools, insights, and preferences."
          size="sm"
        >
          <div className="rounded-2xl border border-line bg-surface-muted p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet-soft text-violet">
                <UserRound aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                {meQuery.isPending ? (
                  <p className="text-sm font-semibold text-ink-muted" role="status">
                    Connecting…
                  </p>
                ) : meQuery.isError ? (
                  <button
                    type="button"
                    onClick={() => void meQuery.refetch()}
                    className="text-sm font-semibold text-danger underline underline-offset-4"
                  >
                    Reconnect
                  </button>
                ) : (
                  <p className="truncate text-sm font-semibold text-ink">{meQuery.data.name}</p>
                )}
                <p className="truncate text-xs text-ink-muted">Isolated recruiter demo</p>
              </div>
            </div>
            <p
              className={`mt-3 flex items-center gap-2 text-xs font-semibold ${
                expiry.isExpiringSoon ? "text-warning" : "text-ink-muted"
              }`}
            >
              <Clock3 aria-hidden="true" className="size-4" />
              {expiry.label}
            </p>
          </div>

          <nav className="mt-5 space-y-1" aria-label="More navigation links">
            <NavLink
              to="/analytics"
              className={navClassName}
              onClick={() => setMoreOpen(false)}
            >
              <BarChart3 aria-hidden="true" className="size-5" />
              Analytics
            </NavLink>
            <NavLink
              to="/settings"
              className={navClassName}
              onClick={() => setMoreOpen(false)}
            >
              <Settings aria-hidden="true" className="size-5" />
              Settings
            </NavLink>
          </nav>

          <div className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Appearance</p>
                <p className="text-xs text-ink-muted">Switch the active color mode</p>
              </div>
              <ThemeToggle
                disabled={settingsQuery.isPending || updateSettingsMutation.isPending}
                onPreferenceChange={settingsQuery.data ? persistHeaderTheme : undefined}
              />
            </div>
            <button
              type="button"
              className="mt-5 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              onClick={requestReset}
            >
              <RotateCcw aria-hidden="true" className="size-5" />
              Reset demo
            </button>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
              onClick={exitWorkspace}
            >
              <LogOut aria-hidden="true" className="size-5" />
              Exit demo
            </button>
          </div>
        </Drawer>

        <Dialog
          open={confirmingReset}
          onClose={closeResetDialog}
          title="Reset this demo?"
          description="You will switch to a newly seeded, isolated workspace. The applications in this workspace will no longer be visible in this browser session."
          initialFocusRef={resetButtonRef}
          role="alertdialog"
        >
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Fresh workspace
          </p>
          {error ? (
            <p
              ref={resetErrorRef}
              className="mt-3 text-sm font-medium text-danger"
              role="alert"
              tabIndex={-1}
              aria-live="assertive"
              aria-atomic="true"
            >
              Unable to reset demo. Your existing demo workspace is still available.{" "}
              {error instanceof Error
                ? error.message
                : "Please try again."}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={isCreating} onClick={closeResetDialog}>
              Cancel
            </Button>
            <button
              type="button"
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
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
              {isCreating ? "Resetting…" : error ? "Try again" : "Reset workspace"}
            </Button>
          </div>
        </Dialog>
      </div>
    </ToastProvider>
  );
}
