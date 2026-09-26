import { ArrowRight, CalendarDays, ChevronDown, Clock, Search } from "lucide-react";
import { useState, type Ref, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { ErrorPanel } from "../../components/ui/Feedback";
import { CollapsibleRegion, PendingIndicator } from "../../components/ui/Motion";
import { Skeleton } from "../../components/ui/Skeleton";
import { applicationCreateRouteState } from "../applications/createNavigation";
import { formatDateOnly, formatTimestamp } from "../applications/format";
import { homeActionMeaning, homeActionPreviewReason, type HomeAction, type HomeActionGroup, type HomeDecisionModel } from "./homeDecisionModel";

const textLink = "inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const labels = { overdue: "Overdue follow-up", today: "Due today", interviews: "Scheduled interview", undated: "No saved date", review: "Suggested review · Time in stage" };

interface ActionControls {
  resolvingActionId: string | null;
  rescheduling: string | null;
  followUpDate: string;
  reschedulePending: boolean;
  onComplete: (action: HomeAction) => void;
  onBeginReschedule: (applicationId: string) => void;
  onDateChange: (value: string) => void;
  onCancelReschedule: () => void;
  onSaveDate: (applicationId: string) => void;
}

function actionTime(action: HomeAction, timeZone: string) {
  if (action.kind === "FOLLOW_UP_OVERDUE" || action.kind === "FOLLOW_UP_TODAY") return { dateTime: action.due_date, label: formatDateOnly(action.due_date) };
  if (action.kind === "INTERVIEW_SOON" || action.kind === "INTERVIEW_UPCOMING") return { dateTime: action.due_at, label: formatTimestamp(action.due_at, timeZone) };
  return null;
}

function actionDestination(action: HomeAction) {
  return `/applications/${action.application_id}${action.kind.startsWith("INTERVIEW_") ? "?section=interviews" : ""}`;
}

function actionKey(action: HomeAction) {
  return `${action.kind}-${action.application_id}-${"due_at" in action ? action.due_at : "due_date" in action ? action.due_date : "undated"}`;
}

function DateBlock({ action, timeZone, focal }: { action: HomeAction; timeZone: string; focal: boolean }) {
  // Calendar dates keep their saved day; only interview instants use the workspace zone.
  const parts = "due_at" in action ? new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone }).formatToParts(new Date(action.due_at)) : [];
  const month = "due_date" in action ? formatDateOnly(action.due_date).split(" ")[0] : parts.find((part) => part.type === "month")?.value;
  const day = "due_date" in action ? action.due_date.slice(-2) : parts.find((part) => part.type === "day")?.value;
  const tone = action.kind === "FOLLOW_UP_OVERDUE" ? "bg-danger-soft text-danger" : action.kind === "FOLLOW_UP_TODAY" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent";
  return <div aria-hidden="true" className={`flex shrink-0 flex-col items-center justify-center self-start rounded-xl px-3 py-2 ${tone}`}>
    <span className="text-xs font-semibold uppercase tracking-wide">{month}</span>
    <span className={`font-display text-2xl font-bold leading-tight ${focal ? "lg:text-4xl" : "lg:text-3xl"}`}>{day}</span>
  </div>;
}

export function HomeDecisionSection({ decision, headingRef, timeZone, refreshing, mutationError, onRetry, ...controls }: ActionControls & {
  decision: HomeDecisionModel;
  headingRef: Ref<HTMLHeadingElement>;
  timeZone: string;
  refreshing: boolean;
  mutationError: unknown;
  onRetry: () => void;
}) {
  const location = useLocation();
  const commitments = decision.groups.filter((group) => group.recorded).flatMap((group) => group.preview.map((action, index) => ({ group, action, index })));
  const otherWork = decision.groups.filter((group) => !group.recorded);
  const gridColumns = commitments.length === 1 ? "" : commitments.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3";
  return <section aria-labelledby="home-decision-title" data-home-decision={decision.state} className="min-w-0">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <h2 id="home-decision-title" ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold tracking-tight text-ink focus:outline-none sm:text-2xl">What can I work on now?</h2>
      <span className="text-xs font-medium text-ink-muted">Limited Home result</span>
    </div>
    {decision.groups.some((group) => group.recorded) ? <ul aria-label="Recorded conditions" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-ink-muted">{decision.groups.filter((group) => group.recorded).map((group) => <li key={group.key} className={group.key === "overdue" ? "text-danger" : group.key === "today" ? "text-warning" : ""}>{group.actions.length} {group.key === "overdue" ? "overdue" : group.key === "today" ? "due today" : group.actions.length === 1 ? "interview" : "interviews"}</li>)}</ul> : null}
    {decision.state !== "actions" ? <div className="mt-4 max-w-3xl"><p className="font-semibold text-ink">{decision.title}</p><p className="mt-1 text-sm leading-6 text-ink-muted">{decision.explanation}</p></div> : commitments.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No recorded deadline is due; optional work is available.</p> : null}
    {refreshing ? <p role="status" className="mt-3 text-sm text-ink-muted">Refreshing recorded work… The previous snapshot remains visible.</p> : null}
    {decision.state === "partial" || decision.state === "failure" ? <div role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-ink"><span>Evidence is incomplete; this is not an all-clear.</span><button type="button" className={buttonClassName("secondary", "min-h-11")} onClick={onRetry}>Retry missing information</button></div> : null}
    {decision.state === "loading" ? <div role="status" aria-label="Checking recorded work" className="mt-4 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-4/5" /></div> : null}
    {decision.state === "no-records" ? <Link to="/applications/new" state={applicationCreateRouteState("dashboard", location.pathname, location.search)} className={buttonClassName("primary", "mt-4")}>Record an application</Link> : null}
    {decision.state === "waiting" ? <div className="mt-4 border-l-2 border-line pl-4"><p className="text-sm font-semibold text-ink">{decision.waitingCount} recorded {decision.waitingCount === 1 ? "opportunity is" : "opportunities are"} waiting</p><p className="mt-1 text-sm text-ink-muted">Employer-owned next steps do not imply a response date.</p><ul className="mt-2">{decision.waitingPreview.filter((item) => item.classification.reason_code === "WAITING_FOR_EMPLOYER").slice(0, 2).map((item) => <li key={item.application.application_id}><Link to={`/applications/${item.application.application_id}`} className={textLink}>{item.application.job_title} · {item.application.company_name}</Link></li>)}</ul><Link to="/applications" className={textLink}>Review waiting opportunities in Applications<ArrowRight aria-hidden="true" className="size-4" /></Link></div> : null}
    <div className={`mt-4 ${decision.focalGroup && otherWork.length ? "grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6" : ""}`}>
      {commitments.length ? <div data-home-commitments className={`grid min-w-0 items-start gap-3 ${gridColumns}`}>
        {commitments.map(({ group, action, index }) => <Commitment key={actionKey(action)} group={group} action={action} index={index} focal={decision.focalGroup === group.key} timeZone={timeZone} controls={controls} />)}
      </div> : null}
      {otherWork.length ? <div data-home-other-work className={`min-w-0 divide-y divide-line-subtle ${commitments.length && !decision.focalGroup ? "mt-5" : ""}`}>
        {otherWork.map((group) => <OtherWork key={group.key} group={group} timeZone={timeZone} controls={controls} />)}
      </div> : null}
    </div>
    {mutationError ? <div className="mt-4"><ErrorPanel compact headingLevel={3} title="Follow-up could not be updated" error={mutationError} /></div> : null}
    <details className="mt-2 text-sm text-ink-muted"><summary className={`${textLink} cursor-pointer text-ink-muted`}>About these results<ChevronDown aria-hidden="true" className="size-4" /></summary><div className="max-w-3xl space-y-2 pb-3 leading-6"><p>{decision.coverage}</p><p>Dates show recorded timing, not personal importance. Home does not account for unrecorded obligations or preferences.</p></div></details>
  </section>;
}

function Commitment({ group, action, index, focal, timeZone, controls }: { group: HomeActionGroup; action: HomeAction; index: number; focal: boolean; timeZone: string; controls: ActionControls }) {
  const meaning = homeActionMeaning(action);
  const time = actionTime(action, timeZone);
  const headingId = `home-group-${group.key}${index ? `-${index}` : ""}`;
  const tone = group.key === "overdue" ? "text-danger" : group.key === "today" ? "text-warning" : "text-accent";
  const Icon = group.key === "interviews" ? CalendarDays : Clock;
  return <article aria-labelledby={headingId} data-home-commitment data-focal={focal} className="min-w-0 rounded-2xl border border-line bg-surface-raised p-3 sm:p-4 lg:p-5">
    <div className="flex flex-wrap items-start gap-3 lg:flex-nowrap lg:gap-4">
      <DateBlock action={action} timeZone={timeZone} focal={focal} />
      <div className="min-w-[min(100%,12rem)] flex-1">
        <h3 id={headingId} className={`flex items-start gap-1.5 text-xs font-semibold ${tone}`}><Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span className="min-w-0 break-words">{labels[group.key]}</span></h3>
        <Link to={actionDestination(action)} aria-label={`${action.kind.startsWith("INTERVIEW_") ? "Interviews for " : ""}${action.job_title} · ${action.company_name}`} className="mt-1 block min-h-11 break-words text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <span className={`block font-display font-bold leading-tight ${focal ? "text-lg lg:text-2xl" : "text-base lg:text-xl"}`}>{action.company_name}</span><span className="mt-1 block text-sm leading-5">{action.job_title}</span>
        </Link>
        <p className="mt-1 break-words text-xs leading-5 text-ink-muted">{time ? <><time dateTime={time.dateTime}>{time.label}</time> · </> : null}{meaning.owner}</p>
        {action.kind.startsWith("INTERVIEW_") ? <p className="break-words text-xs leading-5 text-ink-muted">Destination: application Interviews</p> : null}
      </div>
    </div>
    <ActionDisclosure id={`${headingId}-details`} group={group} actions={group.hiddenCount > 0 ? group.actions : [action]} timeZone={timeZone} controls={controls} compact><p className="min-w-0 flex-[1_1_10rem] break-words text-sm leading-5 text-ink-muted">{homeActionPreviewReason(action)}</p></ActionDisclosure>
  </article>;
}

function OtherWork({ group, timeZone, controls }: { group: HomeActionGroup; timeZone: string; controls: ActionControls }) {
  const action = group.preview[0];
  return <div aria-labelledby={`home-group-${group.key}`} className="min-w-0 py-3 first:pt-0">
    <h3 id={`home-group-${group.key}`} className="flex items-center gap-2 text-sm font-semibold text-ink-muted"><Search aria-hidden="true" className="size-4 shrink-0" />{labels[group.key]}</h3>
    <Link to={actionDestination(action)} className="mt-1 block min-h-11 break-words py-1 text-sm font-semibold leading-5 text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{action.job_title} · {action.company_name}</Link>
    <p className="text-sm leading-5 text-ink-muted">{group.key === "review" ? `${action.label}. No recorded deadline.` : `${action.label}. Candidate-owned; no recorded deadline.`}</p>
    <ActionDisclosure id={`home-group-${group.key}-details`} group={group} actions={group.actions} timeZone={timeZone} controls={controls} />
  </div>;
}

function ActionDisclosure({ id, group, actions, timeZone, controls, compact = false, children }: { id: string; group: HomeActionGroup; actions: HomeAction[]; timeZone: string; controls: ActionControls; compact?: boolean; children?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <>
    <div className={`mt-2 ${compact ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-1" : ""}`}>
      {children}
      <button type="button" aria-expanded={expanded} aria-controls={id} className={`${textLink} text-xs ${compact && actions.length === 1 ? "shrink-0" : ""}`} onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide details" : actions.length > 1 ? `See all ${actions.length} returned items` : compact ? "Details" : "View details and options"}<span className="sr-only"> · {group.label} · {actions[0].company_name}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>
    </div>
    <CollapsibleRegion id={id} open={expanded}>
      <ul className="divide-y divide-line-subtle border-t border-line-subtle">{actions.map((action) => <DecisionRow key={actionKey(action)} action={action} timeZone={timeZone} controls={controls} />)}</ul>
    </CollapsibleRegion>
  </>;
}

function DecisionRow({ action, timeZone, controls }: { action: HomeAction; timeZone: string; controls: ActionControls }) {
  const meaning = homeActionMeaning(action);
  const time = actionTime(action, timeZone);
  const followUp = action.kind === "FOLLOW_UP_OVERDUE" || action.kind === "FOLLOW_UP_TODAY";
  const resolving = controls.resolvingActionId === action.application_id;
  return <li className="min-w-0 py-4">
    <p className="text-xs font-semibold leading-5 text-ink-muted">{meaning.condition} · {meaning.owner}{time ? <> · <time dateTime={time.dateTime}>{time.label}</time></> : " · no recorded deadline"}</p>
    <Link to={actionDestination(action)} className="mt-1 inline-flex min-h-11 max-w-full items-center break-words text-sm font-semibold text-ink hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{action.kind.startsWith("INTERVIEW_") ? "Interviews for " : ""}{action.job_title} · {action.company_name}</Link>
    <p className="text-sm leading-6 text-ink-muted">Why this is here: {meaning.reason}</p>
    {meaning.limitation ? <p className="mt-1 text-sm leading-6 text-ink-muted">{meaning.limitation}</p> : null}
    {followUp ? <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={buttonClassName("secondary", "min-h-11")} disabled={resolving} onClick={() => controls.onComplete(action)}>{resolving ? <PendingIndicator label="Completing…" /> : "Complete follow-up"}</button><button type="button" className={buttonClassName("ghost", "min-h-11")} disabled={resolving} onClick={() => controls.onBeginReschedule(action.application_id)}>Reschedule</button></div> : null}
    {controls.rescheduling === action.application_id ? <div className="mt-3 max-w-xs rounded-xl bg-surface-muted p-3"><label htmlFor={`reschedule-${action.application_id}`} className="block text-sm font-semibold text-ink">New follow-up date</label><input id={`reschedule-${action.application_id}`} type="date" value={controls.followUpDate} onChange={(event) => controls.onDateChange(event.target.value)} className="hf-field mt-2 min-h-11 w-full min-w-0 rounded-lg px-3 text-sm" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" className={buttonClassName("primary", "min-h-11")} disabled={!controls.followUpDate || controls.reschedulePending} onClick={() => controls.onSaveDate(action.application_id)}>Save date</button><button type="button" className={buttonClassName("ghost", "min-h-11")} onClick={controls.onCancelReschedule}>Cancel</button></div></div> : null}
  </li>;
}
