import { useState, type FormEvent } from "react";
import type { Application, ApplicationStatus } from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { ErrorPanel, SuccessBanner } from "../../components/ui/Feedback";
import { formatStatus } from "./format";
import { useTransitionApplication } from "./queries";

interface StatusTransitionFormProps {
  application: Application;
  onReload: () => void;
}

export function StatusTransitionForm({
  application,
  onReload,
}: StatusTransitionFormProps) {
  const transitionMutation = useTransitionApplication();
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus | "">("");
  const [appliedDate, setAppliedDate] = useState(application.applied_date ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const needsAppliedDate = targetStatus === "APPLIED" && !application.applied_date;
  const isArchiving = targetStatus === "ARCHIVED";
  const isRestoring = application.status === "ARCHIVED" && targetStatus !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    if (!targetStatus) {
      setValidationError("Choose a new status.");
      return;
    }
    if (!application.allowed_transitions.includes(targetStatus)) {
      setValidationError("That status is no longer available. Reload and try again.");
      return;
    }
    if (needsAppliedDate && !appliedDate) {
      setValidationError("Applied date is required before moving to Applied.");
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
      setSuccessMessage(`Status changed to ${formatStatus(updated.status)}.`);
      setTargetStatus("");
    } catch {
      return;
    }
  }

  if (application.allowed_transitions.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
        <h2 className="text-lg font-bold text-slate-950">Status</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          No status changes are currently available for this application.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <h2 className="text-lg font-bold text-slate-950">Change status</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Only transitions allowed by the application policy are shown.
      </p>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <div>
          <label htmlFor="target-status" className="text-sm font-semibold text-slate-800">
            New status
          </label>
          <select
            id="target-status"
            value={targetStatus}
            aria-invalid={Boolean(validationError && !targetStatus)}
            onChange={(event) => {
              setTargetStatus(event.target.value as ApplicationStatus | "");
              setValidationError(null);
              setSuccessMessage(null);
              transitionMutation.reset();
            }}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm"
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
            <label htmlFor="transition-applied-date" className="text-sm font-semibold text-slate-800">
              Applied date <span className="text-rose-700">*</span>
            </label>
            <input
              id="transition-applied-date"
              type="date"
              value={appliedDate}
              required
              aria-invalid={Boolean(validationError && !appliedDate)}
              onChange={(event) => {
                setAppliedDate(event.target.value);
                setValidationError(null);
              }}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm"
            />
          </div>
        ) : null}

        {validationError ? (
          <p className="text-sm font-medium text-rose-700" role="alert">
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

        {successMessage ? <SuccessBanner>{successMessage}</SuccessBanner> : null}

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
