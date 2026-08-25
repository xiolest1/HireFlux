import { CheckCircle2, CircleHelp, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Interview, InterviewWorkspace } from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorPanel } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/toastContext";
import { useUpdateInterviewWorkspace } from "./queries";

interface WorkspaceDraft extends InterviewWorkspace {
  candidate_questions: string[];
}

function draftFrom(interview: Interview): WorkspaceDraft {
  return {
    completed_checklist_items: [...interview.completed_checklist_items],
    preparation_notes: interview.preparation_notes,
    candidate_questions:
      interview.candidate_questions.length > 0
        ? [...interview.candidate_questions]
        : ["", ""],
    debrief_went_well: interview.debrief_went_well,
    debrief_improve: interview.debrief_improve,
    debrief_signals: interview.debrief_signals,
    debrief_next_step: interview.debrief_next_step,
  };
}

const textAreaClassName =
  "mt-2 min-h-28 w-full resize-y rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink-muted";

export function InterviewWorkspaceDrawer({
  applicationId,
  interview,
  onClose,
}: {
  applicationId: string;
  interview: Interview;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WorkspaceDraft>(() =>
    draftFrom(interview),
  );
  const mutation = useUpdateInterviewWorkspace(applicationId);
  const { showToast } = useToast();
  const completed = new Set(draft.completed_checklist_items);
  const guidance = interview.guidance;
  const completedCount = guidance.checklist_items.filter((item) =>
    completed.has(item.item_id),
  ).length;
  const canCompleteDebrief = Boolean(
    draft.debrief_went_well?.trim() && draft.debrief_next_step?.trim(),
  );
  const normalizedQuestions = useMemo(
    () =>
      draft.candidate_questions
        .map((question) => question.trim())
        .filter(Boolean),
    [draft.candidate_questions],
  );

  async function save(debriefComplete: boolean) {
    try {
      await mutation.mutateAsync({
        interviewId: interview.interview_id,
        version: interview.version,
        debriefComplete,
        workspace: {
          completed_checklist_items: draft.completed_checklist_items,
          preparation_notes: draft.preparation_notes?.trim() || null,
          candidate_questions: normalizedQuestions,
          debrief_went_well: draft.debrief_went_well?.trim() || null,
          debrief_improve: draft.debrief_improve?.trim() || null,
          debrief_signals: draft.debrief_signals?.trim() || null,
          debrief_next_step: draft.debrief_next_step?.trim() || null,
        },
      });
      showToast(
        debriefComplete
          ? "Interview debrief saved."
          : "Interview preparation saved.",
        { title: "Interview workspace updated", tone: "success" },
      );
      onClose();
    } catch {
      return;
    }
  }

  function toggleChecklist(itemId: string) {
    setDraft((current) => ({
      ...current,
      completed_checklist_items: current.completed_checklist_items.includes(
        itemId,
      )
        ? current.completed_checklist_items.filter((value) => value !== itemId)
        : [...current.completed_checklist_items, itemId],
    }));
  }

  function addSuggestedQuestion(question: string) {
    if (
      normalizedQuestions.some(
        (value) => value.toLocaleLowerCase() === question.toLocaleLowerCase(),
      ) ||
      normalizedQuestions.length >= 8
    ) {
      return;
    }
    const emptyIndex = draft.candidate_questions.findIndex(
      (value) => !value.trim(),
    );
    if (emptyIndex >= 0) {
      const next = [...draft.candidate_questions];
      next[emptyIndex] = question;
      setDraft({ ...draft, candidate_questions: next });
    } else {
      setDraft({
        ...draft,
        candidate_questions: [...draft.candidate_questions, question],
      });
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        interview.status === "COMPLETED"
          ? "Interview debrief"
          : "Interview preparation"
      }
      description={`${interview.company_name} · ${interview.job_title}`}
      size="xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {interview.status === "COMPLETED" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => void save(false)}
              >
                Save draft
              </Button>
              <Button
                type="button"
                disabled={!canCompleteDebrief || mutation.isPending}
                onClick={() => void save(true)}
              >
                {interview.debrief_completed_at
                  ? "Save debrief"
                  : "Complete debrief"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void save(false)}
            >
              {mutation.isPending ? "Saving…" : "Save preparation"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-7">
        {mutation.error ? (
          <ErrorPanel
            compact
            title="Workspace could not be saved"
            error={mutation.error}
          />
        ) : null}

        {interview.status === "COMPLETED" ? (
          <section
            aria-labelledby="debrief-title"
            className="rounded-2xl border border-violet/20 bg-violet-soft p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-violet"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet">
                  Capture the conversation
                </p>
                <h3 id="debrief-title" className="mt-1 font-bold text-ink">
                  Post-interview debrief
                </h3>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  Your private reflection—not employer feedback or an automated
                  assessment.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <DebriefField
                label="What went well"
                required
                value={draft.debrief_went_well}
                onChange={(value) =>
                  setDraft({ ...draft, debrief_went_well: value })
                }
              />
              <DebriefField
                label="What would you improve"
                value={draft.debrief_improve}
                onChange={(value) =>
                  setDraft({ ...draft, debrief_improve: value })
                }
              />
              <DebriefField
                label="Signals you noticed"
                value={draft.debrief_signals}
                onChange={(value) =>
                  setDraft({ ...draft, debrief_signals: value })
                }
              />
              <DebriefField
                label="Concrete next step"
                required
                maxLength={500}
                value={draft.debrief_next_step}
                onChange={(value) =>
                  setDraft({ ...draft, debrief_next_step: value })
                }
              />
            </div>
          </section>
        ) : null}

        {interview.status === "COMPLETED" ? (
          <div className="border-t border-line pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
              Preparation record
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Your original preparation remains editable below for an accurate
              interview record.
            </p>
          </div>
        ) : null}

        <section
          aria-labelledby="readiness-title"
          className="rounded-2xl border border-accent/20 bg-accent-soft p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                Explainable readiness
              </p>
              <h3 id="readiness-title" className="mt-1 font-bold text-ink">
                {completedCount} of {guidance.readiness.total_steps} preparation
                steps complete
              </h3>
            </div>
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{
                width: `${(completedCount / guidance.readiness.total_steps) * 100}%`,
              }}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">
            Readiness is simply the checklist below—there is no hidden score or
            AI judgment.
          </p>
        </section>

        <section aria-labelledby="focus-prompts-title">
          <h3 id="focus-prompts-title" className="font-bold text-ink">
            Focus prompts
          </h3>
          <ul className="mt-3 space-y-2">
            {guidance.focus_prompts.map((prompt) => (
              <li
                key={prompt}
                className="flex items-start gap-2 text-sm leading-6 text-ink-muted"
              >
                <CircleHelp
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-violet"
                />
                {prompt}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="checklist-title">
          <h3 id="checklist-title" className="font-bold text-ink">
            Preparation checklist
          </h3>
          <div className="mt-3 space-y-2">
            {guidance.checklist_items.map((item) => (
              <div
                key={item.item_id}
                className="flex items-start gap-3 rounded-xl border border-line bg-surface-raised p-3 hover:border-accent/40"
              >
                <input
                  id={`interview-checklist-${item.item_id}`}
                  type="checkbox"
                  checked={completed.has(item.item_id)}
                  onChange={() => toggleChecklist(item.item_id)}
                  className="mt-1 size-4 accent-accent"
                />
                <label
                  htmlFor={`interview-checklist-${item.item_id}`}
                  className="min-w-0 cursor-pointer"
                >
                  <span className="block text-sm font-semibold text-ink">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                    {item.description}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="stories-title">
          <label
            id="stories-title"
            htmlFor="interview-preparation-notes"
            className="font-bold text-ink"
          >
            Evidence stories and preparation notes
          </label>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Capture the situation, your decision, measurable impact, and what
            you learned.
          </p>
          <textarea
            id="interview-preparation-notes"
            rows={7}
            maxLength={5000}
            value={draft.preparation_notes ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, preparation_notes: event.target.value })
            }
            className={textAreaClassName}
          />
        </section>

        <section aria-labelledby="candidate-questions-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 id="candidate-questions-title" className="font-bold text-ink">
                Questions you want answered
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                Prepare up to eight. Two are required to complete the question
                step.
              </p>
            </div>
            {draft.candidate_questions.length < 8 ? (
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
                onClick={() =>
                  setDraft({
                    ...draft,
                    candidate_questions: [...draft.candidate_questions, ""],
                  })
                }
              >
                <Plus aria-hidden="true" className="size-4" /> Add
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {draft.candidate_questions.map((question, index) => (
              <div key={index} className="flex gap-2">
                <label
                  htmlFor={`candidate-question-${index}`}
                  className="sr-only"
                >
                  Candidate question {index + 1}
                </label>
                <input
                  id={`candidate-question-${index}`}
                  maxLength={300}
                  value={question}
                  onChange={(event) => {
                    const next = [...draft.candidate_questions];
                    next[index] = event.target.value;
                    setDraft({ ...draft, candidate_questions: next });
                  }}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink"
                />
                {draft.candidate_questions.length > 2 ? (
                  <button
                    type="button"
                    aria-label={`Remove candidate question ${index + 1}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        candidate_questions: draft.candidate_questions.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-surface-muted p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Suggested for this interview
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {guidance.suggested_questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-semibold leading-5 text-ink hover:border-accent/40"
                  onClick={() => addSuggestedQuestion(question)}
                >
                  <Plus aria-hidden="true" className="mr-1 inline size-3.5" />
                  {question}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

function DebriefField({
  label,
  value,
  onChange,
  required = false,
  maxLength = 2000,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
}) {
  const id = `debrief-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <textarea
        id={id}
        rows={5}
        maxLength={maxLength}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={textAreaClassName}
      />
    </div>
  );
}
