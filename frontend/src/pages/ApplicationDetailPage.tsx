import {
  CalendarClock,
  ChevronLeft,
  Clock3,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ApiError } from "../api/client";
import type { Application } from "../api/schemas";
import { Button } from "../components/ui/Button";
import { buttonClassName } from "../components/ui/buttonStyles";
import {
  ErrorPanel,
  SuccessBanner,
} from "../components/ui/Feedback";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useModalFocus } from "../components/ui/useModalFocus";
import { ActivityTimeline } from "../features/applications/ActivityTimeline";
import { ApplicationDetails } from "../features/applications/ApplicationDetails";
import { ApplicationDetailSkeleton } from "../features/applications/ApplicationSkeletons";
import { StatusTransitionForm } from "../features/applications/StatusTransitionForm";
import {
  formatDateOnly,
  formatTimestamp,
} from "../features/applications/format";
import { useApplication } from "../features/applications/queries";
import { InterviewsPanel } from "../features/resources/InterviewsPanel";
import { NotesPanel } from "../features/resources/NotesPanel";
import { useSettings } from "../features/resources/queries";

interface LocationState {
  notice?: string;
}

const DETAIL_TABS = ["overview", "notes", "interviews", "activity"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

const tabLabels: Record<DetailTab, string> = {
  overview: "Overview",
  notes: "Notes",
  interviews: "Interviews",
  activity: "Activity",
};

function detailTab(value: string | null): DetailTab {
  return DETAIL_TABS.find((tab) => tab === value) ?? "overview";
}

export function ApplicationDetailPage() {
  const { applicationId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = detailTab(searchParams.get("tab"));
  const [notice] = useState(
    () => (location.state as LocationState | null)?.notice ?? null,
  );
  const applicationQuery = useApplication(applicationId);
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";

  useEffect(() => {
    if (location.state) {
      void navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  function setActiveTab(tab: DetailTab) {
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next);
  }

  if (applicationQuery.isPending) {
    return <ApplicationDetailSkeleton />;
  }

  if (applicationQuery.isError) {
    const isMissing =
      applicationQuery.error instanceof ApiError &&
      applicationQuery.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <ErrorPanel
          error={applicationQuery.error}
          title={isMissing ? "Application not found" : "Application could not be loaded"}
          onRetry={isMissing ? undefined : () => void applicationQuery.refetch()}
        />
        <Link to="/applications" className={buttonClassName("secondary")}>
          Back to applications
        </Link>
      </div>
    );
  }

  const application = applicationQuery.data;

  return (
    <div>
      <Link
        to="/applications"
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to applications
      </Link>

      {notice ? (
        <div className="mt-3">
          <SuccessBanner>{notice}</SuccessBanner>
        </div>
      ) : null}

      <header className="relative mt-4 overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-panel sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gradient-to-br from-accent/15 to-violet/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="break-words [overflow-wrap:anywhere] text-sm font-bold text-accent">{application.company_name}</p>
              <div className="whitespace-nowrap">
                <StatusBadge status={application.status} />
              </div>
            </div>
            <h1 className="mt-2 break-words [overflow-wrap:anywhere] text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {application.job_title}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Updated{" "}
              <time dateTime={application.updated_at}>
                {formatTimestamp(application.updated_at, timeZone)}
              </time>
            </p>
          </div>
          <Link
            to={`/applications/${application.application_id}/edit`}
            className={buttonClassName("secondary", "relative gap-2")}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit details
          </Link>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem
            icon={<CalendarClock aria-hidden="true" className="size-4" />}
            label="Follow-up"
            value={formatDateOnly(application.follow_up_date)}
          />
          <SummaryItem
            icon={<Clock3 aria-hidden="true" className="size-4" />}
            label="Applied"
            value={formatDateOnly(application.applied_date)}
          />
          <button
            type="button"
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface-raised px-4 text-left transition-colors hover:border-accent/50 sm:col-span-2 lg:col-span-1"
            onClick={() => setActiveTab("interviews")}
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet">
              <Clock3 aria-hidden="true" className="size-4" />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Next interview
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-ink">
                View interview schedule
              </span>
            </span>
          </button>
        </div>
      </header>

      {application.status === "ARCHIVED" ? (
        <div className="mt-5 rounded-2xl border border-line-strong bg-surface-muted px-4 py-3 text-sm text-ink">
          <p className="font-semibold">This application is archived.</p>
          <p className="mt-1 leading-6 text-ink-muted">
            It remains available in your history. Use the status control to restore it to its exact prior status.
          </p>
        </div>
      ) : null}

      <ApplicationTabs activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div
          id={`application-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`application-tab-${activeTab}`}
          tabIndex={0}
          className="min-w-0 focus:outline-none"
        >
          {activeTab === "overview" ? (
            <ApplicationDetails application={application} />
          ) : null}
          {activeTab === "notes" ? (
            <NotesPanel applicationId={application.application_id} timeZone={timeZone} />
          ) : null}
          {activeTab === "interviews" ? (
            <InterviewsPanel applicationId={application.application_id} timeZone={timeZone} />
          ) : null}
          {activeTab === "activity" ? (
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-ink">Activity</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  A record of creation and status changes for this application.
                </p>
              </div>
              <ActivityTimeline applicationId={application.application_id} timeZone={timeZone} />
            </section>
          ) : null}
        </div>

        <ResponsiveStatusRail
          application={application}
          onReload={() => void applicationQuery.refetch()}
        />
      </div>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface-raised px-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

function ApplicationTabs({
  activeTab,
  onChange,
}: {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % DETAIL_TABS.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + DETAIL_TABS.length) % DETAIL_TABS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = DETAIL_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = DETAIL_TABS[nextIndex];
    onChange(nextTab);
    window.setTimeout(() => tabRefs.current[nextIndex]?.focus(), 0);
  }

  return (
    <div className="mt-6 overflow-x-auto border-b border-line">
      <div className="flex min-w-max gap-1" role="tablist" aria-label="Application workspace">
        {DETAIL_TABS.map((tab, index) => {
          const selected = tab === activeTab;
          return (
            <button
              key={tab}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`application-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`application-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              className={`relative min-h-12 rounded-t-xl px-4 text-sm font-semibold transition-colors ${
                selected
                  ? "bg-surface text-accent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink"
              }`}
              onClick={() => onChange(tab)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResponsiveStatusRail({
  application,
  onReload,
}: {
  application: Application;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalFocus({
    isOpen: open,
    containerRef: panelRef,
    initialFocusRef: closeRef,
    onClose: () => setOpen(false),
  });

  return (
    <>
      <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <Button className="w-full gap-2 shadow-xl" onClick={() => setOpen(true)}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Change application status
        </Button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden"
          aria-label="Close status panel"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <section
        ref={panelRef}
        tabIndex={open ? -1 : undefined}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-labelledby={open ? "mobile-status-title" : undefined}
        className={`${
          open
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-surface-raised p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            : "hidden"
        } lg:sticky lg:top-24 lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        <div className="mb-3 flex items-center justify-between px-1 lg:hidden">
          <h2 id="mobile-status-title" className="text-lg font-bold text-ink">
            Manage status
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close status panel"
            className="inline-flex size-11 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <StatusTransitionForm application={application} onReload={onReload} />
      </section>
    </>
  );
}
