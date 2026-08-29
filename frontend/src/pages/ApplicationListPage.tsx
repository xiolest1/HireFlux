import {
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  APPLICATION_SORTS,
  APPLICATION_VIEWS,
  FOLLOW_UP_FILTERS,
  STAGE_AGE_BUCKETS,
  WORK_MODES,
  type Application,
  type ApplicationStatus,
  type ApplicationView,
} from "../api/schemas";
import { buttonClassName } from "../components/ui/buttonStyles";
import {
  EmptyState,
  ErrorPanel,
  SuccessBanner,
} from "../components/ui/Feedback";
import { Drawer } from "../components/ui/Drawer";
import { WorkspaceFrame, WorkspaceIntro } from "../components/ui/WorkspaceComposition";
import { ApplicationListSkeleton } from "../features/applications/ApplicationSkeletons";
import {
  readApplicationCreatedRouteState,
} from "../features/applications/createNavigation";
import {
  formatStageAge,
  formatSource,
  formatStatus,
  formatWorkMode,
} from "../features/applications/format";
import {
  FlatOpportunityRow,
  OpportunityWorkspace,
} from "../features/applications/OpportunityWorkspace";
import {
  useApplications,
  useOpportunityWorkspace,
} from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";

interface FilterDraft {
  status: string;
  source: string;
  workMode: string;
  stageAge: string;
  followUp: string;
  sort: string;
}

type FilterName = "q" | "status" | "source" | "work_mode" | "stage_age" | "follow_up";

interface ActiveFilterItem {
  name: FilterName;
  label: string;
}

const defaultFilterDraft: FilterDraft = {
  status: "",
  source: "",
  workMode: "",
  stageAge: "",
  followUp: "",
  sort: "updated_desc",
};

function statusFromSearchParam(value: string | null): ApplicationStatus | null {
  return APPLICATION_STATUSES.find((status) => status === value) ?? null;
}

function optionFromSearchParam<T extends string>(
  value: string | null,
  options: readonly T[],
): T | undefined {
  return options.find((option) => option === value);
}

function viewForStatus(status: ApplicationStatus): ApplicationView {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (["APPLIED", "SCREENING", "INTERVIEW", "OFFER"].includes(status)) {
    return "ACTIVE";
  }
  return "ALL";
}

function deduplicateApplications(applications: Application[]): Application[] {
  const byId = new Map<string, Application>();
  for (const application of applications) {
    byId.set(application.application_id, application);
  }
  return Array.from(byId.values());
}

function applicationViewLabel(view: ApplicationView): string {
  if (view === "ACTIVE") return "Active";
  if (view === "ARCHIVED") return "Archived";
  return "All";
}

export function ApplicationListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromSearchParam(searchParams.get("status"));
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const viewParam = optionFromSearchParam(
    searchParams.get("view"),
    APPLICATION_VIEWS,
  );
  const applicationView =
    viewParam ??
    (status ? viewForStatus(status) : undefined) ??
    settingsQuery.data?.default_application_view ??
    "ACTIVE";
  const q = (searchParams.get("q") ?? "").slice(0, 120);
  const source = optionFromSearchParam(
    searchParams.get("source"),
    APPLICATION_SOURCES,
  );
  const workMode = optionFromSearchParam(
    searchParams.get("work_mode"),
    WORK_MODES,
  );
  const requestedStageAge = optionFromSearchParam(
    searchParams.get("stage_age"),
    STAGE_AGE_BUCKETS,
  );
  const stageAge = applicationView === "ACTIVE" ? requestedStageAge : undefined;
  const requestedFollowUp = optionFromSearchParam(
    searchParams.get("follow_up"),
    FOLLOW_UP_FILTERS,
  );
  const followUp = applicationView === "ACTIVE" ? requestedFollowUp : undefined;
  const sort =
    optionFromSearchParam(searchParams.get("sort"), APPLICATION_SORTS) ??
    "updated_desc";
  const groupedActiveMode =
    applicationView === "ACTIVE" &&
    !q &&
    !status &&
    !source &&
    !workMode &&
    !stageAge &&
    !followUp &&
    !searchParams.has("sort");
  const [searchDraft, setSearchDraft] = useState(q);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FilterDraft>({
    status: status ?? "",
    source: source ?? "",
    workMode: workMode ?? "",
    stageAge: stageAge ?? "",
    followUp: followUp ?? "",
    sort,
  });
  const [activeFiltersExpanded, setActiveFiltersExpanded] = useState(false);

  useEffect(() => setSearchDraft(q), [q]);
  useEffect(() => {
    if (!searchParams.has("layout")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("layout");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    const value = searchDraft.trim();
    if (value === q) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("q", value);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, searchDraft, searchParams, setSearchParams]);
  useEffect(() => {
    if ((!requestedStageAge && !requestedFollowUp) || applicationView === "ACTIVE") return;
    const next = new URLSearchParams(searchParams);
    next.delete("stage_age");
    next.delete("follow_up");
    setSearchParams(next, { replace: true });
  }, [applicationView, requestedFollowUp, requestedStageAge, searchParams, setSearchParams]);

  const applicationsQuery = useApplications(status, 20, {
    q: q || undefined,
    source,
    workMode,
    stageAge,
    followUp,
    sort,
    view: applicationView,
  }, !groupedActiveMode);
  const workspaceQuery = useOpportunityWorkspace(4, groupedActiveMode);
  const applications = deduplicateApplications(
    applicationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
  );
  const [createdState] = useState(() => readApplicationCreatedRouteState(location.state));
  const [notice] = useState<string | null>(() => {
    if (createdState) return createdState.notice;
    return location.state &&
      typeof location.state === "object" &&
      "notice" in location.state &&
      typeof location.state.notice === "string"
      ? location.state.notice
      : null;
  });
  const [highlightedApplicationId, setHighlightedApplicationId] = useState(
    createdState?.createdApplicationId,
  );

  useEffect(() => {
    if (location.state) {
      const normalized = new URLSearchParams(location.search);
      normalized.delete("layout");
      const normalizedSearch = normalized.toString();
      void navigate(
        `${location.pathname}${normalizedSearch ? `?${normalizedSearch}` : ""}`,
        { replace: true, state: null },
      );
    }
    if (!highlightedApplicationId) return;
    const timer = window.setTimeout(() => setHighlightedApplicationId(undefined), 5_000);
    return () => window.clearTimeout(timer);
  }, [highlightedApplicationId, location.pathname, location.search, location.state, navigate]);

  function updateSearchParams(
    update: (next: URLSearchParams) => void,
    replace = true,
  ) {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, { replace });
  }

  function setApplicationView(value: ApplicationView) {
    updateSearchParams((next) => {
      next.set("view", value);
      next.delete("status");
      if (value !== "ACTIVE") {
        next.delete("stage_age");
        next.delete("follow_up");
      }
    });
  }

  function openFilters(overrides: Partial<FilterDraft> = {}) {
    setFilterDraft({
      status: status ?? "",
      source: source ?? "",
      workMode: workMode ?? "",
      stageAge: stageAge ?? "",
      followUp: followUp ?? "",
      sort,
      ...overrides,
    });
    setFilterOpen(true);
  }

  function applyFilters() {
    updateSearchParams((next) => {
      if (filterDraft.status) {
        const parsedStatus = statusFromSearchParam(filterDraft.status);
        if (parsedStatus) {
          next.set("status", parsedStatus);
          next.set("view", viewForStatus(parsedStatus));
        }
      } else {
        next.delete("status");
      }
      if (filterDraft.source) next.set("source", filterDraft.source);
      else next.delete("source");
      if (filterDraft.workMode) next.set("work_mode", filterDraft.workMode);
      else next.delete("work_mode");
      const parsedStageAge = optionFromSearchParam(
        filterDraft.stageAge || null,
        STAGE_AGE_BUCKETS,
      );
      const parsedStatus = statusFromSearchParam(filterDraft.status || null);
      const stageAgeAllowed =
        Boolean(parsedStageAge) &&
        (!parsedStatus || viewForStatus(parsedStatus) === "ACTIVE");
      if (stageAgeAllowed && parsedStageAge) {
        next.set("stage_age", parsedStageAge);
        next.set("view", "ACTIVE");
      } else {
        next.delete("stage_age");
      }
      const parsedFollowUp = optionFromSearchParam(
        filterDraft.followUp || null,
        FOLLOW_UP_FILTERS,
      );
      if (parsedFollowUp && (!parsedStatus || viewForStatus(parsedStatus) === "ACTIVE")) {
        next.set("follow_up", parsedFollowUp);
        next.set("view", "ACTIVE");
      } else {
        next.delete("follow_up");
      }
      if (filterDraft.sort !== "updated_desc") {
        next.set("sort", filterDraft.sort);
      } else {
        next.delete("sort");
      }
    });
    setFilterOpen(false);
    setActiveFiltersExpanded(false);
  }

  function setSort(value: string) {
    const parsedSort = optionFromSearchParam(value, APPLICATION_SORTS) ?? "updated_desc";
    updateSearchParams((next) => {
      if (parsedSort === "updated_desc") next.delete("sort");
      else next.set("sort", parsedSort);
    });
  }

  function clearAllFilters() {
    updateSearchParams((next) => {
      next.delete("q");
      next.delete("status");
      next.delete("source");
      next.delete("work_mode");
      next.delete("stage_age");
      next.delete("follow_up");
      next.delete("sort");
    });
    setActiveFiltersExpanded(false);
  }

  function removeFilter(name: FilterName) {
    updateSearchParams((next) => next.delete(name));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = searchDraft.trim();
    updateSearchParams((next) => {
      if (value) next.set("q", value);
      else next.delete("q");
    });
  }

  const activeFilterItems: ActiveFilterItem[] = [
    q ? { name: "q", label: `Search: ${q}` } : null,
    status ? { name: "status", label: `Status: ${formatStatus(status)}` } : null,
    source ? { name: "source", label: `Source: ${formatSource(source)}` } : null,
    workMode ? { name: "work_mode", label: `Work mode: ${formatWorkMode(workMode)}` } : null,
    stageAge ? { name: "stage_age", label: `Stage age: ${formatStageAge(stageAge)}` } : null,
    followUp ? { name: "follow_up", label: "Follow-up: Needs attention" } : null,
  ].filter((item): item is ActiveFilterItem => Boolean(item));
  const hasFilters = activeFilterItems.length > 0;
  const hasNarrowingFilters = Boolean(status || source || workMode || stageAge || followUp);
  const hasExplicitSort = searchParams.has("sort");
  const filterCount = [
    status,
    source,
    workMode,
    stageAge,
    followUp,
  ].filter(Boolean).length;
  const hiddenFilterCount = Math.max(0, activeFilterItems.length - 3);

  return (
    <WorkspaceFrame width="wide">
      {notice ? (
        <div className="mb-6">
          <SuccessBanner>
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>{notice}</span>
              {createdState ? (
                <Link
                  to={`/applications/${createdState.createdApplicationId}`}
                  className="font-semibold underline underline-offset-4"
                >
                  View application
                </Link>
              ) : null}
            </span>
          </SuccessBanner>
        </div>
      ) : null}

      <WorkspaceIntro title="Applications" lead="What requires you, what is moving, and what is waiting?" context="Scan the opportunity field by responsibility and momentum without losing the details behind each application." />

      <nav
        className="mt-7 inline-flex w-full rounded-2xl border border-line bg-surface-muted p-1 sm:w-auto"
        aria-label="Application views"
      >
        {APPLICATION_VIEWS.map((view) => {
          const selected = applicationView === view;
          return (
            <button
              key={view}
              type="button"
              aria-current={selected ? "page" : undefined}
              className={`min-h-10 flex-1 rounded-xl px-5 text-sm font-semibold transition-colors sm:flex-none ${
                selected
                  ? "bg-surface-selected text-accent-strong"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
              onClick={() => setApplicationView(view)}
            >
              {applicationViewLabel(view)}
            </button>
          );
        })}
      </nav>

      <section
        className="mt-5 dark:rounded-2xl dark:border dark:border-line dark:bg-surface dark:p-4 dark:shadow-panel sm:dark:p-5"
        aria-labelledby="application-search-title"
      >
        <h2 id="application-search-title" className="sr-only">
          Search and filter applications
        </h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <form
            className="min-w-0 flex-1"
            onSubmit={submitSearch}
            role="search"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="application-search" className="sr-only dark:not-sr-only dark:text-xs dark:font-bold dark:uppercase dark:tracking-wide dark:text-ink-muted">
                Search applications by company or role
              </label>
              <div className="relative dark:mt-1.5">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="application-search"
                  type="search"
                  maxLength={120}
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search company or role"
                  className="hf-field min-h-11 w-full py-2 pl-10 pr-3 text-sm"
                />
              </div>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={filterCount ? `Filters, ${filterCount} active` : "Filters"}
              onClick={() => openFilters()}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Filters
              {filterCount ? (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {filterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Active application filters">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Active filters
            </span>
            {activeFilterItems.slice(0, 3).map((item) => (
              <FilterChip key={item.name} label={item.label} onRemove={() => removeFilter(item.name)} />
            ))}
            {hiddenFilterCount ? (
              <>
                <div id="additional-application-filters" hidden={!activeFiltersExpanded} className="contents">
                  {activeFilterItems.slice(3).map((item) => (
                    <FilterChip key={item.name} label={item.label} onRemove={() => removeFilter(item.name)} />
                  ))}
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  aria-expanded={activeFiltersExpanded}
                  aria-controls="additional-application-filters"
                  onClick={() => setActiveFiltersExpanded((expanded) => !expanded)}
                >
                  {activeFiltersExpanded ? "Show fewer filters" : `+${hiddenFilterCount} more filters`}
                  <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${activeFiltersExpanded ? "rotate-180" : ""}`} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="min-h-9 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-surface-hover"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      <div
        className={`mt-6 ${((groupedActiveMode && workspaceQuery.isFetching && workspaceQuery.data) || (!groupedActiveMode && applicationsQuery.isFetching && applications.length > 0)) ? "hf-updating" : ""}`}
        aria-busy={(groupedActiveMode ? workspaceQuery.isFetching : applicationsQuery.isFetching) || undefined}
      >
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {groupedActiveMode
            ? workspaceQuery.isFetching && workspaceQuery.data
              ? "Updating opportunities."
              : workspaceQuery.data
                ? `${Object.values(workspaceQuery.data.groups).reduce((total, group) => total + group.total_count, 0)} active opportunities loaded.`
                : ""
            : applicationsQuery.isFetching && applications.length
              ? "Updating application results."
              : `${applications.length} application results loaded.`}
        </p>
        {!groupedActiveMode && applicationView === "ACTIVE" ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-muted">
              {q
                ? `Showing active applications matching “${q}”.`
                : hasNarrowingFilters
                  ? "Showing a narrowed Active view."
                  : hasExplicitSort
                    ? "Showing Active applications in your selected order."
                    : null}
            </p>
            <button
              type="button"
              className="min-h-11 rounded-xl px-3 font-semibold text-accent hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onClick={clearAllFilters}
            >
              Return to opportunity workspace
            </button>
          </div>
        ) : null}
        {groupedActiveMode && workspaceQuery.isPending ? (
          <ApplicationListSkeleton />
        ) : groupedActiveMode && workspaceQuery.isError ? (
          <ErrorPanel
            error={workspaceQuery.error}
            title="Opportunity workspace could not be loaded"
            onRetry={() => void workspaceQuery.refetch()}
          />
        ) : groupedActiveMode && workspaceQuery.data ? (
          Object.values(workspaceQuery.data.groups).every((group) => group.total_count === 0) ? (
            <EmptyState
              title="No active applications"
              description="Add an application from the main navigation, or review your complete application history."
              action={<button type="button" className={buttonClassName("secondary")} onClick={() => setApplicationView("ALL")}>View all applications</button>}
            />
          ) : (
            <OpportunityWorkspace
              workspace={workspaceQuery.data}
              timeZone={timeZone}
              highlightedApplicationId={highlightedApplicationId}
            />
          )
        ) : applicationsQuery.isPending ? (
          <ApplicationListSkeleton />
        ) : applicationsQuery.isError && applications.length === 0 ? (
          <ErrorPanel error={applicationsQuery.error} title="Applications could not be loaded" onRetry={() => void applicationsQuery.refetch()} />
        ) : applications.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No applications match these filters" : "No applications yet"}
            description={
              hasFilters
                ? "Try clearing one or more filters, or search for a different company or role."
                : applicationView === "ARCHIVED"
                  ? "Archived opportunities will stay safely available here."
                  : "Add your first opportunity to start building a clear application history."
            }
            action={hasFilters ? (
                <button
                  type="button"
                  className={buttonClassName("secondary")}
                  onClick={clearAllFilters}
                >
                  Clear filters
                </button>
              ) : undefined}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">{applications.length}</span>{" "}
                {applications.length === 1 ? "application" : "applications"} loaded
                {applicationsQuery.isFetching &&
                !applicationsQuery.isFetchingNextPage ? (
                  <span className="ml-2 text-accent">Refreshing…</span>
                ) : null}
              </p>
              <div className="hidden items-center gap-2 lg:flex">
                  <span aria-hidden="true" className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                    Sort by
                  </span>
                  <SortSelect id="desktop-application-sort" value={sort} onChange={setSort} />
              </div>
            </div>

            <div className="rounded-2xl border border-line-subtle bg-surface px-4 sm:px-5">
              <ul>
                {applications.map((application) => (
                  <FlatOpportunityRow key={application.application_id} application={application} returnPath={`${location.pathname}${location.search}`} highlighted={application.application_id === highlightedApplicationId} />
                ))}
              </ul>
            </div>

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

      <FilterDrawer
        open={filterOpen}
        draft={filterDraft}
        applicationView={applicationView}
        onDraftChange={setFilterDraft}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onClear={() => setFilterDraft(defaultFilterDraft)}
      />
    </WorkspaceFrame>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 text-sm font-medium text-accent transition-colors hover:border-accent"
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
    >
      <span className="truncate">{label}</span>
      <X aria-hidden="true" className="size-3.5 shrink-0" />
    </button>
  );
}

function FilterDrawer({
  open,
  draft,
  applicationView,
  onDraftChange,
  onClose,
  onApply,
  onClear,
}: {
  open: boolean;
  draft: FilterDraft;
  applicationView: ApplicationView;
  onDraftChange: (draft: FilterDraft) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const draftStatus = statusFromSearchParam(draft.status || null);
  const effectiveView = draftStatus ? viewForStatus(draftStatus) : applicationView;
  const activeFiltersEnabled = effectiveView === "ACTIVE";

  function changeStatus(statusValue: string) {
    const nextDraft = { ...draft, status: statusValue };
    const nextStatus = statusFromSearchParam(statusValue || null);
    const nextView = nextStatus ? viewForStatus(nextStatus) : applicationView;
    if (nextView !== "ACTIVE") {
      nextDraft.stageAge = "";
      nextDraft.followUp = "";
    }
    onDraftChange(nextDraft);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Application filters"
      description="Choose how to narrow this view. Changes are staged until you apply them."
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            className={buttonClassName("secondary", "flex-1")}
            onClick={onClear}
          >
            Clear
          </button>
          <button
            type="button"
            className={buttonClassName("primary", "flex-1 gap-2")}
            onClick={onApply}
          >
            <Check aria-hidden="true" className="size-4" />
            Apply filters
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <FilterSection title="Pipeline" description="Choose where an opportunity is in your search.">
          <ListFilter
            id="status-filter"
            label="Status"
            value={draft.status}
            onChange={changeStatus}
          >
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((option) => (
              <option key={option} value={option}>{formatStatus(option)}</option>
            ))}
          </ListFilter>
        </FilterSection>
        <FilterSection title="Context" description="Narrow by where the role came from or how it is structured.">
          <div className="space-y-4">
            <ListFilter
              id="source-filter"
              label="Source"
              value={draft.source}
              onChange={(source) => onDraftChange({ ...draft, source })}
            >
              <option value="">All sources</option>
              {APPLICATION_SOURCES.map((option) => (
                <option key={option} value={option}>{formatSource(option)}</option>
              ))}
            </ListFilter>
            <ListFilter
              id="work-mode-filter"
              label="Work mode"
              value={draft.workMode}
              onChange={(workMode) => onDraftChange({ ...draft, workMode })}
            >
              <option value="">All modes</option>
              {WORK_MODES.map((option) => (
                <option key={option} value={option}>{formatWorkMode(option)}</option>
              ))}
            </ListFilter>
          </div>
        </FilterSection>
        <FilterSection title="Attention" description="Review stage age and follow-up planning for active pursuits.">
          <div className="space-y-4">
            <ListFilter
              id="stage-age-filter"
              label="Time in current stage"
              value={draft.stageAge}
              disabled={!activeFiltersEnabled}
              onChange={(stageAge) => onDraftChange({ ...draft, stageAge })}
            >
              <option value="">Any stage age</option>
              {STAGE_AGE_BUCKETS.map((option) => (
                <option key={option} value={option}>{formatStageAge(option)}</option>
              ))}
            </ListFilter>
            <ListFilter
              id="follow-up-filter"
              label="Follow-up planning"
              value={draft.followUp}
              disabled={!activeFiltersEnabled}
              onChange={(followUp) => onDraftChange({ ...draft, followUp })}
            >
              <option value="">Any follow-up state</option>
              <option value="NEEDS_ATTENTION">Needs attention</option>
            </ListFilter>
            {!activeFiltersEnabled ? (
              <p className="rounded-xl border border-line bg-surface-muted p-3 text-xs leading-5 text-ink-muted">
                These filters are available only for the Active view. Choose an active status above to enable them.
              </p>
            ) : null}
          </div>
        </FilterSection>
        <div className="lg:hidden">
          <FilterSection title="Order results" description="Choose which applications appear first.">
            <ListFilter
              id="drawer-sort-filter"
              label="Sort by"
              value={draft.sort}
              onChange={(sort) => onDraftChange({ ...draft, sort })}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="updated_asc">Least recently updated</option>
            </ListFilter>
          </FilterSection>
        </div>
      </div>
    </Drawer>
  );
}

function FilterSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = `application-filter-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-bold text-ink">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-ink-muted">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SortSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      aria-label="Sort applications"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="hf-field min-h-10 px-3 text-sm font-semibold"
    >
      <option value="updated_desc">Recently updated</option>
      <option value="updated_asc">Least recently updated</option>
    </select>
  );
}

function ListFilter({
  id,
  label,
  value,
  disabled = false,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="hf-field mt-2 px-3 text-sm font-semibold"
      >
        {children}
      </select>
    </div>
  );
}
