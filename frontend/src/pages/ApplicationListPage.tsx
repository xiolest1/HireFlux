import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  APPLICATION_SORTS,
  APPLICATION_VIEWS,
  WORK_MODES,
  type Application,
  type ApplicationStatus,
  type ApplicationView,
} from "../api/schemas";
import { buttonClassName } from "../components/ui/buttonStyles";
import {
  EmptyState,
  ErrorPanel,
  LoadingState,
  SuccessBanner,
} from "../components/ui/Feedback";
import { ApplicationCard } from "../features/applications/ApplicationCard";
import { formatSource, formatStatus, formatWorkMode } from "../features/applications/format";
import { useApplications } from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";

function statusFromSearchParam(value: string | null): ApplicationStatus | null {
  return APPLICATION_STATUSES.find((status) => status === value) ?? null;
}

function optionFromSearchParam<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

function viewForStatus(status: ApplicationStatus): ApplicationView {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (["APPLIED", "SCREENING", "INTERVIEW", "OFFER"].includes(status)) return "ACTIVE";
  return "ALL";
}

function deduplicateApplications(applications: Application[]): Application[] {
  const byId = new Map<string, Application>();
  for (const application of applications) {
    byId.set(application.application_id, application);
  }
  return Array.from(byId.values());
}

export function ApplicationListPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromSearchParam(searchParams.get("status"));
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const viewParam = optionFromSearchParam(searchParams.get("view"), APPLICATION_VIEWS);
  const applicationView = viewParam
    ?? (status ? viewForStatus(status) : undefined)
    ?? settingsQuery.data?.default_application_view
    ?? "ACTIVE";
  const q = (searchParams.get("q") ?? "").slice(0, 120);
  const source = optionFromSearchParam(searchParams.get("source"), APPLICATION_SOURCES);
  const workMode = optionFromSearchParam(searchParams.get("work_mode"), WORK_MODES);
  const sort = optionFromSearchParam(searchParams.get("sort"), APPLICATION_SORTS) ?? "updated_desc";
  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => setSearchDraft(q), [q]);
  const applicationsQuery = useApplications(status, 20, {
    q: q || undefined,
    source,
    workMode,
    sort,
    view: applicationView,
  });
  const applications = deduplicateApplications(
    applicationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
  );
  const notice =
    location.state &&
    typeof location.state === "object" &&
    "notice" in location.state &&
    typeof location.state.notice === "string"
      ? location.state.notice
      : null;

  function setStatus(nextStatus: string) {
    const next = new URLSearchParams(searchParams);
    if (nextStatus === "ALL") {
      next.delete("status");
      next.set("view", "ALL");
    } else {
      const parsedStatus = statusFromSearchParam(nextStatus);
      if (parsedStatus) {
        next.set("status", parsedStatus);
        next.set("view", viewForStatus(parsedStatus));
      }
    }
    setSearchParams(next, { replace: true });
  }

  function setApplicationView(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("view", value);
    next.delete("status");
    setSearchParams(next, { replace: true });
  }

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setFilter("q", searchDraft.trim());
  }

  const hasFilters = Boolean(status || q || source || workMode || sort !== "updated_desc" || viewParam);

  return (
    <div>
      {notice ? (
        <div className="mb-6">
          <SuccessBanner>{notice}</SuccessBanner>
        </div>
      ) : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">
            Your search
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Applications
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Keep every opportunity and its next step in one calm, reliable place.
          </p>
        </div>
        <Link to="/applications/new" className={buttonClassName("primary")}>
          New application
        </Link>
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-panel" aria-labelledby="application-filters-title">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="application-filters-title" className="text-sm font-bold text-slate-950">Find and filter applications</h2><p className="mt-0.5 text-xs text-slate-500">Search remains scoped to your isolated workspace.</p></div>
          {hasFilters ? <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50" onClick={() => setSearchParams({}, { replace: true })}>Clear filters</button> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <form className="flex gap-2 sm:col-span-2 lg:col-span-1" onSubmit={submitSearch} role="search">
            <div className="min-w-0 flex-1"><label htmlFor="application-search" className="text-xs font-bold uppercase tracking-wide text-slate-600">Search</label><input id="application-search" type="search" maxLength={120} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Company or role" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" /></div>
            <button type="submit" className="mt-[1.65rem] min-h-11 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">Go</button>
          </form>
          <ListFilter id="view-filter" label="Application view" value={applicationView} onChange={setApplicationView}><option value="ACTIVE">Active pursuits</option><option value="ALL">All applications</option><option value="ARCHIVED">Archived only</option></ListFilter>
          <ListFilter id="status-filter" label="Filter by status" value={status ?? "ALL"} onChange={setStatus}><option value="ALL">All statuses</option>{APPLICATION_STATUSES.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}</ListFilter>
          <ListFilter id="source-filter" label="Source" value={source ?? ""} onChange={(value) => setFilter("source", value)}><option value="">All sources</option>{APPLICATION_SOURCES.map((option) => <option key={option} value={option}>{formatSource(option)}</option>)}</ListFilter>
          <ListFilter id="work-mode-filter" label="Work mode" value={workMode ?? ""} onChange={(value) => setFilter("work_mode", value)}><option value="">All modes</option>{WORK_MODES.map((option) => <option key={option} value={option}>{formatWorkMode(option)}</option>)}</ListFilter>
          <ListFilter id="sort-filter" label="Sort" value={sort} onChange={(value) => setFilter("sort", value)}><option value="updated_desc">Recently updated</option><option value="updated_asc">Least recently updated</option></ListFilter>
        </div>
      </section>

      <div className="mt-6">
        {applicationsQuery.isPending ? (
          <LoadingState label="Loading applications…" />
        ) : applicationsQuery.isError && applications.length === 0 ? (
          <ErrorPanel
            error={applicationsQuery.error}
            title="Applications could not be loaded"
            onRetry={() => void applicationsQuery.refetch()}
          />
        ) : applications.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No applications match these filters" : "No applications yet"}
            description={
              hasFilters
                ? "Try clearing one or more filters, or search for a different company or role."
                : "Add your first opportunity to start building a clear application history."
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className={buttonClassName("secondary")}
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  Clear filters
                </button>
              ) : (
                <Link to="/applications/new" className={buttonClassName("primary")}>
                  Create your first application
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-600" aria-live="polite">
                {applications.length} {applications.length === 1 ? "application" : "applications"} loaded
              </p>
            </div>
            <ul className="grid gap-4 md:grid-cols-2">
              {applications.map((application) => (
                <li key={application.application_id}>
                  <ApplicationCard application={application} timeZone={timeZone} />
                </li>
              ))}
            </ul>

            {applicationsQuery.isFetchNextPageError ? (
              <div className="mt-5">
                <ErrorPanel
                  compact
                  error={applicationsQuery.error}
                  title="More applications could not be loaded"
                  onRetry={() => void applicationsQuery.fetchNextPage()}
                />
              </div>
            ) : null}

            {applicationsQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  className={buttonClassName("secondary", "min-w-40")}
                  disabled={applicationsQuery.isFetchingNextPage}
                  onClick={() => void applicationsQuery.fetchNextPage()}
                >
                  {applicationsQuery.isFetchingNextPage ? "Loading more…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ListFilter({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <div><label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">{children}</select></div>;
}
