import { useState } from "react";
import { ApiError } from "../../api/client";
import type { Application } from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/Feedback";
import { currentDateInTimeZone } from "./formSchema";
import { useUpdateApplicationNextStep } from "./queries";

type CandidateChoice = "CANDIDATE" | "EMPLOYER" | "NONE" | "NEXT_ROUND" | "UNCLEAR";

export function NextStepPlanner({
  application,
  timeZone,
  hasLaterScheduledInterview = false,
  onSaved,
  onLeaveUnclear,
  onConflict,
}: {
  application: Application;
  timeZone: string;
  hasLaterScheduledInterview?: boolean;
  onSaved?: (application: Application) => void;
  onLeaveUnclear?: () => void;
  onConflict?: () => void | Promise<unknown>;
}) {
  const initialChoice: CandidateChoice = application.next_step_responsibility ?? (
    hasLaterScheduledInterview ? "NEXT_ROUND" : "UNCLEAR"
  );
  const [choice, setChoice] = useState<CandidateChoice>(initialChoice);
  const [note, setNote] = useState(application.next_step_note ?? "");
  const [date, setDate] = useState(application.follow_up_date ?? "");
  const mutation = useUpdateApplicationNextStep();
  const needsDescription = choice === "CANDIDATE";
  const showDetails = choice === "CANDIDATE" || choice === "EMPLOYER";

  async function submit() {
    if (choice === "UNCLEAR") {
      onLeaveUnclear?.();
      return;
    }
    const responsibility = choice === "NEXT_ROUND" ? "NONE" : choice;
    try {
      const updated = await mutation.mutateAsync({
        applicationId: application.application_id,
        request: {
          expected_version: application.version,
          next_step_responsibility: responsibility,
          next_step_note: responsibility === "NONE" ? null : note.trim() || null,
          follow_up_date: responsibility === "NONE" ? null : date || null,
        },
      });
      onSaved?.(updated);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await onConflict?.();
      }
      return;
    }
  }

  return (
    <section aria-labelledby="next-step-planner-title" className="space-y-5">
      <div>
        <h3 id="next-step-planner-title" className="font-display text-xl font-bold text-ink">
          What happens next?
        </h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Record who owns the next move. A check-back date only controls when HireFlux brings this opportunity back to your attention.
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="sr-only">Choose what happens next</legend>
        {([
          ["CANDIDATE", "I need to do something", "Record the action you want to complete."],
          ["EMPLOYER", "I’m waiting on them", "Keep the expectation and optionally schedule a check-back."],
          ...(hasLaterScheduledInterview
            ? [["NEXT_ROUND", "Another interview is already scheduled", "HireFlux will use the actual interview record."]]
            : []),
          ["NONE", "No separate action right now", "This opportunity does not need another task or reminder."],
          ["UNCLEAR", "Nothing is clear yet", "Leave the next step unresolved and decide later."],
        ] as Array<[CandidateChoice, string, string]>).map(([value, label, description]) => (
          <div key={value} className="flex min-h-14 items-start gap-3 rounded-xl border border-line bg-surface p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input
              id={`next-step-${value.toLowerCase()}`}
              aria-label={label}
              type="radio"
              name="next-step-choice"
              value={value}
              checked={choice === value}
              onChange={() => setChoice(value)}
              className="mt-1 size-5 accent-accent"
            />
            <span>
              <label htmlFor={`next-step-${value.toLowerCase()}`} className="block cursor-pointer text-sm font-semibold text-ink">{label}</label>
              <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{description}</span>
            </span>
          </div>
        ))}
      </fieldset>

      {showDetails ? (
        <div className="grid gap-4 rounded-2xl bg-surface-muted p-4">
          <div>
            <label htmlFor="next-step-note" className="text-sm font-semibold text-ink">
              {choice === "CANDIDATE" ? "What do you need to do?" : "What are you waiting for?"}
              {needsDescription ? <span className="text-danger"> *</span> : null}
            </label>
            <textarea
              id="next-step-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm leading-6 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label htmlFor="next-step-date" className="text-sm font-semibold text-ink">
              {choice === "CANDIDATE" ? "When should this return to your attention?" : "Check back if you have not heard by"}
              <span className="ml-1 font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="next-step-date"
              type="date"
              min={currentDateInTimeZone(timeZone)}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-ink"
            />
          </div>
        </div>
      ) : null}

      {mutation.isError ? (
        <ErrorPanel
          compact
          title={mutation.error instanceof ApiError && mutation.error.status === 409
            ? "Opportunity changed"
            : "Next step could not be updated"}
          error={mutation.error}
          onRetry={() => void submit()}
        />
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          disabled={mutation.isPending || (needsDescription && !note.trim())}
          onClick={() => void submit()}
        >
          {mutation.isPending
            ? "Saving…"
            : choice === "UNCLEAR"
              ? "Decide later"
              : "Save next step"}
        </Button>
      </div>
    </section>
  );
}
