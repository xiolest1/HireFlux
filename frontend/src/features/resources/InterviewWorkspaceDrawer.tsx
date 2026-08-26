import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ROLE_FAMILIES,
  type Interview,
  type InterviewWorkspace,
  type RoleFamily,
} from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorPanel } from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/toastContext";
import {
  formatTimestamp,
  formatRoleFamily,
} from "../applications/format";
import {
  useApplication,
  useUpdateApplication,
} from "../applications/queries";
import {
  useCreatePreparationItem,
  useDeletePreparationItem,
  useUpdateInterviewWorkspace,
} from "./queries";

interface WorkspaceDraft extends InterviewWorkspace {
  candidate_questions: string[];
}

const phaseLabels = {
  UNDERSTAND: "Understand",
  PREPARE: "Prepare",
  CONFIRM: "Confirm",
} as const;

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
  "mt-2 min-h-28 w-full resize-y rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
const focusClassName =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type DrawerMode = "PREPARE" | "CAPTURE" | "REVIEW" | "EDIT";

function modeFor(interview: Interview): DrawerMode {
  if (interview.status !== "COMPLETED") return "PREPARE";
  return interview.debrief_completed_at ? "REVIEW" : "CAPTURE";
}

export function InterviewWorkspaceDrawer({
  applicationId,
  interview,
  timeZone,
  onClose,
}: {
  applicationId: string;
  interview: Interview;
  timeZone: string;
  onClose: () => void;
}) {
  const [currentInterview, setCurrentInterview] = useState(interview);
  const [mode, setMode] = useState<DrawerMode>(() => modeFor(interview));
  const [draft, setDraft] = useState<WorkspaceDraft>(() => draftFrom(interview));
  const [roleChoice, setRoleChoice] = useState<RoleFamily | "AUTO">(
    interview.guidance.role_context.source === "USER_SELECTED"
      ? interview.guidance.role_context.role_family
      : "AUTO",
  );
  const [customLabel, setCustomLabel] = useState("");
  const [showMoreTips, setShowMoreTips] = useState(false);
  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false);
  const questionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const addQuestionRef = useRef<HTMLButtonElement>(null);
  const editReflectionRef = useRef<HTMLButtonElement>(null);
  const applicationQuery = useApplication(applicationId);
  const roleMutation = useUpdateApplication();
  const workspaceMutation = useUpdateInterviewWorkspace(applicationId);
  const createItemMutation = useCreatePreparationItem(applicationId);
  const deleteItemMutation = useDeletePreparationItem(applicationId);
  const { showToast } = useToast();

  useEffect(() => {
    if (interview.version > currentInterview.version) {
      setCurrentInterview(interview);
      setRoleChoice(
        interview.guidance.role_context.source === "USER_SELECTED"
          ? interview.guidance.role_context.role_family
          : "AUTO",
      );
      const validIds = new Set(interview.guidance.checklist_items.map((item) => item.item_id));
      setDraft((current) => ({
        ...current,
        completed_checklist_items: current.completed_checklist_items.filter((item) =>
          validIds.has(item),
        ),
      }));
    }
  }, [currentInterview.version, interview]);

  const guidance = currentInterview.guidance;
  const completed = new Set(draft.completed_checklist_items);
  const completedCount = guidance.checklist_items.filter((item) =>
    completed.has(item.item_id),
  ).length;
  const nextStep = guidance.checklist_items.find((item) => !completed.has(item.item_id));
  const normalizedQuestions = useMemo(
    () => draft.candidate_questions.map((question) => question.trim()).filter(Boolean),
    [draft.candidate_questions],
  );
  const canCompleteDebrief = Boolean(
    draft.debrief_went_well?.trim() && draft.debrief_next_step?.trim(),
  );
  const pending =
    workspaceMutation.isPending ||
    roleMutation.isPending ||
    createItemMutation.isPending ||
    deleteItemMutation.isPending;
  const mutationError =
    workspaceMutation.error ||
    roleMutation.error ||
    createItemMutation.error ||
    deleteItemMutation.error;

  async function save(debriefComplete: boolean, returnToReview = false) {
    try {
      const updated = await workspaceMutation.mutateAsync({
        interviewId: currentInterview.interview_id,
        version: currentInterview.version,
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
        debriefComplete ? "Interview debrief saved." : "Interview preparation saved.",
        { title: "Interview workspace updated", tone: "success" },
      );
      if (returnToReview) {
        setCurrentInterview(updated);
        setDraft(draftFrom(updated));
        setMode("REVIEW");
        window.setTimeout(() => editReflectionRef.current?.focus(), 0);
      } else {
        onClose();
      }
    } catch {
      return;
    }
  }

  function cancelReflectionEdit() {
    setDraft(draftFrom(currentInterview));
    setMode("REVIEW");
    window.setTimeout(() => editReflectionRef.current?.focus(), 0);
  }

  async function applyRoleFocus() {
    const application = applicationQuery.data;
    if (!application) return;
    try {
      await roleMutation.mutateAsync({
        applicationId,
        request: {
          expected_version: application.version,
          role_family: roleChoice === "AUTO" ? null : roleChoice,
        },
      });
      showToast("Preparation focus updated for every interview round.", {
        title: "Role context saved",
        tone: "success",
      });
    } catch {
      return;
    }
  }

  async function addCustomItem() {
    const label = customLabel.trim();
    if (!label) return;
    try {
      const updated = await createItemMutation.mutateAsync({
        interviewId: currentInterview.interview_id,
        version: currentInterview.version,
        label,
      });
      setCurrentInterview(updated);
      setCustomLabel("");
      showToast("Custom preparation item added.", { tone: "success" });
    } catch {
      return;
    }
  }

  async function removeCustomItem(itemId: string) {
    try {
      const updated = await deleteItemMutation.mutateAsync({
        interviewId: currentInterview.interview_id,
        itemId,
        version: currentInterview.version,
      });
      setCurrentInterview(updated);
      setDraft((current) => ({
        ...current,
        completed_checklist_items: current.completed_checklist_items.filter(
          (value) => value !== itemId,
        ),
      }));
    } catch {
      return;
    }
  }

  function toggleChecklist(itemId: string) {
    setDraft((current) => ({
      ...current,
      completed_checklist_items: current.completed_checklist_items.includes(itemId)
        ? current.completed_checklist_items.filter((value) => value !== itemId)
        : [...current.completed_checklist_items, itemId],
    }));
  }

  function addQuestion(value = "") {
    if (draft.candidate_questions.length >= 8) return;
    const nextIndex = draft.candidate_questions.length;
    setDraft((current) => ({
      ...current,
      candidate_questions: [...current.candidate_questions, value],
    }));
    window.setTimeout(() => questionRefs.current[nextIndex]?.focus(), 0);
  }

  function addSuggestedQuestion(question: string) {
    if (
      normalizedQuestions.some((value) => value.toLowerCase() === question.toLowerCase()) ||
      normalizedQuestions.length >= 8
    ) return;
    const emptyIndex = draft.candidate_questions.findIndex((value) => !value.trim());
    if (emptyIndex >= 0) {
      const next = [...draft.candidate_questions];
      next[emptyIndex] = question;
      setDraft((current) => ({ ...current, candidate_questions: next }));
      window.setTimeout(() => questionRefs.current[emptyIndex]?.focus(), 0);
    } else {
      addQuestion(question);
    }
  }

  function removeQuestion(index: number) {
    setDraft((current) => ({
      ...current,
      candidate_questions: current.candidate_questions.filter((_, itemIndex) =>
        itemIndex !== index,
      ),
    }));
    window.setTimeout(() => {
      const previousQuestion = questionRefs.current[Math.max(0, index - 1)];
      if (previousQuestion) {
        previousQuestion.focus();
      } else {
        addQuestionRef.current?.focus();
      }
    }, 0);
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.candidate_questions.length) return;
    const next = [...draft.candidate_questions];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft((current) => ({ ...current, candidate_questions: next }));
    window.setTimeout(() => questionRefs.current[target]?.focus(), 0);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        mode === "PREPARE"
          ? "Interview preparation"
          : mode === "CAPTURE"
            ? "Capture interview debrief"
            : mode === "EDIT"
              ? "Edit interview reflection"
              : "Interview reflection"
      }
      description={`${currentInterview.company_name} · ${currentInterview.job_title}`}
      size="xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          {mode === "REVIEW" ? (
            <Button
              ref={editReflectionRef}
              type="button"
              onClick={() => setMode("EDIT")}
            >
              Edit reflection
            </Button>
          ) : mode === "EDIT" ? (
            <>
              <Button type="button" variant="secondary" onClick={cancelReflectionEdit}>
                Cancel editing
              </Button>
              <Button
                type="button"
                disabled={!canCompleteDebrief || pending}
                onClick={() => void save(true, true)}
              >
                {workspaceMutation.isPending ? "Saving…" : "Save reflection"}
              </Button>
            </>
          ) : mode === "CAPTURE" ? (
            <>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => void save(false)}>
                Save draft
              </Button>
              <Button type="button" disabled={!canCompleteDebrief || pending} onClick={() => void save(true)}>
                Complete debrief
              </Button>
            </>
          ) : (
            <Button type="button" disabled={pending} onClick={() => void save(false)}>
              {workspaceMutation.isPending ? "Saving…" : "Save preparation"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-7">
        {mutationError ? <ErrorPanel compact title="Workspace could not be saved" error={mutationError} /> : null}

        {mode === "REVIEW" ? (
          <DebriefReview interview={currentInterview} timeZone={timeZone} />
        ) : mode === "CAPTURE" || mode === "EDIT" ? (
          <DebriefSection draft={draft} setDraft={setDraft} />
        ) : null}

        {currentInterview.status !== "COMPLETED" ? (
          <>
        <section aria-labelledby="readiness-title" className="rounded-2xl border border-accent/20 bg-accent-soft p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Explainable readiness</p>
              <h3 id="readiness-title" className="mt-1 font-bold text-ink">
                {completedCount} of {guidance.readiness.total_steps} preparation steps complete
              </h3>
              <p className="mt-2 text-sm text-ink-muted">
                {nextStep ? <>Next: <strong className="text-ink">{nextStep.label}</strong></> : "Every visible step is complete."}
              </p>
            </div>
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(completedCount / guidance.readiness.total_steps) * 100}%` }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">This is visible checklist completion—never a hidden score or AI judgment.</p>
        </section>

        <section aria-labelledby="preparation-focus-title" className="rounded-2xl border border-line bg-surface-muted p-4">
          <h3 id="preparation-focus-title" className="font-bold text-ink">Preparation focus</h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{guidance.role_context.explanation}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="preparation-role-family" className="text-xs font-bold text-ink-muted">Role family</label>
              <select id="preparation-role-family" value={roleChoice} onChange={(event) => setRoleChoice(event.target.value as RoleFamily | "AUTO")} className="mt-1 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink">
                <option value="AUTO">Automatic from job title</option>
                {ROLE_FAMILIES.map((family) => <option key={family} value={family}>{formatRoleFamily(family)}</option>)}
              </select>
            </div>
            <Button type="button" variant="secondary" disabled={!applicationQuery.data || pending} onClick={() => void applyRoleFocus()}>Apply focus</Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">This choice is shared by every interview round for this application. General always uses role-neutral guidance.</p>
        </section>

        <section aria-labelledby="checklist-title">
          <h3 id="checklist-title" className="font-bold text-ink">Preparation checklist</h3>
          {(["UNDERSTAND", "PREPARE", "CONFIRM"] as const).map((phase) => {
            const items = guidance.checklist_items.filter((item) => item.phase === phase);
            if (items.length === 0) return null;
            return (
              <div key={phase} className="mt-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">{phaseLabels[phase]}</h4>
                <div className="mt-2 space-y-2">
                  {items.map((item) => (
                    <div key={item.item_id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-raised p-3">
                      <input id={`interview-checklist-${item.item_id}`} type="checkbox" checked={completed.has(item.item_id)} onChange={() => toggleChecklist(item.item_id)} className="mt-1 size-5 shrink-0 accent-accent" />
                      <label htmlFor={`interview-checklist-${item.item_id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm font-semibold text-ink">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{item.description}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-violet">{item.source_label}</span>
                      </label>
                      {item.removable ? <button type="button" aria-label={`Remove custom preparation item: ${item.label}`} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted ${focusClassName}`} disabled={pending} onClick={() => void removeCustomItem(item.item_id)}><Trash2 aria-hidden="true" className="size-4" /></button> : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {currentInterview.custom_preparation_items.length < 2 ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="custom-preparation-item" className="sr-only">Custom preparation item</label>
              <input id="custom-preparation-item" maxLength={120} value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Add your own preparation item" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink" />
              <Button type="button" variant="secondary" disabled={!customLabel.trim() || pending} onClick={() => void addCustomItem()}><Plus aria-hidden="true" className="size-4" /> Add item</Button>
            </div>
          ) : <p className="mt-3 text-xs text-ink-muted">You have added the maximum of two custom items.</p>}
        </section>

        <section aria-labelledby="focus-prompts-title">
          <h3 id="focus-prompts-title" className="font-bold text-ink">Focus for this interview</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {guidance.focus_prompts.map((prompt) => <li key={prompt.text} className="rounded-xl bg-surface-muted p-3 text-sm leading-6 text-ink"><span className="flex items-start gap-2"><CircleHelp aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet" />{prompt.text}</span><span className="mt-1 block pl-6 text-[11px] font-semibold text-ink-muted">{prompt.source_label}</span></li>)}
          </ul>
          <div className="mt-3 rounded-xl border border-line bg-surface-raised p-3">
            {guidance.tips.slice(0, showMoreTips ? undefined : 1).map((tip) => <div key={tip.title} className="py-1"><p className="text-sm font-bold text-ink">{tip.title}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{tip.body}</p><p className="mt-1 text-[11px] font-semibold text-violet">{tip.source_label}</p></div>)}
            {guidance.tips.length > 1 ? <button type="button" aria-expanded={showMoreTips} aria-controls="additional-preparation-tips" className={`mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent ${focusClassName}`} onClick={() => setShowMoreTips((value) => !value)}>{showMoreTips ? "Show fewer tips" : `Show ${guidance.tips.length - 1} more tips`}<ChevronDown aria-hidden="true" className={`size-4 transition-transform ${showMoreTips ? "rotate-180" : ""}`} /></button> : null}
            <span id="additional-preparation-tips" hidden />
          </div>
        </section>

        <section aria-labelledby="stories-title">
          <label id="stories-title" htmlFor="interview-preparation-notes" className="font-bold text-ink">Evidence stories and preparation notes</label>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Private to this demo workspace and never included in Analytics.</p>
          <details className="mt-2 rounded-xl bg-surface-muted p-3">
            <summary className={`min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent ${focusClassName}`}>How to structure an evidence story</summary>
            <dl className="grid gap-2 pt-2 text-xs leading-5 text-ink-muted sm:grid-cols-2"><div><dt className="font-bold text-ink">Situation and your role</dt><dd>What was happening, and what were you responsible for?</dd></div><div><dt className="font-bold text-ink">Action</dt><dd>What did you personally decide or do?</dd></div><div><dt className="font-bold text-ink">Result</dt><dd>What changed, and how do you know?</dd></div><div><dt className="font-bold text-ink">Reflection</dt><dd>What did you learn or improve afterward?</dd></div></dl>
          </details>
          <textarea id="interview-preparation-notes" rows={7} maxLength={5000} value={draft.preparation_notes ?? ""} onChange={(event) => setDraft({ ...draft, preparation_notes: event.target.value })} className={textAreaClassName} />
        </section>

        <section aria-labelledby="candidate-questions-title">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="candidate-questions-title" className="font-bold text-ink">Questions you want answered</h3><p className="mt-1 text-xs text-ink-muted">Your questions are saved in this order. Two complete the checklist step.</p></div>{draft.candidate_questions.length < 8 ? <button ref={addQuestionRef} type="button" className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft ${focusClassName}`} onClick={() => addQuestion()}><Plus aria-hidden="true" className="size-4" /> Add question</button> : null}</div>
          <div className="mt-3 space-y-2">
            {draft.candidate_questions.map((question, index) => <div key={index} className="flex min-w-0 gap-2"><label htmlFor={`candidate-question-${index}`} className="sr-only">Candidate question {index + 1}</label><input ref={(node) => { questionRefs.current[index] = node; }} id={`candidate-question-${index}`} maxLength={300} value={question} onChange={(event) => { const next = [...draft.candidate_questions]; next[index] = event.target.value; setDraft({ ...draft, candidate_questions: next }); }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink" /><div className="flex shrink-0"><button type="button" aria-label={`Move candidate question ${index + 1} up`} disabled={index === 0} className={`inline-flex size-11 items-center justify-center rounded-xl text-ink-muted disabled:opacity-30 ${focusClassName}`} onClick={() => moveQuestion(index, -1)}><ArrowUp aria-hidden="true" className="size-4" /></button><button type="button" aria-label={`Move candidate question ${index + 1} down`} disabled={index === draft.candidate_questions.length - 1} className={`inline-flex size-11 items-center justify-center rounded-xl text-ink-muted disabled:opacity-30 ${focusClassName}`} onClick={() => moveQuestion(index, 1)}><ArrowDown aria-hidden="true" className="size-4" /></button>{draft.candidate_questions.length > 2 ? <button type="button" aria-label={`Remove candidate question ${index + 1}`} className={`inline-flex size-11 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted ${focusClassName}`} onClick={() => removeQuestion(index)}><X aria-hidden="true" className="size-4" /></button> : null}</div></div>)}
          </div>
          <div className="mt-4 rounded-xl bg-surface-muted p-3"><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">HireFlux suggestions</p><div id="additional-question-suggestions" className="mt-2 grid gap-2">{guidance.suggested_questions.slice(0, showMoreSuggestions ? undefined : 3).map((suggestion) => { const added = normalizedQuestions.some((value) => value.toLowerCase() === suggestion.text.toLowerCase()); return <button key={suggestion.text} type="button" disabled={added || normalizedQuestions.length >= 8} aria-label={`${added ? "Added" : "Add suggested question"}: ${suggestion.text}`} className={`rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs leading-5 text-ink disabled:opacity-60 ${focusClassName}`} onClick={() => addSuggestedQuestion(suggestion.text)}><span className="font-semibold">{added ? "Added · " : "+ "}{suggestion.text}</span><span className="mt-1 block text-[11px] text-ink-muted">{suggestion.source_label}</span></button>; })}</div>{guidance.suggested_questions.length > 3 ? <button type="button" aria-expanded={showMoreSuggestions} aria-controls="additional-question-suggestions" className={`mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent ${focusClassName}`} onClick={() => setShowMoreSuggestions((value) => !value)}>{showMoreSuggestions ? "Show fewer suggestions" : `See ${guidance.suggested_questions.length - 3} more suggestions`}<ChevronDown aria-hidden="true" className={`size-4 ${showMoreSuggestions ? "rotate-180" : ""}`} /></button> : null}</div>
        </section>
          </>
        ) : (
          <PreparationHistory interview={currentInterview} />
        )}
      </div>
    </Drawer>
  );
}

function DebriefReview({
  interview,
  timeZone,
}: {
  interview: Interview;
  timeZone: string;
}) {
  const fields = [
    ["What went well", interview.debrief_went_well],
    ["What would you improve", interview.debrief_improve],
    ["Signals you noticed", interview.debrief_signals],
    ["Concrete next step", interview.debrief_next_step],
  ] as const;
  return (
    <section
      aria-labelledby="debrief-review-title"
      className="rounded-2xl border border-violet/20 bg-violet-soft p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-violet"
        />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet">
            Saved private reflection
          </p>
          <h3 id="debrief-review-title" className="mt-1 font-bold text-ink">
            Interview debrief
          </h3>
          {interview.debrief_completed_at ? (
            <p className="mt-1 text-xs text-ink-muted">
              Completed {formatTimestamp(interview.debrief_completed_at, timeZone)}
            </p>
          ) : null}
        </div>
      </div>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm font-semibold text-ink">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
              {value || "Not recorded"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PreparationHistory({ interview }: { interview: Interview }) {
  const completed = new Set(interview.completed_checklist_items);
  return (
    <details className="group rounded-2xl border border-line bg-surface-muted p-4">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink marker:hidden ${focusClassName}`}
      >
        <span>Preparation record</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-ink-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-4 border-t border-line pt-4">
        <p className="text-xs leading-5 text-ink-muted">
          Preparation is preserved as a read-only historical record after the
          interview is completed.
        </p>
        <ul className="space-y-2">
          {interview.guidance.checklist_items.map((item) => (
            <li key={item.item_id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 font-bold text-ink-muted" aria-hidden="true">
                {completed.has(item.item_id) ? "✓" : "–"}
              </span>
              <span className="text-ink">{item.label}</span>
              <span className="sr-only">
                {completed.has(item.item_id) ? "Completed" : "Not completed"}
              </span>
            </li>
          ))}
        </ul>
        {interview.preparation_notes ? (
          <div>
            <h4 className="text-sm font-semibold text-ink">Preparation notes</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
              {interview.preparation_notes}
            </p>
          </div>
        ) : null}
        {interview.candidate_questions.length ? (
          <div>
            <h4 className="text-sm font-semibold text-ink">Saved questions</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6 text-ink-muted">
              {interview.candidate_questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function DebriefSection({ draft, setDraft }: { draft: WorkspaceDraft; setDraft: Dispatch<SetStateAction<WorkspaceDraft>> }) {
  return <section aria-labelledby="debrief-title" className="rounded-2xl border border-violet/20 bg-violet-soft p-4 sm:p-5"><div className="flex items-start gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet" /><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet">Capture the conversation</p><h3 id="debrief-title" className="mt-1 font-bold text-ink">Post-interview debrief</h3><p className="mt-1 text-xs leading-5 text-ink-muted">Your private reflection—not employer feedback or an automated assessment.</p></div></div><div className="mt-4 grid gap-5 sm:grid-cols-2"><DebriefField label="What went well" required value={draft.debrief_went_well} onChange={(value) => setDraft({ ...draft, debrief_went_well: value })} /><DebriefField label="What would you improve" value={draft.debrief_improve} onChange={(value) => setDraft({ ...draft, debrief_improve: value })} /><DebriefField label="Signals you noticed" value={draft.debrief_signals} onChange={(value) => setDraft({ ...draft, debrief_signals: value })} /><DebriefField label="Concrete next step" required maxLength={500} value={draft.debrief_next_step} onChange={(value) => setDraft({ ...draft, debrief_next_step: value })} /></div></section>;
}

function DebriefField({ label, value, onChange, required = false, maxLength = 2000 }: { label: string; value: string | null; onChange: (value: string) => void; required?: boolean; maxLength?: number }) {
  const id = `debrief-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-ink">{label}{required ? <span className="text-danger"> *</span> : null}</label><textarea id={id} rows={5} maxLength={maxLength} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={textAreaClassName} /></div>;
}
