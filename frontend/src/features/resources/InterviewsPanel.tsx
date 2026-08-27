import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Pencil,
  Sparkles,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Interview } from "../../api/schemas";
import type { InterviewFields } from "../../api/resources";
import { Button } from "../../components/ui/Button";
import {
  ErrorPanel,
} from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/toastContext";
import { ResourcePanelSkeleton } from "../applications/ApplicationSkeletons";
import {
  formatInterviewStatus,
  formatInterviewType,
  formatTimestamp,
} from "../applications/format";
import { updateSearchTour } from "../workspace/queries";
import { InterviewScheduleWorkspace } from "./InterviewScheduleWorkspace";
import {
  useApplicationInterviews,
  useCreateInterview,
  useTransitionInterview,
  useUpdateInterview,
} from "./queries";

export function InterviewsPanel({
  applicationId,
  companyName,
  jobTitle,
  timeZone,
  focusInterviewId,
  emptyMessage = "When a conversation is booked, keep the time and preparation details together here.",
  canSchedule = true,
}: {
  applicationId: string;
  companyName: string;
  jobTitle: string;
  timeZone: string;
  focusInterviewId?: string | null;
  emptyMessage?: string;
  canSchedule?: boolean;
}) {
  const interviewsQuery = useApplicationInterviews(applicationId);
  const interviews = useMemo(
    () => (interviewsQuery.data?.pages.flatMap((page) => page.items) ?? [])
      .sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at)),
    [interviewsQuery.data],
  );
  const createMutation = useCreateInterview(applicationId);
  const updateMutation = useUpdateInterview(applicationId);
  const transitionMutation = useTransitionInterview(applicationId);
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!focusInterviewId || interviews.length === 0) return;
    const focused = interviews.find((interview) => interview.interview_id === focusInterviewId);
    if (!focused) return;
    window.setTimeout(() => {
      document.getElementById(`interview-${focused.interview_id}`)?.scrollIntoView({ block: "center" });
    }, 0);
  }, [focusInterviewId, interviews]);

  useEffect(() => {
    if (!cancelingId) return;
    const timer = window.setTimeout(
      () => document.getElementById(`confirm-cancel-interview-${cancelingId}`)?.focus(),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [cancelingId]);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    createMutation.reset();
    updateMutation.reset();
  }

  function startCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function startEdit(interview: Interview) {
    setEditing(interview);
    setShowForm(true);
  }

  async function submit(_applicationId: string, submittedFields: InterviewFields) {
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          interviewId: editing.interview_id,
          version: editing.version,
          fields: submittedFields,
        });
        showToast("Interview updated.", {
          title: "Interview updated",
          tone: "success",
        });
      } else {
        await createMutation.mutateAsync(submittedFields);
        showToast("Interview scheduled.", {
          title: "Interview scheduled",
          tone: "success",
        });
        updateSearchTour("engagement");
      }
      closeForm();
    } catch {
      return;
    }
  }

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-6"
      aria-labelledby="application-interviews-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet">
            Conversation plan
          </p>
          <h2 id="application-interviews-title" className="mt-1 text-lg font-bold text-ink">
            Interviews
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Schedule conversations and preserve completed or canceled history.
          </p>
        </div>
        {!showForm && canSchedule ? (
          <Button className="shrink-0 gap-2" onClick={startCreate}>
            <CalendarPlus aria-hidden="true" className="size-4" />
            Schedule interview
          </Button>
        ) : null}
      </div>

      {createMutation.error || updateMutation.error || transitionMutation.error ? (
        <div className="mt-4">
          <ErrorPanel
            compact
            title="Interview could not be updated"
            error={
              createMutation.error ??
              updateMutation.error ??
              transitionMutation.error
            }
          />
        </div>
      ) : null}
      {interviewsQuery.isPending ? (
        <div className="mt-5">
          <ResourcePanelSkeleton label="Loading interviews…" />
        </div>
      ) : null}
      {interviewsQuery.isError ? (
        <div className="mt-5">
          <ErrorPanel
            compact
            error={interviewsQuery.error}
            onRetry={() => void interviewsQuery.refetch()}
          />
        </div>
      ) : null}
      {interviewsQuery.isSuccess && interviews.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface-muted px-5 py-8 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-violet-soft text-violet">
            <CalendarClock aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-3 font-semibold text-ink">No interviews recorded</p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
            {emptyMessage}
          </p>
        </div>
      ) : null}
      {interviews.length ? (
        <ol id="application-interview-rounds" className="mt-5 space-y-3">
          {(showAll ? interviews : interviews.slice(0, 5)).map((interview) => (
            <li
              key={interview.interview_id}
              id={`interview-${interview.interview_id}`}
              className={`scroll-mt-28 rounded-2xl border bg-surface-raised p-4 ${focusInterviewId === interview.interview_id ? "border-violet ring-2 ring-violet/20" : "border-line"}`}
            >
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">
                      {formatInterviewType(interview.interview_type)}
                    </p>
                    <InterviewStatus status={interview.status} />
                  </div>
                  <time
                    className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-accent"
                    dateTime={interview.scheduled_at}
                  >
                    <CalendarClock aria-hidden="true" className="size-4" />
                    {formatTimestamp(interview.scheduled_at, timeZone)} ·{" "}
                    {interview.duration_minutes} minutes
                  </time>
                  {interview.location ? (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {interview.location}
                    </p>
                  ) : null}
                  {interview.meeting_url ? (
                    <a
                      href={interview.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 break-all text-sm font-semibold text-accent hover:underline"
                    >
                      <Video aria-hidden="true" className="size-4 shrink-0" />
                      Open meeting link
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {interview.details ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
                      {interview.details}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">
                    <span>{interview.guidance.progress.essentials.completed} of {interview.guidance.progress.essentials.total} essentials prepared</span>
                    {interview.guidance.progress.essentials.complete ? <span className="rounded-full bg-success-soft px-2 py-1 text-success">Essentials prepared</span> : null}
                    {interview.debrief_completed_at ? <span className="rounded-full bg-violet-soft px-2 py-1 text-violet">Reflection saved</span> : null}
                  </div>
                </div>

                {interview.status !== "CANCELED" ? (
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Link
                      to={`/interviews?interview=${interview.interview_id}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-violet-soft px-3 text-sm font-semibold text-violet hover:bg-violet/15"
                    >
                      <Sparkles aria-hidden="true" className="size-3.5" />
                      {interview.status === "COMPLETED" ? "Reflection" : "Prepare"}
                    </Link>
                    {interview.status === "SCHEDULED" ? <>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
                      onClick={() => startEdit(interview)}
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                      Edit
                    </button>
                    {interview.allowed_statuses.includes("COMPLETED") ? (
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-success/30 bg-success-soft px-3 text-sm font-semibold text-success"
                        disabled={transitionMutation.isPending}
                        onClick={async () => {
                          try {
                            await transitionMutation.mutateAsync({
                              interviewId: interview.interview_id,
                              version: interview.version,
                              status: "COMPLETED",
                            });
                            showToast("Interview marked complete.", {
                              title: "Interview updated",
                              tone: "success",
                            });
                          } catch {
                            return;
                          }
                        }}
                      >
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        Complete
                      </button>
                    ) : null}
                    {interview.allowed_statuses.includes("CANCELED") ? (
                      cancelingId === interview.interview_id ? (
                        <div
                          role="group"
                          aria-label="Confirm interview cancellation"
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="self-center text-xs font-semibold text-danger">
                            Cancel this interview?
                          </span>
                          <button
                            id={`confirm-cancel-interview-${interview.interview_id}`}
                            type="button"
                            className="min-h-10 rounded-lg bg-danger px-3 text-sm font-semibold text-white"
                            disabled={transitionMutation.isPending}
                            onClick={async () => {
                              try {
                                await transitionMutation.mutateAsync({
                                  interviewId: interview.interview_id,
                                  version: interview.version,
                                  status: "CANCELED",
                                });
                                setCancelingId(null);
                                showToast("Interview canceled.", {
                                  title: "Interview updated",
                                  tone: "success",
                                });
                              } catch {
                                return;
                              }
                            }}
                          >
                            Confirm cancellation
                          </button>
                          <button
                            type="button"
                            className="min-h-10 rounded-lg px-3 text-sm font-semibold text-ink-muted"
                            onClick={() => setCancelingId(null)}
                          >
                            Keep interview
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="min-h-10 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
                          disabled={transitionMutation.isPending}
                          onClick={() => setCancelingId(interview.interview_id)}
                        >
                          Cancel interview
                        </button>
                      )
                    ) : null}
                    </> : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {interviews.length > 5 ? (
        <Button
          variant="secondary"
          className="mt-4"
          aria-expanded={showAll}
          aria-controls="application-interview-rounds"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show fewer rounds" : `Show ${interviews.length - 5} more rounds`}
        </Button>
      ) : null}
      {interviewsQuery.hasNextPage ? (
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            disabled={interviewsQuery.isFetchingNextPage}
            onClick={() => void interviewsQuery.fetchNextPage()}
          >
            {interviewsQuery.isFetchingNextPage ? "Loading more…" : "Load more interviews"}
          </Button>
        </div>
      ) : null}

      {showForm ? (
        <InterviewScheduleWorkspace
          open
          application={{ application_id: applicationId, company_name: companyName, job_title: jobTitle }}
          editing={editing}
          timeZone={timeZone}
          isSaving={createMutation.isPending || updateMutation.isPending}
          error={createMutation.error ?? updateMutation.error}
          onClose={closeForm}
          onSubmit={submit}
        />
      ) : null}
    </section>
  );
}

function InterviewStatus({ status }: { status: Interview["status"] }) {
  const classes =
    status === "SCHEDULED"
      ? "border-accent/30 bg-accent-soft text-accent"
      : status === "COMPLETED"
        ? "border-success/30 bg-success-soft text-success"
        : "border-line bg-surface-muted text-ink-muted";
  return (
    <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {formatInterviewStatus(status)}
    </span>
  );
}
