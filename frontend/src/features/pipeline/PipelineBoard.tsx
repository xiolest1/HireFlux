import {
  DragDropProvider,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { ArrowRight, GripVertical, MoveRight, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ApplicationStatus, PipelineCard, PipelineLane } from "../../api/schemas";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorPanel, LoadingState } from "../../components/ui/Feedback";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { useToast } from "../../components/ui/toastContext";
import { formatDateOnly, formatStatus } from "../applications/format";
import { useTransitionApplication } from "../applications/queries";
import { usePipeline } from "./queries";

const PIPELINE_STATUSES: ApplicationStatus[] = [
  "DRAFT",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

const pipelineStatuses = new Set<ApplicationStatus>(PIPELINE_STATUSES);

interface PendingMove {
  card: PipelineCard;
  targetStatus: ApplicationStatus | null;
}

function applicationHref(status: ApplicationStatus) {
  return `/applications?view=ALL&status=${encodeURIComponent(status)}`;
}

function stageAgeLabel(days: number | null) {
  if (days === null) return null;
  return days === 0 ? "Entered today" : `${days} ${days === 1 ? "day" : "days"} in this stage`;
}

function followUpLabel(card: PipelineCard) {
  if (card.follow_up_state === "NONE") return "No follow-up scheduled";
  const prefix = card.follow_up_state === "OVERDUE"
    ? "Follow-up overdue"
    : card.follow_up_state === "TODAY"
      ? "Follow-up today"
      : "Follow-up";
  return `${prefix}: ${formatDateOnly(card.application.follow_up_date)}`;
}

function followUpClassName(card: PipelineCard) {
  if (card.follow_up_state === "OVERDUE") return "bg-danger-soft text-danger";
  if (card.follow_up_state === "TODAY") return "bg-warning-soft text-warning";
  if (card.follow_up_state === "UPCOMING") return "bg-accent-soft text-accent-strong";
  return "bg-surface-muted text-ink-muted";
}

function allowedPipelineTargets(card: PipelineCard) {
  return card.application.allowed_transitions.filter((status) => pipelineStatuses.has(status));
}

export function PipelineBoard() {
  const pipelineQuery = usePipeline();
  const transitionMutation = useTransitionApplication();
  const { showToast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>("APPLIED");
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [appliedDate, setAppliedDate] = useState("");

  function beginMove(card: PipelineCard, targetStatus: ApplicationStatus | null = null) {
    transitionMutation.reset();
    setAppliedDate(card.application.applied_date ?? "");
    setPendingMove({ card, targetStatus });
  }

  function onDragEnd(event: DragEndEvent) {
    if (event.canceled) return;
    const sourceData = event.operation.source?.data;
    const targetData = event.operation.target?.data;
    const applicationId = sourceData?.applicationId;
    const targetStatus = targetData?.status;
    if (typeof applicationId !== "string" || typeof targetStatus !== "string") return;
    const card = pipelineQuery.data?.lanes
      .flatMap((lane) => lane.cards)
      .find((item) => item.application.application_id === applicationId);
    if (!card || !pipelineStatuses.has(targetStatus as ApplicationStatus)) return;
    if (!allowedPipelineTargets(card).includes(targetStatus as ApplicationStatus)) return;
    beginMove(card, targetStatus as ApplicationStatus);
  }

  async function confirmMove() {
    if (!pendingMove?.targetStatus) return;
    const { card, targetStatus } = pendingMove;
    const needsAppliedDate =
      card.application.status === "DRAFT" && targetStatus === "APPLIED" && !card.application.applied_date;
    if (needsAppliedDate && !appliedDate) return;
    try {
      const updated = await transitionMutation.mutateAsync({
        applicationId: card.application.application_id,
        request: {
          status: targetStatus,
          expected_version: card.application.version,
          ...(needsAppliedDate ? { applied_date: appliedDate } : {}),
        },
      });
      showToast(`Status changed to ${formatStatus(updated.status)}.`, {
        title: "Application updated",
        tone: "success",
      });
      setPendingMove(null);
    } catch {
      // The mutation error panel keeps the server response available for recovery.
    }
  }

  if (pipelineQuery.isPending) return <PipelineSkeleton />;
  if (pipelineQuery.isError || !pipelineQuery.data) {
    return <ErrorPanel title="Pipeline could not be loaded" error={pipelineQuery.error} onRetry={() => void pipelineQuery.refetch()} />;
  }

  const selectedLane = pipelineQuery.data.lanes.find((lane) => lane.status === selectedStatus)
    ?? pipelineQuery.data.lanes[0];

  return (
    <section aria-labelledby="pipeline-title" className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-panel sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Workflow</p>
          <h2 id="pipeline-title" className="mt-1 text-2xl font-bold text-ink">Manage your application pipeline</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">Move applications when their real-world status changes. Every move is checked against your workflow before it is saved.</p>
        </div>
        <Link to="/applications/new" className={buttonClassName("primary", "shrink-0 gap-2")}><Plus aria-hidden="true" className="size-4" />Add application</Link>
      </div>

      <p className="text-sm leading-6 text-ink-muted">Drag cards on desktop or use the Move action at any size. Archived applications stay in <Link to="/applications?view=ARCHIVED" className="font-semibold text-accent hover:underline">Archived Applications</Link>.</p>

      <div className="lg:hidden">
        <label htmlFor="pipeline-stage" className="text-sm font-semibold text-ink">Show stage</label>
        <select id="pipeline-stage" value={selectedLane.status} onChange={(event) => setSelectedStatus(event.target.value as ApplicationStatus)} className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised px-3 text-sm font-semibold text-ink">
          {pipelineQuery.data.lanes.map((lane) => <option key={lane.status} value={lane.status}>{formatStatus(lane.status)} ({lane.count})</option>)}
        </select>
        <div className="mt-4"><PipelineLane lane={selectedLane} onMove={beginMove} dragEnabled={false} /></div>
      </div>

      <div className="hidden overflow-x-auto pb-2 lg:block" aria-label="Pipeline board">
        <DragDropProvider onDragEnd={onDragEnd}>
          <div className="grid min-w-[132rem] grid-cols-8 gap-4">
            {pipelineQuery.data.lanes.map((lane) => <PipelineLane key={lane.status} lane={lane} onMove={beginMove} dragEnabled />)}
          </div>
        </DragDropProvider>
      </div>

      <MoveConfirmation
        pendingMove={pendingMove}
        onClose={() => setPendingMove(null)}
        appliedDate={appliedDate}
        onAppliedDateChange={setAppliedDate}
        onTargetChange={(targetStatus) => setPendingMove((current) => current ? { ...current, targetStatus } : null)}
        onConfirm={() => void confirmMove()}
        isPending={transitionMutation.isPending}
        error={transitionMutation.error}
      />
    </section>
  );
}

function PipelineLane({ lane, onMove, dragEnabled }: { lane: PipelineLane; onMove: (card: PipelineCard, targetStatus?: ApplicationStatus | null) => void; dragEnabled: boolean }) {
  const { ref, isDropTarget } = useDroppable({
    id: `pipeline-lane-${lane.status}`,
    data: { status: lane.status },
    accept: (draggable) => {
      const transitions = draggable.data.allowedTransitions;
      return Array.isArray(transitions) && transitions.includes(lane.status);
    },
  });
  const terminal = ["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(lane.status);

  return (
    <section ref={ref} aria-labelledby={`pipeline-lane-${lane.status}`} className={`min-h-56 rounded-2xl border p-3 ${terminal ? "border-line bg-surface-muted/70" : "border-line bg-surface"} ${isDropTarget ? "ring-2 ring-accent ring-offset-2" : ""}`}>
      <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 id={`pipeline-lane-${lane.status}`} className="font-bold text-ink">{formatStatus(lane.status)}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{lane.count} {lane.count === 1 ? "application" : "applications"}</p>
        </div>
        {lane.count > lane.cards.length || lane.has_more ? <Link to={applicationHref(lane.status)} className="text-xs font-bold text-accent hover:underline">View all</Link> : null}
      </header>
      {lane.cards.length ? <ul className="mt-3 space-y-3">{lane.cards.map((card) => <li key={card.application.application_id}><PipelineCardItem card={card} onMove={onMove} dragEnabled={dragEnabled} /></li>)}</ul> : <p className="py-8 text-center text-sm leading-6 text-ink-muted">No applications in this stage.</p>}
    </section>
  );
}

function PipelineCardItem({ card, onMove, dragEnabled }: { card: PipelineCard; onMove: (card: PipelineCard, targetStatus?: ApplicationStatus | null) => void; dragEnabled: boolean }) {
  const { handleRef, isDragging, ref } = useDraggable({
    id: `pipeline-card-${card.application.application_id}`,
    data: { applicationId: card.application.application_id, allowedTransitions: allowedPipelineTargets(card) },
    disabled: !dragEnabled || allowedPipelineTargets(card).length === 0,
  });
  const targets = allowedPipelineTargets(card);
  const ageLabel = stageAgeLabel(card.stage_age_days);

  return (
    <article ref={ref} className={`rounded-xl border border-line bg-surface-raised p-3 shadow-sm ${isDragging ? "opacity-45" : ""}`}>
      <div className="flex gap-2">
        <button ref={handleRef} type="button" className="hidden min-h-11 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:inline-flex" aria-label={`Drag ${card.application.company_name} to another allowed stage`} title="Drag to an allowed stage"><GripVertical aria-hidden="true" className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{card.application.company_name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{card.application.job_title}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        {ageLabel ? <p className="text-ink-muted">{ageLabel}</p> : null}
        <p className={`inline-flex rounded-full px-2 py-1 font-semibold ${followUpClassName(card)}`}>{followUpLabel(card)}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={`/applications/${card.application.application_id}`} className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline">Open details<ArrowRight aria-hidden="true" className="ml-1 size-3.5" /></Link>
        {targets.length ? <button type="button" className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => onMove(card)}><MoveRight aria-hidden="true" className="mr-1 size-3.5" />Move…</button> : null}
      </div>
    </article>
  );
}

function MoveConfirmation({ pendingMove, onClose, appliedDate, onAppliedDateChange, onTargetChange, onConfirm, isPending, error }: { pendingMove: PendingMove | null; onClose: () => void; appliedDate: string; onAppliedDateChange: (value: string) => void; onTargetChange: (status: ApplicationStatus) => void; onConfirm: () => void; isPending: boolean; error: Error | null }) {
  const card = pendingMove?.card;
  const targetStatus = pendingMove?.targetStatus;
  const targets = card ? allowedPipelineTargets(card) : [];
  const needsAppliedDate = card?.application.status === "DRAFT" && targetStatus === "APPLIED" && !card.application.applied_date;
  const ready = Boolean(targetStatus && (!needsAppliedDate || appliedDate));
  return <Drawer open={Boolean(pendingMove)} onClose={onClose} title={targetStatus ? "Confirm status move" : "Move application"} description={card ? `${card.application.company_name} · ${card.application.job_title}` : undefined} size="sm" footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className={buttonClassName("ghost")} onClick={onClose} disabled={isPending}>Cancel</button><button type="button" className={buttonClassName("primary")} onClick={onConfirm} disabled={!ready || isPending}>{isPending ? "Moving…" : targetStatus ? `Move to ${formatStatus(targetStatus)}` : "Choose a stage"}</button></div>}>
    {card ? <div className="space-y-5">
      <div><label htmlFor="pipeline-target-status" className="text-sm font-semibold text-ink">New stage</label><select id="pipeline-target-status" value={targetStatus ?? ""} onChange={(event) => onTargetChange(event.target.value as ApplicationStatus)} className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised px-3 text-sm font-semibold text-ink"><option value="">Choose a stage</option>{targets.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></div>
      {targetStatus ? <div className="rounded-xl border border-line bg-surface-muted p-4 text-sm leading-6 text-ink"><p><span className="font-semibold">Current:</span> {formatStatus(card.application.status)}</p><p><span className="font-semibold">New:</span> {formatStatus(targetStatus)}</p><p className="mt-2 text-ink-muted">The change is saved only after you confirm and the server validates the workflow.</p></div> : null}
      {needsAppliedDate ? <div><label htmlFor="pipeline-applied-date" className="text-sm font-semibold text-ink">Applied date <span className="text-danger">*</span></label><input id="pipeline-applied-date" type="date" value={appliedDate} onChange={(event) => onAppliedDateChange(event.target.value)} required className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised px-3 text-ink" /><p className="mt-2 text-xs leading-5 text-ink-muted">An application needs an applied date before it can enter the active workflow.</p></div> : null}
      {error ? <ErrorPanel compact title="Status could not be changed" error={error} /> : null}
    </div> : null}
  </Drawer>;
}

function PipelineSkeleton() {
  return <LoadingState label="Loading your application pipeline…" />;
}
