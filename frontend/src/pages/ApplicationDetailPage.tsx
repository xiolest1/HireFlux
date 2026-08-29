import { CalendarClock, ChevronDown, ChevronLeft, Ellipsis, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import type { Application, ApplicationStatus, Interview } from "../api/schemas";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Drawer } from "../components/ui/Drawer";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { Menu } from "../components/ui/Menu";
import { StatusBadge } from "../components/ui/StatusBadge";
import { buttonClassName } from "../components/ui/buttonStyles";
import { ActivityTimeline } from "../features/applications/ActivityTimeline";
import { ApplicationDetails } from "../features/applications/ApplicationDetails";
import { ApplicationDetailSkeleton } from "../features/applications/ApplicationSkeletons";
import { NextStepPlanner } from "../features/applications/NextStepPlanner";
import { StatusTransitionForm } from "../features/applications/StatusTransitionForm";
import { formatDateOnly, formatStatus, formatTimestamp } from "../features/applications/format";
import { currentDateInTimeZone } from "../features/applications/formSchema";
import {
  applicationsRouteStateWithoutIntent,
  readApplicationsRouteState,
} from "../features/applications/opportunityNavigation";
import {
  useApplication,
  useApplicationActivity,
  useTransitionApplication,
} from "../features/applications/queries";
import { selectApplicationWorkspace, type WorkspaceAction } from "../features/applications/workspaceModel";
import { ApplicationNotesSection } from "../features/resources/ApplicationNotesSection";
import { InterviewsPanel } from "../features/resources/InterviewsPanel";
import { useApplicationInterviews, useSettings } from "../features/resources/queries";

interface LocationState { notice?: string }
const sections = [["journey", "Journey"], ["interviews", "Interviews"], ["notes", "Notes"], ["details", "Details"], ["history", "Full activity"]] as const;
type SectionId = (typeof sections)[number][0];
const validSections = new Set(sections.map(([id]) => id));
const legacyTabs: Record<string, SectionId> = { notes: "notes", interviews: "interviews", activity: "history", overview: "journey" };

export function ApplicationDetailPage() {
  const { applicationId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice] = useState(() => (location.state as LocationState | null)?.notice ?? null);
  const [applicationsOrigin] = useState(() =>
    readApplicationsRouteState(location.state),
  );
  const pendingIntent = applicationsOrigin?.intent;
  const automaticIntentHandled = useRef(false);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const [transitionTarget, setTransitionTarget] = useState<ApplicationStatus | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [noteRequest, setNoteRequest] = useState(0);
  const [jumpOpen, setJumpOpen] = useState(false);
  const applicationQuery = useApplication(applicationId);
  const interviewsQuery = useApplicationInterviews(applicationId);
  const recentActivity = useApplicationActivity(applicationId, { order: "desc", limit: 8 });
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";
  const interviews = useMemo(() => interviewsQuery.data?.pages.flatMap((page) => page.items) ?? [], [interviewsQuery.data]);
  const workspaceModel = useMemo(
    () =>
      applicationQuery.data
        ? selectApplicationWorkspace({
            application: applicationQuery.data,
            interviews,
            today: currentDateInTimeZone(timeZone),
          })
        : null,
    [applicationQuery.data, interviews, timeZone],
  );
  const backToApplications = applicationsOrigin?.returnTo ?? "/applications";

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab || !legacyTabs[tab]) return;
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    next.set("section", legacyTabs[tab]);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    const currentOrigin = readApplicationsRouteState(location.state);
    if (!currentOrigin?.intent && !notice) return;
    void navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: currentOrigin
        ? applicationsRouteStateWithoutIntent(currentOrigin)
        : null,
    });
  }, [location.pathname, location.search, location.state, navigate, notice]);
  useEffect(() => {
    if (applicationQuery.isPending) return;
    const section = searchParams.get("section");
    if (!section || !validSections.has(section as SectionId)) return;
    const timer = window.setTimeout(() => {
      const heading = document.getElementById(`${section}-heading`);
      heading?.scrollIntoView?.({ block: "start" });
      heading?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applicationQuery.isPending, searchParams]);

  const openSection = useCallback((section: SectionId) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", section);
    setSearchParams(next);
    setJumpOpen(false);
  }, [searchParams, setSearchParams]);
  const runAction = useCallback((action: WorkspaceAction | null) => {
    if (!action) return;
    if (action.kind === "transition") {
      if (action.transition === "ARCHIVED") setArchiveOpen(true);
      else { setTransitionTarget(action.transition ?? null); setTransitionOpen(true); }
    } else if (action.kind === "follow-up") setFollowUpOpen(true);
    else if (action.kind === "prepare" && action.interviewId) {
      void navigate(`/interviews?interview=${action.interviewId}`, {
        state: applicationsOrigin
          ? {
              applicationsOrigin: {
                returnTo: applicationsOrigin.returnTo,
                intent: "OPEN_INTERVIEW_PREPARATION",
              },
            }
          : null,
      });
    }
    else if (action.kind === "interview") openSection("interviews");
    else if (action.kind === "note") { openSection("notes"); setNoteRequest((value) => value + 1); }
  }, [applicationsOrigin, navigate, openSection]);

  useEffect(() => {
    if (
      pendingIntent !== "RUN_PRIMARY_ACTION" ||
      automaticIntentHandled.current ||
      !workspaceModel?.primary ||
      interviewsQuery.isPending
    ) {
      return;
    }
    automaticIntentHandled.current = true;
    const timer = window.setTimeout(() => {
      primaryActionRef.current?.focus();
      runAction(workspaceModel.primary);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [interviewsQuery.isPending, pendingIntent, runAction, workspaceModel]);

  if (applicationQuery.isPending) return <ApplicationDetailSkeleton />;
  if (applicationQuery.isError || !workspaceModel) {
    const missing = applicationQuery.error instanceof ApiError && applicationQuery.error.status === 404;
    return <div className="mx-auto max-w-3xl space-y-5"><ErrorPanel error={applicationQuery.error} title={missing ? "Application not found" : "Application could not be loaded"} onRetry={missing ? undefined : () => void applicationQuery.refetch()} /><Link to={backToApplications} className={buttonClassName("secondary")}>Back to applications</Link></div>;
  }

  const application = applicationQuery.data;
  const model = workspaceModel;
  const latest = recentActivity.data?.pages[0]?.items[0];
  const nextInterview = [...interviews].filter((item) => item.status === "SCHEDULED" && new Date(item.scheduled_at).getTime() >= Date.now()).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const focusInterviewId = searchParams.get("interview");

  return <div className="mx-auto max-w-6xl pb-8">
    <Link to={backToApplications} className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent hover:underline"><ChevronLeft aria-hidden="true" className="size-4" /> Back to applications</Link>
    {notice ? <div className="mt-3"><SuccessBanner>{notice}</SuccessBanner></div> : null}
    <header className="mt-4 border-b border-line pb-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><StatusBadge status={application.status} /><span className="text-sm text-ink-muted">Updated {formatTimestamp(application.updated_at, timeZone)}</span></div>
          <p className="mt-3 break-words text-sm font-bold text-accent">{application.company_name}</p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-ink sm:text-4xl">{application.job_title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted"><span><strong className="text-ink">Latest:</strong> {latest?.summary ?? "Opportunity created"}</span>{nextInterview ? <span><strong className="text-ink">Next interview:</strong> {formatTimestamp(nextInterview.scheduled_at, timeZone)}</span> : application.follow_up_date ? <span><strong className="text-ink">Check back:</strong> {formatDateOnly(application.follow_up_date)}</span> : null}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Menu label="More opportunity actions" trigger={<span className={buttonClassName("secondary", "gap-2")}><Ellipsis aria-hidden="true" className="size-4" /> More</span>} items={[
            { label: "Edit opportunity", href: `/applications/${application.application_id}/edit`, icon: <Pencil aria-hidden="true" className="size-4" /> },
            ...(["APPLIED", "SCREENING", "INTERVIEW", "OFFER"].includes(application.status) ? [{ label: "Manage next step", onSelect: () => setFollowUpOpen(true), icon: <CalendarClock aria-hidden="true" className="size-4" /> }] : []),
            ...model.moreTransitions.map((status) => ({ label: status === "ARCHIVED" ? "Archive opportunity" : status === "OFFER" && application.status === "REJECTED" ? "Correct to Offer" : `Move to ${formatStatus(status)}`, danger: status === "ARCHIVED", onSelect: () => status === "ARCHIVED" ? setArchiveOpen(true) : (setTransitionTarget(status), setTransitionOpen(true)) })),
          ]} />
        </div>
      </div>
    </header>
    <nav aria-label="Opportunity sections" className="sticky top-16 z-20 mt-4 hidden rounded-2xl border border-line-subtle bg-surface/95 p-2 backdrop-blur md:block"><div className="flex flex-wrap gap-1">{sections.map(([id, label]) => <button key={id} type="button" onClick={() => openSection(id)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-surface-hover hover:text-ink active:bg-surface-pressed">{label}</button>)}</div></nav>
    <section className="mt-8 rounded-3xl border border-accent/25 bg-gradient-to-br from-accent-soft to-surface p-5 sm:p-6" aria-labelledby="next-action-heading"><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">What’s next</p><h2 id="next-action-heading" className="mt-1 text-xl font-bold text-ink">{model.eyebrow}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{model.guidance}</p>{model.primary || model.secondary ? <div className="mt-5 flex flex-wrap gap-2">{model.primary ? <Button ref={primaryActionRef} onClick={() => runAction(model.primary)}>{model.primary.label}</Button> : null}{model.secondary ? <Button variant="secondary" onClick={() => runAction(model.secondary)}>{model.secondary.label}</Button> : null}</div> : null}</section>
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]"><JourneySection application={application} interviews={interviews} timeZone={timeZone} /><ApplicationDetails application={application} /></div>
    <div className="mt-8 border-t border-line-subtle pt-5 md:hidden"><Button variant="ghost" className="w-full justify-between" aria-expanded={jumpOpen} aria-controls="mobile-section-links" onClick={() => setJumpOpen((value) => !value)}>Jump to supporting sections <ChevronDown aria-hidden="true" className={`size-4 ${jumpOpen ? "rotate-180" : ""}`} /></Button>{jumpOpen ? <nav id="mobile-section-links" aria-label="Opportunity sections" className="mt-2 grid rounded-2xl border border-line-subtle bg-surface p-2">{sections.map(([id, label]) => <button key={id} type="button" onClick={() => openSection(id)} className="min-h-11 rounded-xl px-3 text-left text-sm font-semibold text-ink-muted hover:bg-surface-hover active:bg-surface-pressed">{label}</button>)}</nav> : null}</div>
    <section id="interviews" aria-labelledby="interviews-heading" className="mt-10 scroll-mt-24 border-t border-line pt-8"><h2 id="interviews-heading" tabIndex={-1} className="sr-only">Interview process</h2><InterviewsPanel applicationId={application.application_id} companyName={application.company_name} jobTitle={application.job_title} timeZone={timeZone} focusInterviewId={focusInterviewId} emptyMessage={model.interviewEmptyMessage} canSchedule={["APPLIED", "SCREENING", "INTERVIEW", "OFFER"].includes(application.status)} /></section>
    <ApplicationNotesSection applicationId={application.application_id} timeZone={timeZone} composerRequest={noteRequest} />
    <section id="history" aria-labelledby="history-heading" className="mt-10 scroll-mt-24 border-t border-line pt-8"><h2 id="history-heading" tabIndex={-1} className="text-xl font-bold text-ink">Full activity</h2><p className="mb-5 mt-1 text-sm text-ink-muted">Newest events first, with older history available on demand.</p><ActivityTimeline applicationId={application.application_id} timeZone={timeZone} /></section>
    <Drawer open={transitionOpen} onClose={() => setTransitionOpen(false)} title={transitionTarget ? `Move to ${formatStatus(transitionTarget)}` : "Update decision"} description="Only server-approved transitions are available."><StatusTransitionForm application={application} onReload={() => void applicationQuery.refetch()} timeZone={timeZone} initialStatus={transitionTarget} onSuccess={() => setTransitionOpen(false)} embedded /></Drawer>
    <FollowUpDrawer application={application} open={followUpOpen} onClose={() => setFollowUpOpen(false)} timeZone={timeZone} onReload={() => void applicationQuery.refetch()} />
    <ArchiveDialog application={application} open={archiveOpen} onClose={() => setArchiveOpen(false)} onReload={() => void applicationQuery.refetch()} />
  </div>;
}

function JourneySection({ application, interviews, timeZone }: { application: Application; interviews: Interview[]; timeZone: string }) {
  const events = [
    { label: "Opportunity added", date: application.created_at },
    application.submitted_at ? { label: "Applied", date: application.submitted_at } : null,
    application.first_response_at ? { label: "First response", date: application.first_response_at } : null,
    application.first_screening_at ? { label: "Screening", date: application.first_screening_at } : null,
    application.first_interview_at ? { label: "Interview stage", date: application.first_interview_at } : null,
    ...interviews.filter((item) => item.status !== "CANCELED").map((item) => ({ label: `${item.interview_type.toLowerCase().replaceAll("_", " ")} interview`, date: item.scheduled_at })),
    application.first_offer_at ? { label: "Offer", date: application.first_offer_at } : null,
    application.first_acceptance_at ? { label: "Accepted", date: application.first_acceptance_at } : null,
  ].filter((event): event is { label: string; date: string } => event !== null).sort((a, b) => a.date.localeCompare(b.date));
  return <section id="journey" aria-labelledby="journey-heading" className="scroll-mt-24"><p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Opportunity progress</p><h2 id="journey-heading" tabIndex={-1} className="mt-1 text-xl font-bold text-ink">Journey</h2><ol className="mt-5 border-l border-line pl-6">{events.map((event, index) => <li key={`${event.label}-${event.date}-${index}`} className="relative pb-5 last:pb-0"><span aria-hidden="true" className="absolute -left-[1.8rem] top-1 size-3 rounded-full bg-accent ring-4 ring-surface" /><p className="font-semibold capitalize text-ink">{event.label}</p><time dateTime={event.date} className="mt-1 block text-sm text-ink-muted">{formatTimestamp(event.date, timeZone)}</time></li>)}</ol></section>;
}

function FollowUpDrawer({ application, open, onClose, timeZone, onReload }: { application: Application; open: boolean; onClose: () => void; timeZone: string; onReload: () => void }) {
  return <Drawer open={open} onClose={onClose} title="Manage next step" description="Responsibility and check-back timing are recorded separately."><NextStepPlanner application={application} timeZone={timeZone} onSaved={() => { onReload(); onClose(); }} onLeaveUnclear={onClose} onConflict={onReload} /></Drawer>;
}

function ArchiveDialog({ application, open, onClose, onReload }: { application: Application; open: boolean; onClose: () => void; onReload: () => void }) {
  const mutation = useTransitionApplication();
  return <Dialog open={open} onClose={onClose} role="alertdialog" title="Archive this opportunity?" description="It will leave active views but remain available in your history with its activity intact.">{mutation.error ? <div className="mt-4"><ErrorPanel compact error={mutation.error} title={mutation.error instanceof ApiError && mutation.error.status === 409 ? "Opportunity changed" : "Opportunity could not be archived"} onRetry={mutation.error instanceof ApiError && mutation.error.status === 409 ? onReload : undefined} /></div> : null}<div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={mutation.isPending} onClick={async () => { try { await mutation.mutateAsync({ applicationId: application.application_id, request: { status: "ARCHIVED", expected_version: application.version } }); onClose(); } catch { return; } }}>{mutation.isPending ? "Archiving…" : "Archive opportunity"}</Button></div></Dialog>;
}
