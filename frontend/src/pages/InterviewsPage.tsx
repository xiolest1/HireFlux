import { CalendarDays, Clock3, ExternalLink, MapPin, Video } from "lucide-react";
import { Link } from "react-router-dom";
import type { Interview } from "../api/schemas";
import { buttonClassName } from "../components/ui/buttonStyles";
import { EmptyState, ErrorPanel } from "../components/ui/Feedback";
import { PanelSkeleton, Skeleton } from "../components/ui/Skeleton";
import { formatInterviewType, formatTimestamp } from "../features/applications/format";
import { useSettings, useUpcomingInterviews } from "../features/resources/queries";

function calendarKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function offsetDateKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateHeading(key: string, timeZone: string) {
  const today = calendarKey(new Date(), timeZone);
  const prefix = key === today ? "Today" : key === offsetDateKey(today, 1) ? "Tomorrow" : null;
  const full = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: key.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));
  return prefix ? `${prefix} · ${full}` : full;
}

export function InterviewsPage() {
  const interviewsQuery = useUpcomingInterviews();
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const interviews = [...(interviewsQuery.data?.items ?? [])].sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at));
  const grouped = new Map<string, Interview[]>();
  for (const interview of interviews) {
    const key = calendarKey(interview.scheduled_at, timeZone);
    grouped.set(key, [...(grouped.get(key) ?? []), interview]);
  }

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Your schedule</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Interviews</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">Prepare for every upcoming conversation, grouped by your saved workspace calendar.</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock3 aria-hidden="true" className="size-3.5" />Times shown in {timeZone.replaceAll("_", " ")}</p>
        </div>
        <Link to="/applications" className={buttonClassName("secondary")}>Choose an application</Link>
      </header>

      <div className="mt-8">
        {interviewsQuery.isPending ? <InterviewsSkeleton /> : null}
        {interviewsQuery.isError ? <ErrorPanel title="Interviews could not be loaded" error={interviewsQuery.error} onRetry={() => void interviewsQuery.refetch()} /> : null}
        {interviewsQuery.data?.items.length === 0 ? <EmptyState title="No upcoming interviews" description="Schedule an interview from an application page when your next conversation is confirmed." action={<Link to="/applications" className={buttonClassName("primary")}>Browse applications</Link>} /> : null}
        {interviews.length ? (
          <div className="space-y-9">
            {Array.from(grouped.entries()).map(([date, items]) => (
              <section key={date} aria-labelledby={`interview-date-${date}`}>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700"><CalendarDays aria-hidden="true" className="size-5" /></span>
                  <div><h2 id={`interview-date-${date}`} className="text-lg font-bold text-slate-950">{dateHeading(date, timeZone)}</h2><p className="text-xs font-semibold text-slate-500">{items.length} {items.length === 1 ? "conversation" : "conversations"}</p></div>
                </div>
                <ol className="relative mt-4 space-y-4 border-l-2 border-slate-200 pl-5 sm:ml-5 sm:pl-8">
                  {items.map((interview) => <InterviewCard key={interview.interview_id} interview={interview} timeZone={timeZone} />)}
                </ol>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InterviewsSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading upcoming interviews">
      <span className="sr-only">Loading upcoming interviews…</span>
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} aria-hidden="true">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton rounded="lg" className="size-10 shrink-0" />
            <div className="w-full max-w-xs space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-24" /></div>
          </div>
          <PanelSkeleton rows={4} />
        </div>
      ))}
    </div>
  );
}

function InterviewCard({ interview, timeZone }: { interview: Interview; timeZone: string }) {
  return (
    <li className="relative">
      <span aria-hidden="true" className="absolute -left-[1.7rem] top-7 size-3 rounded-full border-2 border-white bg-brand-500 sm:-left-[2.45rem]" />
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">{formatInterviewType(interview.interview_type)}</span>
              <time dateTime={interview.scheduled_at} className="text-sm font-bold text-brand-700">{formatTimestamp(interview.scheduled_at, timeZone)}</time>
            </div>
            <h3 className="mt-3 text-xl font-bold text-slate-950">{interview.job_title ?? "Application interview"}</h3>
            <p className="mt-1 text-sm text-slate-600">{interview.company_name ?? "Company details on application"}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-4" />{interview.duration_minutes} minutes</span>
              {interview.location ? <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4" />{interview.location}</span> : null}
              {interview.meeting_url ? <a href={interview.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"><Video aria-hidden="true" className="size-4" />Open meeting <ExternalLink aria-hidden="true" className="size-3" /></a> : null}
            </div>
          </div>
          <Link to={`/applications/${interview.application_id}`} className={buttonClassName("secondary", "shrink-0")}>View application</Link>
        </div>
      </article>
    </li>
  );
}
