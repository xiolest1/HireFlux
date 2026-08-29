import { useState, type FormEvent } from "react";
import type { Application, ApplicationStatus } from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/toastContext";
import { updateSearchTour } from "../workspace/queries";
import { formatStatus } from "./format";
import { currentDateInTimeZone } from "./formSchema";
import { useTransitionApplication } from "./queries";

interface StatusTransitionFormProps {
  application: Application;
  onReload: () => void;
  timeZone?: string;
  initialStatus?: ApplicationStatus | null;
  onSuccess?: () => void;
  embedded?: boolean;
}

export function StatusTransitionForm({
  application,
  onReload,
  timeZone = "UTC",
  initialStatus = null,
  onSuccess,
  embedded = false,
}: StatusTransitionFormProps) {
  const transitionMutation = useTransitionApplication();
  const { showToast } = useToast();
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus | "">(
    initialStatus && application.allowed_transitions.includes(initialStatus) ? initialStatus : "",
  );
  const [appliedDate, setAppliedDate] = useState(application.applied_date ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const appliedDateMaximum = currentDateInTimeZone(timeZone);

  const needsAppliedDate =
    [
      "APPLIED",
      "SCREENING",
      "INTERVIEW",
      "OFFER",
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ].includes(targetStatus) && !application.applied_date;
  const isArchiving = targetStatus === "ARCHIVED";
  const isRestoring = application.status === "ARCHIVED" && targetStatus !== "";
  const isDraftCorrection = application.status === "APPLIED" && targetStatus === "DRAFT";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!targetStatus) {
      setValidationError("Choose a new status.");
      return;
    }
    if (!application.allowed_transitions.includes(targetStatus)) {
      setValidationError("That status is no longer available. Reload and try again.");
      return;
    }
    if (needsAppliedDate && !appliedDate) {
      setValidationError("Applied date is required before entering or restoring this status.");
      return;
    }
    if (needsAppliedDate && appliedDate > appliedDateMaximum) {
      setValidationError("Applied date cannot be in the future.");
      return;
    }

    try {
      const updated = await transitionMutation.mutateAsync({
        applicationId: application.application_id,
        request: {
          status: targetStatus,
          expected_version: application.version,
          ...(needsAppliedDate ? { applied_date: appliedDate } : {}),
        },
      });
      showToast(
        isDraftCorrection
          ? "Application corrected to Draft."
          : `Status changed to ${formatStatus(updated.status)}.`,
        {
        title: isDraftCorrection ? "Application corrected" : "Application updated",
        tone: "success",
        },
      );
      setTargetStatus("");
      updateSearchTour("status");
      onSuccess?.();
    } catch {
      return;
    }
  }

  if (application.allowed_transitions.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
        <h2 className="text-lg font-bold text-ink">Status</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          No status changes are currently available for this application.
        </p>
      </section>
    );
  }

  return (
    <section className={embedded ? "" : "rounded-2xl border border-line bg-surface p-5 shadow-panel"}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Current stage</p>
          <h2 className="mt-1 text-lg font-bold text-ink">Change status</h2>
        </div>
        <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-bold text-ink">
          {formatStatus(application.status)}
        </span>
      </div>
        <p className="text-sm leading-6 text-ink-muted">
          Only transitions allowed by the application policy are shown.
        </p>
      {isDraftCorrection ? (
        <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-3 py-3 text-sm leading-6 text-ink">
          This correction clears the applied date and returns the opportunity to Draft. Its submission and activity history remain available.
        </p>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <div>
          <label htmlFor="target-status" className="text-sm font-semibold text-ink">
            New status
          </label>
          <select
            id="target-status"
            value={targetStatus}
            aria-invalid={Boolean(validationError && !targetStatus)}
            onChange={(event) => {
              setTargetStatus(event.target.value as ApplicationStatus | "");
              setValidationError(null);
              transitionMutation.reset();
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-sm font-semibold text-ink shadow-sm"
          >
            <option value="">Choose a status</option>
            {application.allowed_transitions.map((status) => (
              <option key={status} value={status}>
                {application.status === "ARCHIVED"
                  ? `Restore to ${formatStatus(status)}`
                  : formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        {needsAppliedDate ? (
          <div>
            <label htmlFor="transition-applied-date" className="text-sm font-semibold text-ink">
              Applied date <span className="text-danger">*</span>
            </label>
            <input
              id="transition-applied-date"
              type="date"
              max={appliedDateMaximum}
              value={appliedDate}
              required
              aria-invalid={Boolean(validationError && !appliedDate)}
              onChange={(event) => {
                setAppliedDate(event.target.value);
                setValidationError(null);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-ink shadow-sm"
            />
          </div>
        ) : null}

        {validationError ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {validationError}
          </p>
        ) : null}

        {transitionMutation.error ? (
          <ErrorPanel
            compact
            error={transitionMutation.error}
            title="Status could not be changed"
            onRetry={() => {
              transitionMutation.reset();
              onReload();
            }}
          />
        ) : null}

        <Button
          type="submit"
          variant={isArchiving ? "danger" : "primary"}
          className="w-full"
          disabled={!targetStatus || transitionMutation.isPending}
        >
          {transitionMutation.isPending
            ? "Updating…"
            : isArchiving
              ? "Archive application"
              : isDraftCorrection
                ? "Correct to Draft"
              : isRestoring
                ? `Restore to ${formatStatus(targetStatus as ApplicationStatus)}`
                : targetStatus
                  ? `Move to ${formatStatus(targetStatus)}`
                  : "Update status"}
        </Button>
      </form>
    </section>
  );
}
