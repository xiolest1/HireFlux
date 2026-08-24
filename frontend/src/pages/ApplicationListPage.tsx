import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  LayoutGrid,
  List,
  MapPin,
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
import { Link, useLocation, useSearchParams } from "react-router-dom";
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
import { StatusBadge } from "../components/ui/StatusBadge";
import { Drawer } from "../components/ui/Drawer";
import { ApplicationCard } from "../features/applications/ApplicationCard";
import { ApplicationListSkeleton } from "../features/applications/ApplicationSkeletons";
import {
  formatDateOnly,
  formatStageAge,
  formatSource,
  formatStatus,
  formatTimestamp,
  formatWorkMode,
} from "../features/applications/format";
import { useApplications } from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";

type ApplicationLayout = "cards" | "list";

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
  const layout: ApplicationLayout =
    searchParams.get("layout") === "list" ? "list" : "cards";
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

  function setLayout(value: ApplicationLayout) {
    updateSearchParams((next) => {
      if (value === "cards") next.delete("layout");
      else next.set("layout", value);
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
    updateSearchParams((next) => {
      const value = searchDraft.trim();
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
  const filterCount = [
    status,
    source,
    workMode,
    stageAge,
    followUp,
  ].filter(Boolean).length;
  const hiddenFilterCount = Math.max(0, activeFilterItems.length - 3);

  return (
    <div>
      {notice ? (
        <div className="mb-6">
          <SuccessBanner>{notice}</SuccessBanner>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">
            Opportunity workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Applications
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-ink-muted">
            Find the next action quickly, then keep every opportunity moving.
          </p>
        </div>
        <Link to="/applications/new" className={buttonClassName("primary")}>
          New application
        </Link>
      </div>

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
                  ? "bg-surface-raised text-accent shadow-sm"
                  : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
              onClick={() => setApplicationView(view)}
            >
              {applicationViewLabel(view)}
            </button>
          );
        })}
      </nav>

      <section
        className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-panel sm:p-5"
        aria-labelledby="application-search-title"
      >
        <h2 id="application-search-title" className="sr-only">
          Search and filter applications
        </h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={submitSearch}
            role="search"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="application-search"
                className="text-xs font-bold uppercase tracking-wide text-ink-muted"
              >
                Search applications
              </label>
              <div className="relative mt-1.5">
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
                  className="min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised py-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted"
                />
              </div>
            </div>
            <button
              type="submit"
              className="min-h-11 self-end rounded-xl bg-accent-strong px-4 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {applicationView === "ACTIVE" ? (
              <button
                type="button"
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  followUp === "NEEDS_ATTENTION"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line-strong bg-surface-raised text-ink hover:border-accent/50 hover:text-accent"
                }`}
                aria-pressed={followUp === "NEEDS_ATTENTION"}
                onClick={() => openFilters({ followUp: "NEEDS_ATTENTION" })}
              >
                <CircleAlert aria-hidden="true" className="size-4" />
                Needs attention
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface-raised px-4 text-sm font-semibold text-ink transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4" role="group" aria-label="Active application filters">
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
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
              className="min-h-9 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-accent-soft"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        {applicationsQuery.isPending ? (
          <ApplicationListSkeleton />
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
                : applicationView === "ARCHIVED"
                  ? "Archived opportunities will stay safely available here."
                  : "Add your first opportunity to start building a clear application history."
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className={buttonClassName("secondary")}
                  onClick={clearAllFilters}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted" aria-live="polite">
                <span className="font-semibold text-ink">{applications.length}</span>{" "}
                {applications.length === 1 ? "application" : "applications"} loaded
                {applicationsQuery.isFetching &&
                !applicationsQuery.isFetchingNextPage ? (
                  <span className="ml-2 text-accent">Refreshing…</span>
                ) : null}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 lg:flex">
                  <span aria-hidden="true" className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                    Sort by
                  </span>
                  <SortSelect id="desktop-application-sort" value={sort} onChange={setSort} />
                </div>
                <div
                  className="hidden items-center rounded-xl border border-line bg-surface-muted p-1 md:flex"
                  role="group"
                  aria-label="Application layout"
                >
                  <LayoutButton
                    selected={layout === "cards"}
                    label="Card view"
                    onClick={() => setLayout("cards")}
                  >
                    <LayoutGrid aria-hidden="true" className="size-4" />
                  </LayoutButton>
                  <LayoutButton
                    selected={layout === "list"}
                    label="List view"
                    onClick={() => setLayout("list")}
                  >
                    <List aria-hidden="true" className="size-4" />
                  </LayoutButton>
                </div>
              </div>
            </div>

            <div className={layout === "list" ? "md:hidden" : ""}>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {applications.map((application) => (
                  <li className="min-w-0" key={application.application_id}>
                    <ApplicationCard application={application} timeZone={timeZone} />
                  </li>
                ))}
              </ul>
            </div>

            {layout === "list" ? (
              <ApplicationTable applications={applications} timeZone={timeZone} />
            ) : null}

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
    </div>
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

function LayoutButton({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
        selected
          ? "bg-surface-raised text-accent shadow-sm"
          : "text-ink-muted hover:text-ink"
      }`}
      onClick={onClick}
    >
      {children}
      <span>{label.replace(" view", "")}</span>
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
      className="min-h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink"
    >
      <option value="updated_desc">Recently updated</option>
      <option value="updated_asc">Least recently updated</option>
    </select>
  );
}

function ApplicationTable({
  applications,
  timeZone,
}: {
  applications: Application[];
  timeZone: string;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-panel md:block">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Applications in compact list view</caption>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Opportunity</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Follow-up</th>
            <th scope="col" className="px-4 py-3 font-semibold">Applied</th>
            <th scope="col" className="px-4 py-3 font-semibold">Updated</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {applications.map((application) => (
            <tr key={application.application_id} className="transition-colors hover:bg-surface-muted focus-within:bg-surface-muted">
              <th scope="row" className="min-w-56 px-4 py-4 font-normal">
                <Link
                  to={`/applications/${application.application_id}`}
                  className="font-semibold text-ink hover:text-accent hover:underline"
                >
                  {application.job_title}
                </Link>
                <p className="mt-1 text-ink-muted">{application.company_name}</p>
                {application.location || application.work_mode ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                    <MapPin aria-hidden="true" className="size-3.5" />
                    {[application.location, application.work_mode ? formatWorkMode(application.work_mode) : null].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </th>
              <td className="whitespace-nowrap px-4 py-4"><StatusBadge status={application.status} /></td>
              <td className="whitespace-nowrap px-4 py-4 text-ink">{formatDateOnly(application.follow_up_date)}</td>
              <td className="whitespace-nowrap px-4 py-4 text-ink-muted">{formatDateOnly(application.applied_date)}</td>
              <td className="whitespace-nowrap px-4 py-4 text-ink-muted">{formatTimestamp(application.updated_at, timeZone)}</td>
              <td className="px-4 py-4 text-right">
                <Link
                  to={`/applications/${application.application_id}`}
                  aria-label={`Manage ${application.job_title} application`}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 font-semibold text-accent hover:bg-accent-soft"
                >
                  Manage <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>
    </div>
  );
}
