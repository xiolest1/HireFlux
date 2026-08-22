import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Pencil,
  Video,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  INTERVIEW_TYPES,
  type Interview,
  type InterviewType,
} from "../../api/schemas";
import type { InterviewFields } from "../../api/resources";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
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
import { updateRecruiterGuide } from "../workspace/queries";
import {
  useApplicationInterviews,
  useCreateInterview,
  useTransitionInterview,
  useUpdateInterview,
} from "./queries";

interface InterviewDraft {
  interview_type: InterviewType;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  meeting_url: string;
  details: string;
}

const emptyDraft: InterviewDraft = {
  interview_type: "RECRUITER_CALL",
  scheduled_at: "",
  duration_minutes: 60,
  location: "",
  meeting_url: "",
  details: "",
};

const interviewFieldClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-muted";

function toLocalInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fields(draft: InterviewDraft): InterviewFields {
  return {
    interview_type: draft.interview_type,
    scheduled_at: new Date(draft.scheduled_at).toISOString(),
    duration_minutes: draft.duration_minutes,
    location: draft.location.trim() || null,
    meeting_url: draft.meeting_url.trim() || null,
    details: draft.details.trim() || null,
  };
}

export function InterviewsPanel({
  applicationId,
  timeZone,
}: {
  applicationId: string;
  timeZone: string;
}) {
  const interviewsQuery = useApplicationInterviews(applicationId);
  const interviews = interviewsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const createMutation = useCreateInterview(applicationId);
  const updateMutation = useUpdateInterview(applicationId);
  const transitionMutation = useTransitionInterview(applicationId);
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [draft, setDraft] = useState<InterviewDraft>(emptyDraft);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

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
    setDraft(emptyDraft);
    createMutation.reset();
    updateMutation.reset();
  }

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setShowForm(true);
  }

  function startEdit(interview: Interview) {
    setEditing(interview);
    setDraft({
      interview_type: interview.interview_type,
      scheduled_at: toLocalInput(interview.scheduled_at),
      duration_minutes: interview.duration_minutes,
      location: interview.location ?? "",
      meeting_url: interview.meeting_url ?? "",
      details: interview.details ?? "",
    });
    setShowForm(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !draft.scheduled_at ||
      draft.duration_minutes < 15 ||
      draft.duration_minutes > 480
    ) {
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          interviewId: editing.interview_id,
          version: editing.version,
          fields: fields(draft),
        });
        showToast("Interview updated.", {
          title: "Interview updated",
          tone: "success",
        });
      } else {
        await createMutation.mutateAsync(fields(draft));
        showToast("Interview scheduled.", {
          title: "Interview scheduled",
          tone: "success",
        });
        updateRecruiterGuide("engagement");
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
        {!showForm ? (
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
            When a conversation is booked, keep the time and preparation details together here.
          </p>
        </div>
      ) : null}
      {interviews.length ? (
        <ol className="mt-5 space-y-3">
          {interviews.map((interview) => (
            <li
              key={interview.interview_id}
              className="rounded-2xl border border-line bg-surface-raised p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                </div>

                {interview.status === "SCHEDULED" ? (
                  <div className="flex shrink-0 flex-wrap gap-1">
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
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-success px-3 text-sm font-semibold text-white"
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
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
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
        <InterviewEditor
          editing={editing}
          draft={draft}
          isSaving={createMutation.isPending || updateMutation.isPending}
          onDraftChange={setDraft}
          onClose={closeForm}
          onSubmit={submit}
        />
      ) : null}
    </section>
  );
}

function InterviewEditor({
  editing,
  draft,
  isSaving,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  editing: Interview | null;
  draft: InterviewDraft;
  isSaving: boolean;
  onDraftChange: (draft: InterviewDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Drawer
      open
      onClose={onClose}
      title={editing ? "Edit interview" : "Schedule interview"}
      description="Keep timing, location, and preparation details together."
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            form="interview-editor-form"
            type="submit"
            disabled={!draft.scheduled_at || isSaving}
          >
            {isSaving
              ? "Saving…"
              : editing
                ? "Save interview"
                : "Schedule interview"}
          </Button>
        </div>
      }
    >
        <form id="interview-editor-form" onSubmit={onSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <InterviewSelect
              label="Interview type"
              value={draft.interview_type}
              onChange={(value) =>
                onDraftChange({ ...draft, interview_type: value as InterviewType })
              }
            >
              {INTERVIEW_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatInterviewType(type)}
                </option>
              ))}
            </InterviewSelect>
            <div>
              <label htmlFor="interview-time" className="text-sm font-semibold text-ink">
                Date and time <span className="text-danger">*</span>
              </label>
              <input
                id="interview-time"
                type="datetime-local"
                required
                value={draft.scheduled_at}
                onChange={(event) =>
                  onDraftChange({ ...draft, scheduled_at: event.target.value })
                }
                className={interviewFieldClassName}
              />
            </div>
            <div>
              <label htmlFor="interview-duration" className="text-sm font-semibold text-ink">
                Duration in minutes
              </label>
              <input
                id="interview-duration"
                type="number"
                min={15}
                max={480}
                step={15}
                value={draft.duration_minutes}
                onChange={(event) =>
                  onDraftChange({ ...draft, duration_minutes: Number(event.target.value) })
                }
                className={interviewFieldClassName}
              />
            </div>
            <div>
              <label htmlFor="interview-location" className="text-sm font-semibold text-ink">
                Location <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="interview-location"
                maxLength={240}
                value={draft.location}
                onChange={(event) => onDraftChange({ ...draft, location: event.target.value })}
                placeholder="Video call or office address"
                className={interviewFieldClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="interview-url" className="text-sm font-semibold text-ink">
                Meeting URL <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="interview-url"
                type="url"
                maxLength={2048}
                value={draft.meeting_url}
                onChange={(event) =>
                  onDraftChange({ ...draft, meeting_url: event.target.value })
                }
                placeholder="https://meet.example.com/interview"
                className={interviewFieldClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="interview-details" className="text-sm font-semibold text-ink">
                Preparation details{" "}
                <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <textarea
                id="interview-details"
                rows={5}
                maxLength={5000}
                value={draft.details}
                onChange={(event) => onDraftChange({ ...draft, details: event.target.value })}
                className={`${interviewFieldClassName} resize-y py-2 text-sm leading-6`}
              />
            </div>
          </div>
        </form>
    </Drawer>
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

function InterviewSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = `interview-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${interviewFieldClassName} text-sm font-semibold`}
      >
        {children}
      </select>
    </div>
  );
}
