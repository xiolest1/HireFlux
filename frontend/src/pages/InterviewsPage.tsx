import { Link } from "react-router-dom";
import { buttonClassName } from "../components/ui/buttonStyles";
import { EmptyState, ErrorPanel, LoadingState } from "../components/ui/Feedback";
import {
  formatInterviewType,
  formatTimestamp,
} from "../features/applications/format";
import { useSettings, useUpcomingInterviews } from "../features/resources/queries";

export function InterviewsPage() {
  const interviewsQuery = useUpcomingInterviews();
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Your schedule</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Interviews</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">Prepare for every upcoming conversation from one chronological view.</p>
        </div>
        <Link to="/applications" className={buttonClassName("secondary")}>Choose an application</Link>
      </header>

      <div className="mt-8">
        {interviewsQuery.isPending ? <LoadingState label="Loading upcoming interviews…" /> : null}
        {interviewsQuery.isError ? <ErrorPanel title="Interviews could not be loaded" error={interviewsQuery.error} onRetry={() => void interviewsQuery.refetch()} /> : null}
        {interviewsQuery.data?.items.length === 0 ? <EmptyState title="No upcoming interviews" description="Schedule an interview from an application page when your next conversation is confirmed." action={<Link to="/applications" className={buttonClassName("primary")}>Browse applications</Link>} /> : null}
        {interviewsQuery.data?.items.length ? (
          <ol className="space-y-4">
            {interviewsQuery.data.items.map((interview) => (
              <li key={interview.interview_id}>
                <article className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:p-6">
                  <time dateTime={interview.scheduled_at} className="text-sm font-bold text-brand-700">{formatTimestamp(interview.scheduled_at, timeZone)}</time>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{formatInterviewType(interview.interview_type)}</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{interview.job_title ?? "Application interview"}</h2>
                    <p className="mt-1 truncate text-sm text-slate-600">{interview.company_name ?? "Company details on application"} · {interview.duration_minutes} minutes</p>
                    {interview.location ? <p className="mt-1 truncate text-sm text-slate-500">{interview.location}</p> : null}
                  </div>
                  <Link to={`/applications/${interview.application_id}`} className={buttonClassName("secondary")}>View application</Link>
                </article>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
