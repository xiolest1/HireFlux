import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  INTERVIEW_TYPES,
  type Application,
  type Interview,
  type InterviewType,
} from "../../api/schemas";
import type { InterviewFields } from "../../api/resources";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/Feedback";
import { FocusedWorkspace } from "../../components/ui/FocusedWorkspace";
import { formatInterviewType } from "../applications/format";
import { useApplications } from "../applications/queries";
import {
  instantToWorkspaceInput,
  InvalidWorkspaceWallTimeError,
  workspaceInputToInstant,
} from "./interviewTimeZone";

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

const fieldClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

function draftFor(interview: Interview | null, timeZone: string): InterviewDraft {
  if (!interview) return emptyDraft;
  return {
    interview_type: interview.interview_type,
    scheduled_at: instantToWorkspaceInput(interview.scheduled_at, timeZone),
    duration_minutes: interview.duration_minutes,
    location: interview.location ?? "",
    meeting_url: interview.meeting_url ?? "",
    details: interview.details ?? "",
  };
}

function fields(draft: InterviewDraft, timeZone: string): InterviewFields {
  return {
    interview_type: draft.interview_type,
    scheduled_at: workspaceInputToInstant(draft.scheduled_at, timeZone),
    duration_minutes: draft.duration_minutes,
    location: draft.location.trim() || null,
    meeting_url: draft.meeting_url.trim() || null,
    details: draft.details.trim() || null,
  };
}

export function InterviewScheduleWorkspace({
  open,
  application,
  editing = null,
  timeZone,
  isSaving,
  error,
  onApplicationChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  application: Pick<Application, "application_id" | "company_name" | "job_title"> | null;
  editing?: Interview | null;
  timeZone: string;
  isSaving: boolean;
  error?: unknown;
  onApplicationChange?: (
    application: Pick<Application, "application_id" | "company_name" | "job_title"> | null,
  ) => void;
  onClose: () => void;
  onSubmit: (applicationId: string, fields: InterviewFields) => Promise<void>;
}) {
  const initialDraft = useMemo(() => draftFor(editing, timeZone), [editing, timeZone]);
  const [draft, setDraft] = useState(initialDraft);
  const [timeError, setTimeError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
      setTimeError(null);
    }
  }, [initialDraft, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!application || !draft.scheduled_at || draft.duration_minutes < 15 || draft.duration_minutes > 480) return;
    try {
      setTimeError(null);
      await onSubmit(application.application_id, fields(draft, timeZone));
    } catch (caught) {
      if (caught instanceof InvalidWorkspaceWallTimeError) {
        setTimeError(caught.message);
      }
    }
  }

  return (
    <FocusedWorkspace
      open={open}
      onClose={onClose}
      dirty={dirty}
      title={editing ? "Edit interview" : "Schedule interview"}
      description="Use the same interview record for timing, access details, preparation, and later reflection."
      context={application ? <span className="inline-flex flex-wrap items-center gap-2">{application.company_name} · {application.job_title}{onApplicationChange && !editing ? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onApplicationChange(null)}>Change opportunity</button> : null}</span> : "Choose an active opportunity"}
      footer={(requestClose) =>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={requestClose}>Cancel</Button>
          <Button form="interview-schedule-form" type="submit" disabled={!application || !draft.scheduled_at || isSaving}>
            {isSaving ? "Saving…" : editing ? "Save interview" : "Schedule interview"}
          </Button>
        </div>
      }
    >
      <form id="interview-schedule-form" onSubmit={(event) => void submit(event)} className="space-y-6">
        {!application ? (
          <ApplicationChooser onSelect={(item) => onApplicationChange?.(item)} />
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="schedule-interview-type" className="text-sm font-semibold text-ink">Interview type</label>
            <select id="schedule-interview-type" value={draft.interview_type} onChange={(event) => setDraft({ ...draft, interview_type: event.target.value as InterviewType })} className={`${fieldClassName} text-sm font-semibold`}>
              {INTERVIEW_TYPES.map((type) => <option key={type} value={type}>{formatInterviewType(type)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="schedule-interview-time" className="text-sm font-semibold text-ink">Date and time <span className="text-danger">*</span></label>
            <input id="schedule-interview-time" type="datetime-local" required value={draft.scheduled_at} onChange={(event) => { setTimeError(null); setDraft({ ...draft, scheduled_at: event.target.value }); }} aria-invalid={Boolean(timeError)} aria-describedby={timeError ? "schedule-interview-time-error" : "schedule-interview-time-zone"} className={fieldClassName} />
            <p id="schedule-interview-time-zone" className="mt-1 text-xs text-ink-muted">Interpreted in {timeZone.replaceAll("_", " ")}.</p>
            {timeError ? <p id="schedule-interview-time-error" role="alert" className="mt-1 text-sm text-danger">{timeError}</p> : null}
          </div>
          <div>
            <label htmlFor="schedule-interview-duration" className="text-sm font-semibold text-ink">Duration in minutes</label>
            <input id="schedule-interview-duration" type="number" min={15} max={480} step={15} value={draft.duration_minutes} onChange={(event) => setDraft({ ...draft, duration_minutes: Number(event.target.value) })} className={fieldClassName} />
          </div>
          <div>
            <label htmlFor="schedule-interview-location" className="text-sm font-semibold text-ink">Location <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="schedule-interview-location" maxLength={240} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Video call or office address" className={fieldClassName} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="schedule-interview-url" className="text-sm font-semibold text-ink">Meeting URL <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="schedule-interview-url" type="url" maxLength={2048} value={draft.meeting_url} onChange={(event) => setDraft({ ...draft, meeting_url: event.target.value })} placeholder="https://meet.example.com/interview" className={fieldClassName} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="schedule-interview-details" className="text-sm font-semibold text-ink">Preparation details <span className="font-normal text-ink-muted">(optional)</span></label>
            <textarea id="schedule-interview-details" rows={5} maxLength={5000} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} className={`${fieldClassName} resize-y py-2 text-sm leading-6`} />
          </div>
        </div>
        {error ? <ErrorPanel compact title="Interview could not be saved" error={error} /> : null}
      </form>
    </FocusedWorkspace>
  );
}

function ApplicationChooser({
  onSelect,
}: {
  onSelect: (
    application: Pick<Application, "application_id" | "company_name" | "job_title">,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const applicationsQuery = useApplications(null, 25, {
    view: "ACTIVE",
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
  });
  const applications = applicationsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section aria-labelledby="schedule-application-title" className="rounded-2xl border border-line bg-surface-muted p-4">
      <h3 id="schedule-application-title" className="font-semibold text-ink">Choose the opportunity</h3>
      <label htmlFor="schedule-application-search" className="mt-4 block text-sm font-semibold text-ink">Search active applications</label>
      <input id="schedule-application-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company or role" className={fieldClassName} />
      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {applications.map((item) => (
          <li key={item.application_id}>
            <button type="button" className="flex min-h-12 w-full flex-col justify-center rounded-xl border border-line bg-surface px-3 text-left hover:border-accent hover:bg-accent-soft" onClick={() => onSelect(item)}>
              <span className="text-sm font-semibold text-ink">{item.company_name}</span>
              <span className="text-xs text-ink-muted">{item.job_title}</span>
            </button>
          </li>
        ))}
        {applicationsQuery.isPending ? <li className="py-3 text-sm text-ink-muted">Searching active applications…</li> : null}
        {applicationsQuery.isSuccess && !applications.length ? <li className="py-3 text-sm text-ink-muted">No matching active applications.</li> : null}
        {applicationsQuery.hasNextPage ? <li><Button type="button" variant="secondary" className="w-full" disabled={applicationsQuery.isFetchingNextPage} onClick={() => void applicationsQuery.fetchNextPage()}>{applicationsQuery.isFetchingNextPage ? "Loading more…" : "Load more applications"}</Button></li> : null}
      </ul>
      {applicationsQuery.isError ? <div className="mt-3"><ErrorPanel compact title="Applications could not be searched" error={applicationsQuery.error} onRetry={() => void applicationsQuery.refetch()} /></div> : null}
    </section>
  );
}
