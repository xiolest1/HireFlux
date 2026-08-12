import { useState, type FormEvent, type ReactNode } from "react";
import {
  INTERVIEW_TYPES,
  type Interview,
  type InterviewType,
} from "../../api/schemas";
import type { InterviewFields } from "../../api/resources";
import { Button } from "../../components/ui/Button";
import { ErrorPanel, LoadingState, SuccessBanner } from "../../components/ui/Feedback";
import {
  formatInterviewStatus,
  formatInterviewType,
  formatTimestamp,
} from "../applications/format";
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
  const createMutation = useCreateInterview(applicationId);
  const updateMutation = useUpdateInterview(applicationId);
  const transitionMutation = useTransitionInterview(applicationId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [draft, setDraft] = useState<InterviewDraft>(emptyDraft);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

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
    if (!draft.scheduled_at || draft.duration_minutes < 15 || draft.duration_minutes > 480) return;
    setNotice(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ interviewId: editing.interview_id, version: editing.version, fields: fields(draft) });
        setNotice("Interview updated.");
      } else {
        await createMutation.mutateAsync(fields(draft));
        setNotice("Interview scheduled.");
      }
      setShowForm(false);
      setEditing(null);
      setDraft(emptyDraft);
    } catch {
      return;
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="application-interviews-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 id="application-interviews-title" className="text-lg font-bold text-slate-950">Interviews</h2><p className="mt-1 text-sm leading-6 text-slate-600">Schedule conversations and preserve completed or canceled history.</p></div>
        {!showForm ? <Button onClick={startCreate}>Schedule interview</Button> : null}
      </div>

      {showForm ? (
        <form className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4" onSubmit={submit}>
          <h3 className="font-bold text-slate-950">{editing ? "Edit interview" : "New interview"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InterviewSelect label="Interview type" value={draft.interview_type} onChange={(value) => setDraft({ ...draft, interview_type: value as InterviewType })}>{INTERVIEW_TYPES.map((type) => <option key={type} value={type}>{formatInterviewType(type)}</option>)}</InterviewSelect>
            <div><label htmlFor="interview-time" className="text-sm font-semibold text-slate-800">Date and time <span className="text-rose-700">*</span></label><input id="interview-time" type="datetime-local" required value={draft.scheduled_at} onChange={(event) => setDraft({ ...draft, scheduled_at: event.target.value })} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900" /></div>
            <div><label htmlFor="interview-duration" className="text-sm font-semibold text-slate-800">Duration in minutes</label><input id="interview-duration" type="number" min={15} max={480} step={15} value={draft.duration_minutes} onChange={(event) => setDraft({ ...draft, duration_minutes: Number(event.target.value) })} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900" /></div>
            <div><label htmlFor="interview-location" className="text-sm font-semibold text-slate-800">Location <span className="font-normal text-slate-500">(optional)</span></label><input id="interview-location" maxLength={240} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Video call or office address" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900" /></div>
            <div className="sm:col-span-2"><label htmlFor="interview-url" className="text-sm font-semibold text-slate-800">Meeting URL <span className="font-normal text-slate-500">(optional)</span></label><input id="interview-url" type="url" maxLength={2048} value={draft.meeting_url} onChange={(event) => setDraft({ ...draft, meeting_url: event.target.value })} placeholder="https://meet.example.com/interview" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900" /></div>
            <div className="sm:col-span-2"><label htmlFor="interview-details" className="text-sm font-semibold text-slate-800">Preparation details <span className="font-normal text-slate-500">(optional)</span></label><textarea id="interview-details" rows={3} maxLength={5000} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900" /></div>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button><Button type="submit" disabled={!draft.scheduled_at || createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Saving…" : editing ? "Save interview" : "Schedule interview"}</Button></div>
        </form>
      ) : null}

      {notice ? <div className="mt-4"><SuccessBanner>{notice}</SuccessBanner></div> : null}
      {createMutation.error || updateMutation.error || transitionMutation.error ? <div className="mt-4"><ErrorPanel compact title="Interview could not be updated" error={createMutation.error ?? updateMutation.error ?? transitionMutation.error} /></div> : null}
      {interviewsQuery.isPending ? <div className="mt-5"><LoadingState label="Loading interviews…" /></div> : null}
      {interviewsQuery.isError ? <div className="mt-5"><ErrorPanel compact error={interviewsQuery.error} onRetry={() => void interviewsQuery.refetch()} /></div> : null}
      {interviewsQuery.data?.items.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No interviews recorded for this application.</p> : null}
      {interviewsQuery.data?.items.length ? (
        <ol className="mt-5 space-y-3">
          {interviewsQuery.data.items.map((interview) => (
            <li key={interview.interview_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{formatInterviewType(interview.interview_type)}</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${interview.status === "SCHEDULED" ? "bg-blue-50 text-blue-800" : interview.status === "COMPLETED" ? "bg-emerald-100 text-emerald-950" : "bg-slate-100 text-slate-700"}`}>{formatInterviewStatus(interview.status)}</span></div><time className="mt-1 block text-sm font-semibold text-brand-700" dateTime={interview.scheduled_at}>{formatTimestamp(interview.scheduled_at, timeZone)} · {interview.duration_minutes} minutes</time>{interview.location ? <p className="mt-1 text-sm text-slate-600">{interview.location}</p> : null}{interview.meeting_url ? <a href={interview.meeting_url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm font-semibold text-brand-700 hover:underline">Open meeting link<span className="sr-only"> (opens in a new tab)</span></a> : null}{interview.details ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{interview.details}</p> : null}</div>
                {interview.status === "SCHEDULED" ? <div className="flex shrink-0 flex-wrap gap-2"><button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50" onClick={() => startEdit(interview)}>Edit</button>{interview.allowed_statuses.includes("COMPLETED") ? <button type="button" className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white" disabled={transitionMutation.isPending} onClick={async () => { try { await transitionMutation.mutateAsync({ interviewId: interview.interview_id, version: interview.version, status: "COMPLETED" }); setNotice("Interview marked complete."); } catch { return; } }}>Complete</button> : null}{interview.allowed_statuses.includes("CANCELED") ? cancelingId === interview.interview_id ? <div role="group" aria-label="Confirm interview cancellation" className="flex flex-wrap items-center gap-2"><span className="self-center text-xs font-semibold text-rose-700">Cancel this interview?</span><button autoFocus type="button" className="min-h-10 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white" disabled={transitionMutation.isPending} onClick={async () => { try { await transitionMutation.mutateAsync({ interviewId: interview.interview_id, version: interview.version, status: "CANCELED" }); setCancelingId(null); setNotice("Interview canceled."); } catch { return; } }}>Confirm cancellation</button><button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-700" onClick={() => setCancelingId(null)}>Keep interview</button></div> : <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50" disabled={transitionMutation.isPending} onClick={() => setCancelingId(interview.interview_id)}>Cancel interview</button> : null}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function InterviewSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `interview-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">{children}</select></div>;
}
