import {
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
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
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Application, Interview, WorkspaceInterview } from "../api/schemas";
import type { InterviewFields } from "../api/resources";
import { buttonClassName } from "../components/ui/buttonStyles";
import { EmptyState, ErrorPanel } from "../components/ui/Feedback";
import { PanelSkeleton, Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toastContext";
import { WorkspaceFrame, WorkspaceIntro } from "../components/ui/WorkspaceComposition";
import {
  formatInterviewType,
  formatSource,
  formatStatus,
  formatTimestamp,
} from "../features/applications/format";
import { useApplication } from "../features/applications/queries";
import {
  applicationsRouteStateWithoutIntent,
  readApplicationsRouteState,
  type ApplicationsRouteState,
} from "../features/applications/opportunityNavigation";
import { InterviewFocusedWorkspace } from "../features/resources/InterviewWorkspaceDrawer";
import { InterviewScheduleWorkspace } from "../features/resources/InterviewScheduleWorkspace";
import {
  useApplicationInterviews,
  useCreateInterview,
  useSettings,
  useTransitionWorkspaceInterview,
  useUpdateInterview,
  useWorkspaceInterviews,
} from "../features/resources/queries";

const ATTENTION_WORKFLOW_STATES = new Set([
  "PREPARE",
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

function applicationHref(interview: WorkspaceInterview) {
  return `/applications/${interview.application_id}?section=interviews&interview=${interview.interview_id}`;
}

function followUpHref(interview: WorkspaceInterview) {
  return `/applications/${interview.application_id}/edit?focus=follow_up`;
}

function dateOnlyLabel(value: string | null) {
  if (!value) return "No check-back date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function nextStepLabel(interview: WorkspaceInterview) {
  const responsibility = interview.context.next_step_responsibility;
  if (responsibility === "CANDIDATE") return "Candidate action due";
  if (responsibility === "EMPLOYER") return "Check-back due";
  return "Next step needs review";
}

function stateLabel(interview: WorkspaceInterview) {
  if (
    interview.status === "SCHEDULED" &&
    interview.context.workflow_state === "HISTORY"
  ) {
    return "Opportunity no longer active";
  }
  switch (interview.context.workflow_state) {
    case "IMMINENT":
      return "Starts soon";
    case "PREPARE":
      return "Preparation essentials remain";
    case "UPCOMING":
      return "Essentials prepared";
    case "MISSED":
      return "Confirm what happened";
    case "CAPTURE":
      return "Reflection needed";
    case "FOLLOW_UP":
      return nextStepLabel(interview);
    case "CANCELED":
      return "Canceled";
    default:
      return interview.status === "COMPLETED"
        ? "Reflection saved"
        : "Past interview";
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
      return interview.context.next_step_responsibility === "CANDIDATE"
        ? `You have an action to complete for ${company}.`
        : interview.context.next_step_responsibility === "EMPLOYER"
          ? `It is time to check back with ${company}.`
          : `Review what should happen next with ${company}.`;
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
  const location = useLocation();
  const navigate = useNavigate();
  const [applicationsOrigin] = useState(() =>
    readApplicationsRouteState(location.state),
  );
  const automaticIntentHandled = useRef(false);
  const automaticPreparationTriggerRef = useRef<HTMLButtonElement>(null);
  const applicationRouteState = applicationsOrigin
    ? applicationsRouteStateWithoutIntent(applicationsOrigin)
    : undefined;
  const interviewsQuery = useWorkspaceInterviews();
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaceInterview, setWorkspaceInterview] =
    useState<Interview | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleApplication, setScheduleApplication] = useState<Pick<
    Application,
    "application_id" | "company_name" | "job_title"
  > | null>(null);
  const [scheduleEditing, setScheduleEditing] = useState<Interview | null>(null);
  const [interviewSwitcherOpen, setInterviewSwitcherOpen] = useState(false);
  const detailRef = useRef<HTMLElement | null>(null);
  const transitionMutation = useTransitionWorkspaceInterview();
  const { showToast } = useToast();
  const scheduleApplicationId = scheduleApplication?.application_id ?? "";
  const createInterviewMutation = useCreateInterview(scheduleApplicationId);
  const updateInterviewMutation = useUpdateInterview(scheduleApplicationId);

  const interviews = useMemo(
    () =>
      [
        ...(interviewsQuery.data?.pages.flatMap((page) => page.items) ?? []),
      ].sort((left, right) =>
        left.scheduled_at.localeCompare(right.scheduled_at),
      ),
    [interviewsQuery.data],
  );
  const needsAttention = interviews
    .filter((interview) =>
      ATTENTION_WORKFLOW_STATES.has(interview.context.workflow_state),
    )
    .sort((left, right) => {
      const priority =
        STATE_PRIORITY[left.context.workflow_state] -
        STATE_PRIORITY[right.context.workflow_state];
      return priority || left.scheduled_at.localeCompare(right.scheduled_at);
    });
  const upcoming = interviews
    .filter((interview) => interview.context.workflow_state === "UPCOMING")
    .sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at));
  const completed = interviews
    .filter((interview) =>
      ["HISTORY", "CANCELED"].includes(interview.context.workflow_state),
    )
    .sort((left, right) => right.scheduled_at.localeCompare(left.scheduled_at));
  const activeCount = needsAttention.length + upcoming.length;
  const requestedId = searchParams.get("interview");
  const requestedInterview = requestedId
    ? interviews.find((interview) => interview.interview_id === requestedId) ?? null
    : null;
  const selected = requestedId ? requestedInterview : preferredInterview(interviews);
  const resolvingRequestedInterview = Boolean(
    requestedId &&
      !requestedInterview &&
      (interviewsQuery.isPending ||
        interviewsQuery.isFetching ||
        interviewsQuery.isFetchingNextPage ||
        interviewsQuery.hasNextPage),
  );
  const requestedInterviewMissing = Boolean(
    requestedId &&
      !requestedInterview &&
      interviewsQuery.isSuccess &&
      !interviewsQuery.isFetching &&
      !interviewsQuery.isFetchingNextPage &&
      !interviewsQuery.hasNextPage,
  );

  useEffect(() => {
    if (
      !requestedId ||
      requestedInterview ||
      !interviewsQuery.hasNextPage ||
      interviewsQuery.isFetching ||
      interviewsQuery.isFetchingNextPage
    ) {
      return;
    }
    void interviewsQuery.fetchNextPage();
  }, [
    interviewsQuery,
    requestedId,
    requestedInterview,
  ]);

  useEffect(() => {
    if (requestedId || !selected) return;
    const next = new URLSearchParams(searchParams);
    next.set("interview", selected.interview_id);
    setSearchParams(next, { replace: true });
  }, [requestedId, searchParams, selected, setSearchParams]);

  useEffect(() => {
    if (
      applicationsOrigin?.intent !== "OPEN_INTERVIEW_PREPARATION" ||
      automaticIntentHandled.current ||
      !requestedInterview
    ) {
      return;
    }
    automaticIntentHandled.current = true;
    automaticPreparationTriggerRef.current?.focus();
    setWorkspaceInterview(requestedInterview);
    void navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: applicationsRouteStateWithoutIntent(applicationsOrigin),
    });
  }, [
    applicationsOrigin,
    location.pathname,
    location.search,
    navigate,
    requestedInterview,
  ]);

  function selectInterview(interview: WorkspaceInterview) {
    setInterviewSwitcherOpen(false);
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

  function openSchedule(
    application: Pick<Application, "application_id" | "company_name" | "job_title"> | null,
    editing: Interview | null = null,
  ) {
    setScheduleApplication(application);
    setScheduleEditing(editing);
    setScheduleOpen(true);
  }

  async function scheduleInterview(applicationId: string, fields: InterviewFields) {
    if (applicationId !== scheduleApplicationId) return;
    try {
      const saved = scheduleEditing
        ? await updateInterviewMutation.mutateAsync({
            interviewId: scheduleEditing.interview_id,
            version: scheduleEditing.version,
            fields,
          })
        : await createInterviewMutation.mutateAsync(fields);
      setScheduleOpen(false);
      setScheduleApplication(null);
      setScheduleEditing(null);
      const next = new URLSearchParams(searchParams);
      next.set("interview", saved.interview_id);
      setSearchParams(next);
      showToast(scheduleEditing ? "Interview updated." : "Interview scheduled.", {
        title: scheduleEditing ? "Interview updated" : "Interview scheduled",
        tone: "success",
      });
    } catch {
      return;
    }
  }

  return (
    <WorkspaceFrame width="wide" className="pb-6 sm:pb-8">
      {applicationsOrigin ? (
        <Link
          to={applicationsOrigin.returnTo}
          className="mb-3 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back to applications
        </Link>
      ) : null}
      <WorkspaceIntro title="Interviews" lead={orientation(selected, activeCount)} context={<span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-3.5" />Times shown in {timeZone.replaceAll("_", " ")}</span>} actions={<button type="button" className={buttonClassName("secondary", "gap-2")} onClick={() => openSchedule(selected)}><CalendarPlus aria-hidden="true" className="size-4" />Schedule interview</button>} />

      <div className="mt-6">
        {interviewsQuery.isPending ? <InterviewsSkeleton /> : null}
        {interviewsQuery.isError ? (
          <ErrorPanel
            title="Interviews could not be loaded"
            error={interviewsQuery.error}
            onRetry={() => void interviewsQuery.refetch()}
          />
        ) : null}
        {interviewsQuery.isSuccess && interviews.length === 0 && !requestedId ? (
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
        {resolvingRequestedInterview ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-line-subtle bg-surface p-6">
            <p className="font-semibold text-ink">Finding the requested interview…</p>
            <p className="mt-1 text-sm text-ink-muted">Checking the rest of your interview history.</p>
          </div>
        ) : null}
        {requestedInterviewMissing ? (
          <EmptyState
            title="Interview not found"
            description="This interview is not available in the current demo workspace. It may have expired or the link may be incorrect."
            action={preferredInterview(interviews) ? (
              <button
                type="button"
                className={buttonClassName("primary")}
                onClick={() => {
                  const preferred = preferredInterview(interviews);
                  if (!preferred) return;
                  const next = new URLSearchParams(searchParams);
                  next.set("interview", preferred.interview_id);
                  setSearchParams(next, { replace: true });
                }}
              >
                Open current interview
              </button>
            ) : undefined}
          />
        ) : null}
        {selected ? (
          <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(17rem,0.58fr)_minmax(0,1.42fr)]">
            <SchedulePane
              className="lg:sticky lg:top-24"
              needsAttention={needsAttention}
              upcoming={upcoming}
              completed={completed}
              selected={selected}
              timeZone={timeZone}
              onSelect={selectInterview}
              hasNextPage={Boolean(interviewsQuery.hasNextPage)}
              isFetchingNextPage={interviewsQuery.isFetchingNextPage}
              onLoadMore={() => void interviewsQuery.fetchNextPage()}
              compactOpen={interviewSwitcherOpen}
              onCompactToggle={() => setInterviewSwitcherOpen((value) => !value)}
            />
            <InterviewDetail
              ref={detailRef}
              interview={selected}
              timeZone={timeZone}
              cancelingId={cancelingId}
              mutationError={transitionMutation.error}
              onOpenWorkspace={setWorkspaceInterview}
              onCancelRequest={setCancelingId}
              onCancelKeep={() => setCancelingId(null)}
              onTransition={transition}
              onSchedule={() => openSchedule(selected)}
              onEditSchedule={() => openSchedule(selected, selected)}
              applicationRouteState={applicationRouteState}
              primaryActionRef={automaticPreparationTriggerRef}
            />
          </div>
        ) : null}
      </div>

      {workspaceInterview ? (
        <InterviewFocusedWorkspace
          key={workspaceInterview.interview_id}
          applicationId={workspaceInterview.application_id}
          interview={workspaceInterview}
          timeZone={timeZone}
          onClose={() => setWorkspaceInterview(null)}
          onEditSchedule={() => {
            setWorkspaceInterview(null);
            openSchedule(workspaceInterview, workspaceInterview);
          }}
        />
      ) : null}
      <InterviewScheduleWorkspace
        open={scheduleOpen}
        application={scheduleApplication}
        editing={scheduleEditing}
        timeZone={timeZone}
        isSaving={createInterviewMutation.isPending || updateInterviewMutation.isPending}
        error={createInterviewMutation.error ?? updateInterviewMutation.error}
        onApplicationChange={setScheduleApplication}
        onClose={() => { setScheduleOpen(false); setScheduleApplication(null); setScheduleEditing(null); createInterviewMutation.reset(); updateInterviewMutation.reset(); }}
        onSubmit={scheduleInterview}
      />
    </WorkspaceFrame>
  );
}

function SchedulePane({
  className,
  needsAttention,
  upcoming,
  completed,
  selected,
  timeZone,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  compactOpen,
  onCompactToggle,
}: {
  className?: string;
  needsAttention: WorkspaceInterview[];
  upcoming: WorkspaceInterview[];
  completed: WorkspaceInterview[];
  selected: WorkspaceInterview;
  timeZone: string;
  onSelect: (interview: WorkspaceInterview) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  compactOpen: boolean;
  onCompactToggle: () => void;
}) {
  const compactRegionId = "responsive-interview-queue";
  return (
    <aside
      className={`${className ?? ""} min-w-0`}
      aria-labelledby="schedule-title"
    >
      <div className="border-y border-line bg-surface-muted/30 lg:border-y-0 lg:border-r lg:bg-transparent">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Your next steps
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h2 id="schedule-title" className="text-xl font-bold text-ink">
                Interview queue
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
            {needsAttention.length
              ? `${needsAttention.length} interview${needsAttention.length === 1 ? "" : "s"} ${needsAttention.length === 1 ? "needs" : "need"} attention. Select one to continue.`
              : upcoming.length
                ? `${upcoming.length} prepared interview ${upcoming.length === 1 ? "is" : "are"} coming up.`
              : "Nothing needs action right now."}
              </p>
            </div>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-ink-muted">
              {needsAttention.length + upcoming.length + completed.length}
            </span>
          </div>
          <button
            type="button"
            className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
            aria-expanded={compactOpen}
            aria-controls={compactRegionId}
            aria-label={compactOpen ? "Hide interview choices" : "Switch interview"}
            aria-describedby="current-interview-selection"
            onClick={onCompactToggle}
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink-muted">Viewing</span>
              <span id="current-interview-selection" className="block truncate font-bold text-ink">{selected.company_name} · {formatInterviewType(selected.interview_type)}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{stateLabel(selected)}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-accent">
              Switch
              <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${compactOpen ? "rotate-180" : ""}`} />
            </span>
          </button>
        </div>

        <div id={compactRegionId} className={`${compactOpen ? "block" : "hidden"} divide-y divide-line lg:block`}>
          <QueueGroup
            id="needs-attention"
            title="Needs attention"
            interviews={needsAttention}
            selectedId={selected.interview_id}
            timeZone={timeZone}
            onSelect={onSelect}
          />
          <QueueGroup
            id="upcoming"
            title="Upcoming"
            interviews={upcoming}
            selectedId={selected.interview_id}
            timeZone={timeZone}
            onSelect={onSelect}
          />

        {completed.length ? (
          <details
            className="group border-t border-line"
            open={needsAttention.length === 0 && upcoming.length === 0}
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold text-ink marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
              <span>
                Completed{" "}
                <span className="ml-1 text-sm text-ink-muted">
                  {completed.length}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-ink-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <QueueRows
              interviews={completed}
              selectedId={selected.interview_id}
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
              {isFetchingNextPage ? "Loading more…" : "Load more interviews"}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </aside>
  );
}

function QueueGroup({
  id,
  title,
  interviews,
  selectedId,
  timeZone,
  onSelect,
}: {
  id: string;
  title: string;
  interviews: WorkspaceInterview[];
  selectedId: string;
  timeZone: string;
  onSelect: (interview: WorkspaceInterview) => void;
}) {
  if (!interviews.length) return null;
  return (
    <section className="px-2 py-3" aria-labelledby={`queue-${id}`}>
      <h3
        id={`queue-${id}`}
        className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.17em] text-ink-muted"
      >
        {title} <span className="ml-1">{interviews.length}</span>
      </h3>
      <QueueRows
        interviews={interviews}
        selectedId={selectedId}
        timeZone={timeZone}
        onSelect={onSelect}
      />
    </section>
  );
}

function QueueRows({
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
        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? "border-accent bg-surface-selected" : "border-transparent hover:border-line hover:bg-surface-hover active:bg-surface-pressed"}`}
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
            <span className="mt-2 block text-xs font-semibold leading-5 text-ink-muted">
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
  onOpenWorkspace,
  onCancelRequest,
  onCancelKeep,
  onTransition,
  onSchedule,
  onEditSchedule,
  applicationRouteState,
  primaryActionRef,
}: {
  ref: Ref<HTMLElement>;
  className?: string;
  interview: WorkspaceInterview;
  timeZone: string;
  cancelingId: string | null;
  mutationError: unknown;
  onOpenWorkspace: (interview: Interview) => void;
  onCancelRequest: (id: string) => void;
  onCancelKeep: () => void;
  onTransition: (
    interview: WorkspaceInterview,
    status: "COMPLETED" | "CANCELED",
  ) => Promise<void>;
  onSchedule: () => void;
  onEditSchedule: () => void;
  applicationRouteState?: ApplicationsRouteState;
  primaryActionRef?: Ref<HTMLButtonElement>;
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
  const previousRound = scheduled
    ? [...rounds]
        .filter(
          (round) =>
            round.status === "COMPLETED" &&
            Boolean(round.debrief_completed_at) &&
            round.scheduled_at < interview.scheduled_at,
        )
        .sort((left, right) =>
          right.scheduled_at.localeCompare(left.scheduled_at),
        )[0] ?? null
    : null;

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
      <div className="overflow-hidden">
        <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-accent">
            Selected interview
          </p>
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
                <p className="text-sm font-semibold text-accent">
                  Meeting link ready
                </p>
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
            onOpenWorkspace={() => onOpenWorkspace(interview)}
            onTransition={onTransition}
            applicationRouteState={applicationRouteState}
            primaryActionRef={primaryActionRef}
          />
          <LifecycleIndicator interview={interview} />
          <PreparationSnapshot
            interview={interview}
            timeZone={timeZone}
            onOpenWorkspace={() => onOpenWorkspace(interview)}
          />
          {previousRound ? (
            <PreviousRoundContext
              interview={previousRound}
              roundNumber={rounds.findIndex(
                (round) => round.interview_id === previousRound.interview_id,
              ) + 1}
              onReview={() => onOpenWorkspace(previousRound)}
            />
          ) : null}
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
              state={applicationRouteState}
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
                <button
                  type="button"
                  onClick={onEditSchedule}
                  className={buttonClassName("secondary")}
                >
                  Edit or reschedule
                </button>
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
            <details className="group border-t border-line pt-2">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink-muted marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                <span>Related journey actions</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="pb-2 pt-2">
                <button
                  type="button"
                  onClick={onSchedule}
                  className={buttonClassName("secondary", "w-full sm:w-auto")}
                >
                  Schedule another round
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
};

function LifecycleIndicator({ interview }: { interview: WorkspaceInterview }) {
  const steps = ["Prepare", "Interview", "Reflect", "Follow up", "Next round"];
  const state = interview.context.workflow_state;
  if (state === "CANCELED") {
    return (
      <section
        className="rounded-2xl border border-line bg-surface-muted p-4"
        aria-labelledby="interview-lifecycle-title"
      >
        <p
          id="interview-lifecycle-title"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Interview lifecycle
        </p>
        <p className="mt-2 font-semibold text-ink">Canceled interview</p>
        <p className="mt-1 text-sm text-ink-muted">
          This round remains in your history without being shown as completed.
        </p>
      </section>
    );
  }
  if (state === "HISTORY" && interview.status === "SCHEDULED") {
    return (
      <section className="rounded-2xl border border-line bg-surface-muted p-4" aria-labelledby="interview-lifecycle-title">
        <p id="interview-lifecycle-title" className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Interview lifecycle
        </p>
        <p className="mt-2 font-semibold text-ink">Opportunity no longer active</p>
        <p className="mt-1 text-sm text-ink-muted">This scheduled record remains available without creating new preparation or follow-up pressure.</p>
      </section>
    );
  }
  const currentIndex =
    state === "PREPARE"
      ? 0
      : ["UPCOMING", "IMMINENT", "MISSED"].includes(state)
        ? 1
        : state === "CAPTURE"
          ? 2
          : state === "FOLLOW_UP"
            ? 3
            : -1;
  const completedThrough = state === "HISTORY" ? 3 : currentIndex - 1;
  return (
    <section aria-labelledby="interview-lifecycle-title">
      <h3
        id="interview-lifecycle-title"
        className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
      >
        Interview lifecycle
      </h3>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted px-3 py-3 sm:hidden">
        <div>
          <p className="text-xs font-semibold text-ink-muted">Current step</p>
          <p className="mt-0.5 font-bold text-ink">{currentIndex >= 0 ? steps[currentIndex] : "Journey complete"}</p>
        </div>
        <span className="text-xs font-semibold text-ink-muted">{currentIndex >= 0 ? `${currentIndex + 1} of ${steps.length}` : "4 steps complete"}</span>
      </div>
      <ol className="relative mt-5 hidden grid-cols-5 gap-3 before:absolute before:left-[10%] before:right-[10%] before:top-3 before:h-px before:bg-line sm:grid">
        {steps.map((step, index) => {
          const isComplete = index <= completedThrough;
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className={`relative z-10 text-center text-xs font-semibold ${isCurrent ? "text-accent" : isComplete ? "text-success" : "text-ink-muted"}`}
            >
              <span aria-hidden="true" className={`mx-auto mb-2 block size-6 rounded-full border-4 border-canvas ${isCurrent ? "bg-accent" : isComplete ? "bg-success" : "bg-line"}`} />
              <span className="block text-[0.65rem] uppercase tracking-wide">
                {isComplete
                  ? "Complete"
                  : isCurrent
                    ? state === "MISSED"
                      ? "Unresolved"
                      : "Current"
                    : state === "HISTORY" && step === "Next round"
                      ? "Optional"
                      : "Later"}
              </span>
              <span className="mt-0.5 block">{step}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ContextCommand({
  interview,
  onOpenWorkspace,
  onTransition,
  applicationRouteState,
  primaryActionRef,
}: {
  interview: WorkspaceInterview;
  onOpenWorkspace: () => void;
  onTransition: (
    interview: WorkspaceInterview,
    status: "COMPLETED" | "CANCELED",
  ) => Promise<void>;
  applicationRouteState?: ApplicationsRouteState;
  primaryActionRef?: Ref<HTMLButtonElement>;
}) {
  const state = interview.context.workflow_state;
  let eyebrow = "What to do now";
  let title = "Keep this interview journey moving";
  let description = "Review the interview context and choose the next step.";
  let action: ReactNode;
  if (state === "IMMINENT") {
    eyebrow = "Attend";
    title = "Your interview is coming up soon";
    description = interview.meeting_url
      ? "The meeting link is ready above. Use the remaining time for a final preparation check."
      : "Confirm the location and review any unfinished preparation before the interview.";
  }
  if (state === "PREPARE") {
    eyebrow = "Prepare";
    title = "Continue your preparation";
    description =
      "Work through the remaining checklist, questions, and private preparation notes.";
  }
  if (state === "UPCOMING") {
    eyebrow = "Ready";
    title = "Preparation is complete";
    description =
      "Keep the time and access details close. You can still review your preparation before the conversation.";
  }
  if (state === "MISSED") {
    eyebrow = "Confirm";
    title = "The scheduled time has passed";
    description =
      "Mark the interview complete if it happened, then capture what you learned. Otherwise, edit or reschedule it from the application.";
  }
  if (state === "CAPTURE") {
    eyebrow = "Reflect";
    title = "Capture what stands out while it is fresh";
    description =
      "Save a private takeaway now. You can add deeper reflection and carry-forward context if it is useful.";
  }
  if (state === "FOLLOW_UP") {
    eyebrow = "Act";
    title = nextStepLabel(interview);
    description =
      interview.context.next_step_responsibility === "CANDIDATE"
        ? interview.context.next_step_note ??
          "You still have a candidate-owned action for this opportunity."
        : interview.context.next_step_responsibility === "EMPLOYER"
          ? "Your check-back is due. Review the opportunity before contacting the employer."
          : "You still need to decide the next step for this opportunity.";
  }
  if (state === "HISTORY" || state === "CANCELED") {
    eyebrow = "History";
    title =
      state === "CANCELED"
        ? "This interview was canceled"
        : interview.status === "SCHEDULED"
          ? "This opportunity is no longer active"
        : "This round is complete";
    description =
      state === "CANCELED"
        ? "Open the application to review the record or schedule a replacement round."
        : interview.status === "SCHEDULED"
          ? "The scheduled record remains available in history. Open the application if the opportunity status needs correction."
        : "Your reflection is saved and available whenever you want to revisit this round.";
  }
  switch (interview.context.next_action) {
    case "PREPARE":
      action = (
        <button
          ref={primaryActionRef}
          type="button"
          className={buttonClassName("primary")}
          onClick={onOpenWorkspace}
        >
          {state === "PREPARE" ? "Continue preparation" : "Review preparation"}
        </button>
      );
      break;
    case "JOIN_MEETING":
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
        <Link
          to={applicationHref(interview)}
          state={applicationRouteState}
          className={buttonClassName("primary")}
        >
          Open application
        </Link>
      );
      break;
    case "MARK_COMPLETE":
      action = (
        <button
          type="button"
          className={buttonClassName("primary")}
          onClick={() => void onTransition(interview, "COMPLETED")}
        >
          Mark complete
        </button>
      );
      break;
    case "CAPTURE_NOTES":
      action = (
        <button
          type="button"
          className={buttonClassName("primary")}
          onClick={onOpenWorkspace}
        >
          Capture reflection
        </button>
      );
      break;
    case "REVIEW_FOLLOW_UP":
      action = (
        <Link
          to={followUpHref(interview)}
          state={applicationRouteState}
          className={buttonClassName("primary")}
        >
          Review next step
        </Link>
      );
      break;
    case "REVIEW_DEBRIEF":
      action = (
        <button
          type="button"
          className={buttonClassName("primary")}
          onClick={onOpenWorkspace}
        >
          Review reflection
        </button>
      );
      break;
    default:
      action = (
        <Link
          to={applicationHref(interview)}
          state={applicationRouteState}
          className={buttonClassName("primary")}
        >
          Open application
        </Link>
      );
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
  onOpenWorkspace,
}: {
  interview: WorkspaceInterview;
  timeZone: string;
  onOpenWorkspace: () => void;
}) {
  if (interview.status === "CANCELED") return null;
  if (
    interview.status === "SCHEDULED" &&
    interview.context.workflow_state === "HISTORY"
  ) return null;
  const completed = new Set(interview.completed_checklist_items);
  const isDebrief = interview.status === "COMPLETED";
  if (isDebrief && !interview.debrief_completed_at) return null;
  const reflection = reflectionExcerpts(interview);
  return (
    <section aria-labelledby="preparation-snapshot-title">
      <div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            {isDebrief ? "Saved reflection" : "Preparation"}
          </p>
          <h3
            id="preparation-snapshot-title"
            className="mt-1 text-lg font-bold text-ink"
          >
            {isDebrief
              ? "Interview reflection"
              : interview.guidance.progress.essentials.complete
                ? "Essentials prepared"
                : `${interview.guidance.progress.essentials.total - interview.guidance.progress.essentials.completed} essentials remaining`}
          </h3>
        </div>
      </div>
      {!isDebrief ? (
        <div className="mt-4 space-y-4">
          <PreparationItemList
            items={interview.guidance.checklist_items.filter(
              (item) => item.category === "ESSENTIAL",
            )}
            completed={completed}
          />
          {interview.guidance.checklist_items.some(
            (item) => item.category !== "ESSENTIAL",
          ) ? (
            <details className="group rounded-xl border border-line bg-surface-muted px-3 py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink marker:hidden">
                <span>More preparation</span>
                <ChevronDown aria-hidden="true" className="size-4 text-ink-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-line pb-1 pt-3">
                {(["ADDITIONAL", "CANDIDATE"] as const).map((category) => {
                  const items = interview.guidance.checklist_items.filter(
                    (item) => item.category === category,
                  );
                  if (!items.length) return null;
                  return (
                    <section key={category} aria-label={category === "ADDITIONAL" ? "Additional preparation" : "Personal preparation"}>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
                        {category === "ADDITIONAL" ? "Additional preparation" : "Personal preparation"}
                      </h4>
                      <PreparationItemList items={items} completed={completed} />
                    </section>
                  );
                })}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            Completed {formatTimestamp(interview.debrief_completed_at!, timeZone)}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {reflection.map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-xl border border-line bg-surface-raised p-3"
              >
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 line-clamp-4 text-sm leading-6 text-ink">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className={`${buttonClassName("secondary")} mt-4`}
            onClick={onOpenWorkspace}
          >
            Review reflection
          </button>
        </div>
      )}
    </section>
  );
}

function PreparationItemList({
  items,
  completed,
}: {
  items: WorkspaceInterview["guidance"]["checklist_items"];
  completed: Set<string>;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const done = completed.has(item.item_id) || item.completed;
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
            <span className={done ? "text-ink-muted line-through" : "font-semibold text-ink"}>
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function reflectionExcerpts(interview: Interview) {
  const items: Array<{ label: string; value: string }> = [];
  if (interview.debrief_primary_reflection) {
    items.push({
      label: "Takeaway",
      value: interview.debrief_primary_reflection,
    });
  }
  if (interview.debrief_went_well) {
    items.push({ label: "Went well", value: interview.debrief_went_well });
  }
  if (interview.debrief_carry_forward) {
    items.push({
      label: "Carry forward",
      value: interview.debrief_carry_forward,
    });
  }
  if (interview.debrief_improve) {
    items.push({ label: "Could improve", value: interview.debrief_improve });
  }
  if (interview.debrief_signals) {
    items.push({ label: "Signals noticed", value: interview.debrief_signals });
  }
  return items.slice(0, 3);
}

function PreviousRoundContext({
  interview,
  roundNumber,
  onReview,
}: {
  interview: Interview;
  roundNumber: number;
  onReview: () => void;
}) {
  const signals: Array<{ label: string; value: string }> = [];
  if (interview.debrief_carry_forward) {
    signals.push({
      label: "Carry forward",
      value: interview.debrief_carry_forward,
    });
  }
  if (interview.debrief_primary_reflection) {
    signals.push({
      label: "Prior round takeaway",
      value: interview.debrief_primary_reflection,
    });
  }
  const visible = signals.slice(0, 2);
  if (!visible.length) return null;
  return (
    <section
      className="rounded-2xl border border-violet/20 bg-violet-soft p-4 sm:p-5"
      aria-labelledby="previous-round-context-title"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">
        From Round {roundNumber} · {formatInterviewType(interview.interview_type)}
      </p>
      <h3
        id="previous-round-context-title"
        className="mt-1 text-lg font-bold text-ink"
      >
        Previous round context
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {visible.map((signal) => (
          <div key={signal.label}>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {signal.label}
            </dt>
            <dd className="mt-1 text-sm leading-6 text-ink">{signal.value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className={`${buttonClassName("secondary")} mt-4`}
        onClick={onReview}
      >
        Review Round {roundNumber} reflection
      </button>
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
        className="rounded-[1.75rem] border border-line-subtle bg-surface p-6"
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
