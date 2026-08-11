import { Link, useSearchParams } from "react-router-dom";
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
} from "../api/schemas";
import { buttonClassName } from "../components/ui/buttonStyles";
import { EmptyState, ErrorPanel, LoadingState } from "../components/ui/Feedback";
import { ApplicationCard } from "../features/applications/ApplicationCard";
import { formatStatus } from "../features/applications/format";
import { useApplications } from "../features/applications/queries";

function statusFromSearchParam(value: string | null): ApplicationStatus | null {
  return APPLICATION_STATUSES.find((status) => status === value) ?? null;
}

function deduplicateApplications(applications: Application[]): Application[] {
  const byId = new Map<string, Application>();
  for (const application of applications) {
    byId.set(application.application_id, application);
  }
  return Array.from(byId.values());
}

export function ApplicationListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromSearchParam(searchParams.get("status"));
  const applicationsQuery = useApplications(status);
  const applications = deduplicateApplications(
    applicationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
  );

  function setStatus(nextStatus: string) {
    const next = new URLSearchParams(searchParams);
    if (nextStatus === "ALL") {
      next.delete("status");
    } else {
      next.set("status", nextStatus);
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div>
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

      <div className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label htmlFor="status-filter" className="text-sm font-semibold text-slate-800">
            Filter by status
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Archived records remain available here.
          </p>
        </div>
        <select
          id="status-filter"
          value={status ?? "ALL"}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm sm:min-w-48"
        >
          <option value="ALL">All statuses</option>
          {APPLICATION_STATUSES.map((option) => (
            <option key={option} value={option}>
              {formatStatus(option)}
            </option>
          ))}
        </select>
      </div>

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
            title={status ? `No ${formatStatus(status).toLowerCase()} applications` : "No applications yet"}
            description={
              status
                ? "Choose another status or create a new application."
                : "Add your first opportunity to start building a clear application history."
            }
            action={
              status ? (
                <button
                  type="button"
                  className={buttonClassName("secondary")}
                  onClick={() => setStatus("ALL")}
                >
                  Show all applications
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
                  <ApplicationCard application={application} />
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
