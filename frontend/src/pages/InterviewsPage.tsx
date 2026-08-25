import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Route,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Interview, WorkspaceInterview } from "../api/schemas";
import { buttonClassName } from "../components/ui/buttonStyles";
import { EmptyState, ErrorPanel } from "../components/ui/Feedback";
import { PanelSkeleton, Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toastContext";
import {
  formatInterviewType,
  formatSource,
  formatStatus,
  formatTimestamp,
} from "../features/applications/format";
import { useApplication } from "../features/applications/queries";
import { InterviewWorkspaceDrawer } from "../features/resources/InterviewWorkspaceDrawer";
import {
  useApplicationInterviews,
  useSettings,
  useTransitionWorkspaceInterview,
  useWorkspaceInterviews,
} from "../features/resources/queries";

const ACTIVE_WORKFLOW_STATES = new Set([
  "PREPARE",
  "UPCOMING",
  "IMMINENT",
  "MISSED",
  "CAPTURE",
  "FOLLOW_UP",
]);

const STATE_PRIORITY: Record<
  WorkspaceInterview["context"]["workflow_state"],
  number
> = {
  IMMINENT: 0,
  CAPTURE: 1,
  FOLLOW_UP: 2,
  MISSED: 3,
  PREPARE: 4,
  UPCOMING: 5,
  HISTORY: 6,
  CANCELED: 7,
};

function calendarKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function offsetDateKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function scheduleGroup(value: string, timeZone: string) {
  const key = calendarKey(value, timeZone);
  const today = calendarKey(new Date().toISOString(), timeZone);
  if (key < today) return "Earlier";
  if (key === today) return "Today";
  if (key === offsetDateKey(today, 1)) return "Tomorrow";
  if (key <= offsetDateKey(today, 7)) return "This week";
  return "Later";
}

function applicationHref(interview: WorkspaceInterview) {
  return `/applications/${interview.application_id}?section=interviews&interview=${interview.interview_id}`;
}

function followUpHref(interview: WorkspaceInterview) {
  return `/applications/${interview.application_id}/edit`;
}

function dateOnlyLabel(value: string | null) {
  if (!value) return "No follow-up scheduled";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function followUpLabel(interview: WorkspaceInterview) {
  if (interview.context.follow_up_state === "OVERDUE")
    return "Follow-up overdue";
  if (interview.context.follow_up_state === "TODAY")
    return "Follow-up due today";
  if (interview.context.follow_up_state === "UPCOMING") {
    return `Follow-up ${dateOnlyLabel(interview.context.follow_up_date)}`;
  }
  return "Follow-up plan needed";
}

function missingPreparation(interview: WorkspaceInterview) {
  const complete = new Set(interview.completed_checklist_items);
  return interview.guidance.checklist_items.filter(
    (item) => !complete.has(item.item_id),
  );
}

function stateLabel(interview: WorkspaceInterview) {
  const missing = missingPreparation(interview).length;
  switch (interview.context.workflow_state) {
    case "IMMINENT":
      return "Starts soon";
    case "PREPARE":
      return `${missing} preparation ${missing === 1 ? "item" : "items"} left`;
    case "UPCOMING":
      return "Ready";
    case "MISSED":
      return "Confirm what happened";
    case "CAPTURE":
      return "Capture your notes";
    case "FOLLOW_UP":
      return followUpLabel(interview);
    case "CANCELED":
      return "Canceled";
    default:
      return interview.status === "COMPLETED" ? "Completed" : "Past interview";
  }
}

function stateTone(interview: WorkspaceInterview) {
  switch (interview.context.workflow_state) {
    case "IMMINENT":
      return "bg-accent text-accent-contrast";
    case "PREPARE":
    case "MISSED":
    case "FOLLOW_UP":
      return "bg-warning-soft text-warning";
    case "CAPTURE":
      return "bg-violet-soft text-violet";
    case "UPCOMING":
      return "bg-success-soft text-success";
    default:
      return "bg-surface-muted text-ink-muted";
  }
}

function preferredInterview(interviews: WorkspaceInterview[]) {
  return (
    [...interviews].sort((left, right) => {
      const priority =
        STATE_PRIORITY[left.context.workflow_state] -
        STATE_PRIORITY[right.context.workflow_state];
      if (priority !== 0) return priority;
      if (
        left.context.workflow_state === "HISTORY" ||
        left.context.workflow_state === "CANCELED"
      ) {
        return right.scheduled_at.localeCompare(left.scheduled_at);
      }
      return left.scheduled_at.localeCompare(right.scheduled_at);
    })[0] ?? null
  );
}

function orientation(
  interview: WorkspaceInterview | null,
  activeCount: number,
) {
  if (!interview) return "No interviews are currently scheduled.";
  const company = interview.company_name;
  switch (interview.context.workflow_state) {
    case "IMMINENT":
      return `Your ${company} interview is coming up soon.`;
    case "CAPTURE":
      return `Capture what happened in your ${company} interview while it is still fresh.`;
    case "FOLLOW_UP":
      return `${company} needs a follow-up plan before this interview journey is closed.`;
    case "MISSED":
      return `The scheduled time for ${company} has passed. Confirm what happened next.`;
    case "PREPARE":
      return `Your next priority is preparing for ${company}.`;
    case "UPCOMING":
      return `Your ${company} interview is ready. Keep the meeting details close.`;
    default:
      return activeCount === 0
        ? "Nothing is upcoming. Your previous interview journeys remain available below."
        : `${activeCount} interview ${activeCount === 1 ? "step is" : "steps are"} still in motion.`;
  }
}

export function InterviewsPage() {
  const interviewsQuery = useWorkspaceInterviews();
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaceInterview, setWorkspaceInterview] =
    useState<WorkspaceInterview | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const transitionMutation = useTransitionWorkspaceInterview();
  const { showToast } = useToast();

  const interviews = useMemo(
    () =>
      [
        ...(interviewsQuery.data?.pages.flatMap((page) => page.items) ?? []),
      ].sort((left, right) =>
        left.scheduled_at.localeCompare(right.scheduled_at),
      ),
    [interviewsQuery.data],
  );
  const active = interviews.filter((interview) =>
    ACTIVE_WORKFLOW_STATES.has(interview.context.workflow_state),
  );
  const past = interviews
    .filter(
      (interview) =>
        !ACTIVE_WORKFLOW_STATES.has(interview.context.workflow_state),
    )
    .sort((left, right) => right.scheduled_at.localeCompare(left.scheduled_at));
  const requestedId = searchParams.get("interview");
  const selected =
    interviews.find((interview) => interview.interview_id === requestedId) ??
    preferredInterview(interviews);

  useEffect(() => {
    if (!selected || requestedId === selected.interview_id) return;
    const next = new URLSearchParams(searchParams);
    next.set("interview", selected.interview_id);
    setSearchParams(next, { replace: true });
  }, [requestedId, searchParams, selected, setSearchParams]);

  function selectInterview(interview: WorkspaceInterview) {
    const next = new URLSearchParams(searchParams);
    next.set("interview", interview.interview_id);
    setSearchParams(next);
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      window.setTimeout(() => {
        detailRef.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
        detailRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  }

  async function transition(
    interview: WorkspaceInterview,
    status: "COMPLETED" | "CANCELED",
  ) {
    try {
      await transitionMutation.mutateAsync({
        applicationId: interview.application_id,
        interviewId: interview.interview_id,
        version: interview.version,
        status,
      });
      setCancelingId(null);
      showToast(
        status === "COMPLETED"
          ? "Interview marked complete."
          : "Interview canceled.",
        {
          title: "Interview updated",
          tone: "success",
        },
      );
    } catch {
      return;
    }
  }

  return (
    <div className="mx-auto max-w-7xl pb-6 sm:pb-8">
      <header className="border-b border-line pb-5 sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Interview journey
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Interviews
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-ink-muted">
            {orientation(selected, active.length)}
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Times shown in {timeZone.replaceAll("_", " ")}
          </p>
        </div>
        <Link
          to="/applications"
          className={`${buttonClassName("secondary")} mt-5 sm:mt-0`}
        >
          Add or schedule interview
        </Link>
      </header>

      <div className="mt-6">
        {interviewsQuery.isPending ? <InterviewsSkeleton /> : null}
        {interviewsQuery.isError ? (
          <ErrorPanel
            title="Interviews could not be loaded"
            error={interviewsQuery.error}
            onRetry={() => void interviewsQuery.refetch()}
          />
        ) : null}
        {interviewsQuery.isSuccess && interviews.length === 0 ? (
          <EmptyState
            title="No interviews yet"
            description="When an application reaches the interview stage, you can manage scheduling, preparation, reflection, and follow-up here."
            action={
              <Link to="/applications" className={buttonClassName("primary")}>
                View applications
              </Link>
            }
          />
        ) : null}
        {selected ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.35fr)]">
            <SchedulePane
              className="order-2 lg:order-1 lg:sticky lg:top-24"
              active={active}
              past={past}
              selectedId={selected.interview_id}
              timeZone={timeZone}
              onSelect={selectInterview}
              hasNextPage={Boolean(interviewsQuery.hasNextPage)}
              isFetchingNextPage={interviewsQuery.isFetchingNextPage}
              onLoadMore={() => void interviewsQuery.fetchNextPage()}
            />
            <InterviewDetail
              ref={detailRef}
              className="order-1 lg:order-2"
              interview={selected}
              timeZone={timeZone}
              cancelingId={cancelingId}
              mutationError={transitionMutation.error}
              onPrepare={() => setWorkspaceInterview(selected)}
              onCancelRequest={setCancelingId}
              onCancelKeep={() => setCancelingId(null)}
              onTransition={transition}
            />
          </div>
        ) : null}
      </div>

      {workspaceInterview ? (
        <InterviewWorkspaceDrawer
          applicationId={workspaceInterview.application_id}
          interview={workspaceInterview}
          onClose={() => setWorkspaceInterview(null)}
        />
      ) : null}
    </div>
  );
}

function SchedulePane({
  className,
  active,
  past,
  selectedId,
  timeZone,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  className?: string;
  active: WorkspaceInterview[];
  past: WorkspaceInterview[];
  selectedId: string;
  timeZone: string;
  onSelect: (interview: WorkspaceInterview) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const groups = new Map<string, WorkspaceInterview[]>();
  active.forEach((interview) => {
    const group = scheduleGroup(interview.scheduled_at, timeZone);
    groups.set(group, [...(groups.get(group) ?? []), interview]);
  });

  return (
    <aside
      className={`${className ?? ""} min-w-0`}
      aria-labelledby="schedule-title"
    >
      <div className="rounded-2xl border border-line bg-surface shadow-panel">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Chronology
          </p>
          <h2 id="schedule-title" className="mt-1 text-xl font-bold text-ink">
            Your schedule
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {active.length
              ? `${active.length} active interview ${active.length === 1 ? "step" : "steps"}. Select one to manage it.`
              : "Nothing needs action right now."}
          </p>
        </div>

        {active.length ? (
          <div className="px-2 py-3">
            {["Earlier", "Today", "Tomorrow", "This week", "Later"].map(
              (group) =>
                groups.has(group) ? (
                  <section
                    key={group}
                    aria-labelledby={`schedule-${group.replaceAll(" ", "-").toLowerCase()}`}
                  >
                    <h3
                      id={`schedule-${group.replaceAll(" ", "-").toLowerCase()}`}
                      className="px-3 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-[0.17em] text-ink-muted first:pt-1"
                    >
                      {group}
                    </h3>
                    <ul className="space-y-1">
                      {groups.get(group)?.map((interview) => (
                        <ScheduleRow
                          key={interview.interview_id}
                          interview={interview}
                          selected={interview.interview_id === selectedId}
                          timeZone={timeZone}
                          onSelect={() => onSelect(interview)}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null,
            )}
          </div>
        ) : null}

        {past.length ? (
          <details
            className="group border-t border-line"
            open={active.length === 0 || undefined}
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold text-ink marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent">
              <span>
                Past interviews{" "}
                <span className="ml-1 text-sm text-ink-muted">
                  {past.length}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-ink-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <PastRows
              interviews={past}
              selectedId={selectedId}
              timeZone={timeZone}
              onSelect={onSelect}
            />
          </details>
        ) : null}

        {hasNextPage ? (
          <div className="border-t border-line p-3 text-center">
            <button
              type="button"
              className={buttonClassName("ghost")}
              disabled={isFetchingNextPage}
              onClick={onLoadMore}
            >
              {isFetchingNextPage ? "Loading more…" : "Load more schedule"}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function PastRows({
  interviews,
  selectedId,
  timeZone,
  onSelect,
}: {
  interviews: WorkspaceInterview[];
  selectedId: string;
  timeZone: string;
  onSelect: (interview: WorkspaceInterview) => void;
}) {
  return (
    <ul className="space-y-1 px-2 pb-3">
      {interviews.map((interview) => (
        <ScheduleRow
          key={interview.interview_id}
          interview={interview}
          selected={interview.interview_id === selectedId}
          timeZone={timeZone}
          onSelect={() => onSelect(interview)}
        />
      ))}
    </ul>
  );
}

function ScheduleRow({
  interview,
  selected,
  timeZone,
  onSelect,
}: {
  interview: WorkspaceInterview;
  selected: boolean;
  timeZone: string;
  onSelect: () => void;
}) {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(interview.scheduled_at));
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(interview.scheduled_at));
  return (
    <li>
      <button
        type="button"
        aria-label={`${interview.company_name}, ${formatInterviewType(interview.interview_type)}, ${date} at ${time}, ${stateLabel(interview)}`}
        aria-pressed={selected}
        onClick={onSelect}
        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected ? "border-accent bg-accent-soft" : "border-transparent hover:border-line hover:bg-surface-muted"}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-16 shrink-0">
            <p className="text-sm font-bold text-ink">{time}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{date}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">
              {interview.company_name}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {formatInterviewType(interview.interview_type)}
            </p>
            <span
              className={`mt-2 inline-flex max-w-full rounded-full px-2 py-1 text-[0.68rem] font-bold ${stateTone(interview)}`}
            >
              {stateLabel(interview)}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

const InterviewDetail = function InterviewDetail({
  ref,
  className,
  interview,
  timeZone,
  cancelingId,
  mutationError,
  onPrepare,
  onCancelRequest,
  onCancelKeep,
  onTransition,
}: {
  ref: Ref<HTMLElement>;
  className?: string;
  interview: WorkspaceInterview;
  timeZone: string;
  cancelingId: string | null;
  mutationError: unknown;
  onPrepare: () => void;
  onCancelRequest: (id: string) => void;
  onCancelKeep: () => void;
  onTransition: (
    interview: WorkspaceInterview,
    status: "COMPLETED" | "CANCELED",
  ) => Promise<void>;
}) {
  const applicationQuery = useApplication(interview.application_id);
  const roundsQuery = useApplicationInterviews(interview.application_id);
  const cancelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement | null>(null);
  const wasConfirmingCancelRef = useRef(false);
  const rounds = useMemo(
    () =>
      [...(roundsQuery.data?.pages.flatMap((page) => page.items) ?? [])].sort(
        (left, right) => left.scheduled_at.localeCompare(right.scheduled_at),
      ),
    [roundsQuery.data],
  );
  const roundIndex = rounds.findIndex(
    (round) => round.interview_id === interview.interview_id,
  );
  const scheduled = interview.status === "SCHEDULED";
  const completed = interview.status === "COMPLETED";

  useEffect(() => {
    if (cancelingId === interview.interview_id) {
      wasConfirmingCancelRef.current = true;
      confirmCancelRef.current?.focus();
    } else if (wasConfirmingCancelRef.current && cancelingId === null) {
      wasConfirmingCancelRef.current = false;
      cancelTriggerRef.current?.focus();
    }
  }, [cancelingId, interview.interview_id]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`${className ?? ""} min-w-0 scroll-mt-24 focus:outline-none`}
      aria-labelledby="selected-interview-title"
    >
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-panel">
        <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-accent">
              Selected interview
            </p>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${stateTone(interview)}`}
            >
              {stateLabel(interview)}
            </span>
          </div>
          <h2
            id="selected-interview-title"
            className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl"
          >
            {interview.company_name}
          </h2>
          <p className="mt-1 text-lg font-semibold text-ink-muted">
            {interview.job_title}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <time
                dateTime={interview.scheduled_at}
                className="block text-xl font-bold text-ink sm:text-2xl"
              >
                {formatTimestamp(interview.scheduled_at, timeZone)}
              </time>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
                <span>{formatInterviewType(interview.interview_type)}</span>
                <span>{interview.duration_minutes} minutes</span>
              </p>
            </div>
            {roundIndex >= 0 ? (
              <p className="w-fit rounded-full bg-surface-muted px-3 py-1.5 text-sm font-bold text-ink">
                Round {roundIndex + 1} of {rounds.length}
              </p>
            ) : null}
          </div>
          {scheduled && (interview.meeting_url || interview.location) ? (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {interview.location ? (
                  <p className="inline-flex items-center gap-2 font-semibold text-ink">
                    <MapPin aria-hidden="true" className="size-4 text-accent" />
                    {interview.location}
                  </p>
                ) : (
                  <p className="font-semibold text-ink">Online interview</p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  Confirm access before the scheduled time.
                </p>
              </div>
              {interview.meeting_url ? (
                <a
                  href={interview.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClassName(
                    interview.context.next_action === "JOIN_MEETING"
                      ? "primary"
                      : "secondary",
                  )}
                >
                  Join meeting
                  <ExternalLink
                    aria-hidden="true"
                    className="ml-1.5 size-3.5"
                  />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          {mutationError ? (
            <ErrorPanel
              compact
              title="Interview could not be updated"
              error={mutationError}
            />
          ) : null}
          <ContextCommand
            interview={interview}
            onPrepare={onPrepare}
            onTransition={onTransition}
          />
          <PreparationSnapshot interview={interview} timeZone={timeZone} />
          {rounds.length ? (
            <RoundJourney
              rounds={rounds}
              selectedId={interview.interview_id}
              timeZone={timeZone}
            />
          ) : roundsQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : null}
          <details className="group border-t border-line pt-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink marker:hidden">
              <span>Application context</span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-ink-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="grid gap-4 pb-2 pt-3 text-sm sm:grid-cols-2">
              <ContextItem
                label="Current stage"
                value={formatStatus(interview.context.application_status)}
              />
              <ContextItem
                label="Follow-up"
                value={dateOnlyLabel(interview.context.follow_up_date)}
              />
              {applicationQuery.data ? (
                <>
                  <ContextItem
                    label="Source"
                    value={
                      applicationQuery.data.source
                        ? formatSource(applicationQuery.data.source)
                        : "Not specified"
                    }
                  />
                  <ContextItem
                    label="Work mode"
                    value={
                      applicationQuery.data.work_mode
                        ? applicationQuery.data.work_mode
                            .replaceAll("_", " ")
                            .toLowerCase()
                        : "Not specified"
                    }
                  />
                </>
              ) : null}
            </div>
            <Link
              to={applicationHref(interview)}
              className="inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline"
            >
              Open full application
              <ArrowRight aria-hidden="true" className="ml-1.5 size-4" />
            </Link>
          </details>
          {scheduled ? (
            <details className="group border-t border-line pt-2">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink-muted marker:hidden">
                <span className="inline-flex items-center gap-2">
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                  More interview actions
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-wrap gap-2 pb-2 pt-2">
                <Link
                  to={applicationHref(interview)}
                  className={buttonClassName("secondary")}
                >
                  Edit or reschedule
                </Link>
                {cancelingId === interview.interview_id ? (
                  <>
                    <span className="self-center text-sm font-semibold text-danger">
                      Cancel this interview?
                    </span>
                    <button
                      ref={confirmCancelRef}
                      type="button"
                      className={buttonClassName("danger")}
                      onClick={() => void onTransition(interview, "CANCELED")}
                    >
                      Confirm cancellation
                    </button>
                    <button
                      type="button"
                      className={buttonClassName("ghost")}
                      onClick={onCancelKeep}
                    >
                      Keep interview
                    </button>
                  </>
                ) : (
                  <button
                    ref={cancelTriggerRef}
                    type="button"
                    className={buttonClassName("ghost", "text-danger")}
                    onClick={() => onCancelRequest(interview.interview_id)}
                  >
                    Cancel interview
                  </button>
                )}
              </div>
            </details>
          ) : null}
          {completed ? (
            <Link
              to={applicationHref(interview)}
              className={buttonClassName("secondary", "w-full sm:w-auto")}
            >
              Schedule next round
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
};

function ContextCommand({
  interview,
  onPrepare,
  onTransition,
}: {
  interview: WorkspaceInterview;
  onPrepare: () => void;
  onTransition: (
    interview: WorkspaceInterview,
    status: "COMPLETED" | "CANCELED",
  ) => Promise<void>;
}) {
  const state = interview.context.workflow_state;
  let eyebrow = "What to do now";
  let title = "Keep this interview journey moving";
  let description = "Review the interview context and choose the next step.";
  let action: ReactNode = (
    <Link
      to={applicationHref(interview)}
      className={buttonClassName("primary")}
    >
      Open application
    </Link>
  );
  if (state === "IMMINENT") {
    eyebrow = "Attend";
    title = "Your interview is coming up soon";
    description = interview.meeting_url
      ? "The meeting link is ready above. Use the remaining time for a final preparation check."
      : "Confirm the location and review any unfinished preparation before the interview.";
    action = interview.meeting_url ? (
      <a
        href={interview.meeting_url}
        target="_blank"
        rel="noreferrer"
        className={buttonClassName("primary")}
      >
        Join meeting
        <ExternalLink aria-hidden="true" className="ml-1.5 size-3.5" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : (
      <button
        type="button"
        className={buttonClassName("primary")}
        onClick={onPrepare}
      >
        Review preparation
      </button>
    );
  }
  if (state === "PREPARE") {
    eyebrow = "Prepare";
    title = "Continue your preparation";
    description =
      "Work through the remaining checklist, questions, and private preparation notes.";
    action = (
      <button
        type="button"
        className={buttonClassName("primary")}
        onClick={onPrepare}
      >
        Continue preparation
      </button>
    );
  }
  if (state === "UPCOMING") {
    eyebrow = "Ready";
    title = "Preparation is complete";
    description =
      "Keep the time and access details close. You can still review your preparation before the conversation.";
    action = (
      <button
        type="button"
        className={buttonClassName("secondary")}
        onClick={onPrepare}
      >
        Review preparation
      </button>
    );
  }
  if (state === "MISSED") {
    eyebrow = "Confirm";
    title = "The scheduled time has passed";
    description =
      "Mark the interview complete if it happened, then capture what you learned. Otherwise, edit or reschedule it from the application.";
    action = (
      <button
        type="button"
        className={buttonClassName("primary")}
        onClick={() => void onTransition(interview, "COMPLETED")}
      >
        Mark complete
      </button>
    );
  }
  if (state === "CAPTURE") {
    eyebrow = "Capture";
    title = "Record what happened while it is fresh";
    description =
      "Save your private reflection, signals you noticed, and the concrete next step. This does not assume an outcome.";
    action = (
      <button
        type="button"
        className={buttonClassName("primary")}
        onClick={onPrepare}
      >
        Capture interview notes
      </button>
    );
  }
  if (state === "FOLLOW_UP") {
    eyebrow = "Follow up";
    title = followUpLabel(interview);
    description =
      "HireFlux uses the application follow-up date as the single next-step system for this interview journey.";
    action = (
      <Link to={followUpHref(interview)} className={buttonClassName("primary")}>
        Review follow-up
      </Link>
    );
  }
  if (state === "HISTORY" || state === "CANCELED") {
    eyebrow = "History";
    title =
      state === "CANCELED"
        ? "This interview was canceled"
        : "This round is complete";
    description =
      "Review the connected interview rounds or open the application for the full record.";
  }
  return (
    <section
      className="rounded-2xl bg-surface-muted p-4 sm:p-5"
      aria-labelledby="current-command-title"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
        {eyebrow}
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="current-command-title" className="text-lg font-bold text-ink">
            {title}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">
            {description}
          </p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </section>
  );
}

function PreparationSnapshot({
  interview,
  timeZone,
}: {
  interview: WorkspaceInterview;
  timeZone: string;
}) {
  if (interview.status === "CANCELED") return null;
  const completed = new Set(interview.completed_checklist_items);
  const isDebrief = interview.status === "COMPLETED";
  return (
    <section aria-labelledby="preparation-snapshot-title">
      <div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            {isDebrief ? "Private reflection" : "Preparation"}
          </p>
          <h3
            id="preparation-snapshot-title"
            className="mt-1 text-lg font-bold text-ink"
          >
            {isDebrief
              ? interview.debrief_completed_at
                ? "Debrief complete"
                : "Debrief not captured yet"
              : `${interview.guidance.readiness.completed_steps} of ${interview.guidance.readiness.total_steps} ready`}
          </h3>
        </div>
      </div>
      {!isDebrief ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {interview.guidance.checklist_items.map((item) => {
            const done = completed.has(item.item_id);
            return (
              <li
                key={item.item_id}
                className="flex items-start gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm"
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-success-soft text-success" : "bg-surface-muted text-ink-muted"}`}
                >
                  {done ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Circle aria-hidden="true" className="size-3" />
                  )}
                </span>
                <span
                  className={
                    done
                      ? "text-ink-muted line-through"
                      : "font-semibold text-ink"
                  }
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : interview.debrief_completed_at ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Saved {formatTimestamp(interview.debrief_completed_at, timeZone)}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Capture what went well, what you would improve, signals you noticed,
          and the next step.
        </p>
      )}
    </section>
  );
}

function RoundJourney({
  rounds,
  selectedId,
  timeZone,
}: {
  rounds: Interview[];
  selectedId: string;
  timeZone: string;
}) {
  return (
    <section
      className="border-t border-line pt-6"
      aria-labelledby="round-journey-title"
    >
      <div className="flex items-center gap-2">
        <Route aria-hidden="true" className="size-4 text-violet" />
        <h3 id="round-journey-title" className="font-bold text-ink">
          Interview process
        </h3>
      </div>
      <ol className="mt-4 space-y-0 border-l-2 border-line pl-5">
        {rounds.map((round, index) => {
          const selected = round.interview_id === selectedId;
          return (
            <li key={round.interview_id} className="relative pb-5 last:pb-0">
              <span
                aria-hidden="true"
                className={`absolute -left-[1.68rem] top-1 size-3 rounded-full border-2 border-surface ${selected ? "bg-accent" : round.status === "COMPLETED" ? "bg-success" : "bg-line-strong"}`}
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-sm font-bold ${selected ? "text-accent" : "text-ink"}`}
                  >
                    Round {index + 1} ·{" "}
                    {formatInterviewType(round.interview_type)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {formatTimestamp(round.scheduled_at, timeZone)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-ink-muted">
                  {selected
                    ? "Selected"
                    : round.status === "COMPLETED"
                      ? "Completed"
                      : round.status === "CANCELED"
                        ? "Canceled"
                        : "Scheduled"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.13em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 font-semibold capitalize text-ink">{value}</dd>
    </div>
  );
}

function InterviewsSkeleton() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.35fr)]"
      role="status"
      aria-label="Loading interviews"
    >
      <span className="sr-only">Loading interviews…</span>
      <div aria-hidden="true">
        <PanelSkeleton rows={6} />
      </div>
      <div
        aria-hidden="true"
        className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-panel"
      >
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-5 h-9 w-3/5" />
        <Skeleton className="mt-3 h-5 w-2/5" />
        <div className="mt-6">
          <PanelSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}
