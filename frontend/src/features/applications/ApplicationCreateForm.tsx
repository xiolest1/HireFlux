import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { Link, useBlocker } from "react-router-dom";
import {
  APPLICATION_SOURCES,
  type ApplicationStatus,
} from "../../api/schemas";
import type { DuplicateCandidateRequest } from "../../api/applications";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/Feedback";
import { useModalFocus } from "../../components/ui/useModalFocus";
import {
  applicationCreateFormDefaults,
  applicationCreateFormSchema,
  currentDateInTimeZone,
  type ApplicationCreateFormInput,
  type ApplicationCreateFormValues,
} from "./formSchema";
import { formatDateOnly, formatSource } from "./format";
import { useDuplicateCandidates } from "./queries";

const fieldClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-ink transition-colors placeholder:text-ink-tertiary hover:border-line-strong hover:bg-surface-hover focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled";

const CREATE_STATUSES = [
  { value: "DRAFT", label: "Saved", description: "Track it before applying" },
  { value: "APPLIED", label: "Applied", description: "Application submitted" },
  { value: "INTERVIEW", label: "Interviewing", description: "Already in interviews" },
] as const;

type CreateStatus = (typeof CREATE_STATUSES)[number]["value"];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

function statusLabel(status: ApplicationStatus) {
  if (status === "DRAFT") return "Saved";
  if (status === "INTERVIEW") return "Interviewing";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function sourceDetailLabel(source: string) {
  if (source === "RECRUITER") return "Recruiter name";
  if (source === "REFERRAL") return "Who referred you?";
  if (source === "CAREER_FAIR") return "Event name";
  return "Source detail";
}

function validHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

interface ApplicationCreateFormProps {
  timeZone: string;
  isSubmitting: boolean;
  serverError?: unknown;
  onSubmit: (values: ApplicationCreateFormValues) => Promise<boolean>;
}

export function ApplicationCreateForm({
  timeZone,
  isSubmitting,
  serverError,
  onSubmit,
}: ApplicationCreateFormProps) {
  const today = currentDateInTimeZone(timeZone);
  const unsavedDialogRef = useRef<HTMLElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const allowNavigationRef = useRef(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [duplicateRequest, setDuplicateRequest] =
    useState<DuplicateCandidateRequest | null>(null);
  const {
    control,
    getValues,
    handleSubmit,
    register,
    reset,
    setFocus,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ApplicationCreateFormInput, unknown, ApplicationCreateFormValues>({
    resolver: zodResolver(applicationCreateFormSchema(today)),
    defaultValues: applicationCreateFormDefaults(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const [companyName, jobTitle, jobUrl, location, selectedStatus, workMode, source] =
    useWatch({
      control,
      name: [
        "company_name",
        "job_title",
        "job_url",
        "location",
        "status",
        "work_mode",
        "source",
      ],
    });
  const hasMoreDetailErrors = Boolean(
    errors.location ||
      errors.work_mode ||
      errors.source ||
      errors.source_detail ||
      errors.salary_text ||
      errors.description,
  );
  const blocker = useBlocker(
    () => isDirty && !isSubmitting && !allowNavigationRef.current,
  );
  const evidence = useMemo<DuplicateCandidateRequest | null>(() => {
    const company = companyName.trim();
    const title = jobTitle.trim();
    const url = jobUrl.trim();
    const hasCompanyAndTitle = company.length >= 2 && title.length >= 2;
    const hasUrl = validHttpUrl(url);
    if (!hasCompanyAndTitle && !hasUrl) return null;
    return {
      ...(company.length >= 2 ? { company_name: company } : {}),
      ...(title.length >= 2 ? { job_title: title } : {}),
      ...(hasUrl ? { job_url: url } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
    };
  }, [companyName, jobTitle, jobUrl, location]);
  const duplicateQuery = useDuplicateCandidates(duplicateRequest);

  useEffect(() => {
    const timer = window.setTimeout(() => setFocus("company_name"), 0);
    return () => window.clearTimeout(timer);
  }, [setFocus]);

  useEffect(() => {
    setDuplicateRequest(null);
    if (!evidence) {
      return;
    }
    const timer = window.setTimeout(() => setDuplicateRequest(evidence), 500);
    return () => window.clearTimeout(timer);
  }, [evidence]);

  useEffect(() => {
    if (hasMoreDetailErrors) setMoreDetailsOpen(true);
  }, [hasMoreDetailErrors]);

  function keepEditing() {
    if (blocker.state === "blocked") blocker.reset();
  }

  useModalFocus({
    isOpen: blocker.state === "blocked",
    containerRef: unsavedDialogRef,
    initialFocusRef: keepEditingButtonRef,
    onClose: keepEditing,
  });

  useEffect(() => {
    if (!isDirty || allowNavigation) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [allowNavigation, isDirty]);

  function chooseStatus(nextStatus: CreateStatus) {
    const previousStatus = getValues("status");
    const currentDate = getValues("applied_date");
    setValue("status", nextStatus, { shouldDirty: true, shouldValidate: true });
    if (nextStatus === "APPLIED" && !currentDate) {
      setValue("applied_date", today, { shouldDirty: true, shouldValidate: true });
    }
    if (nextStatus === "INTERVIEW" && previousStatus === "DRAFT" && !currentDate) {
      setValue("applied_date", "", { shouldDirty: true, shouldValidate: true });
    }
  }

  function companyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    setFocus("job_title");
  }

  async function submit(values: ApplicationCreateFormValues) {
    allowNavigationRef.current = true;
    setAllowNavigation(true);
    try {
      const shouldReset = await onSubmit(values);
      if (shouldReset) {
        reset(applicationCreateFormDefaults());
        setMoreDetailsOpen(false);
        setDuplicateRequest(null);
        window.setTimeout(() => setFocus("company_name"), 0);
      }
    } finally {
      allowNavigationRef.current = false;
      setAllowNavigation(false);
    }
  }

  function focusFirstError(invalidErrors: FieldErrors<ApplicationCreateFormInput>) {
    const order: Array<keyof ApplicationCreateFormInput> = [
      "company_name",
      "job_title",
      "status",
      "applied_date",
      "job_url",
      "source",
      "source_detail",
      "work_mode",
      "location",
      "salary_text",
      "description",
    ];
    const first = order.find((field) => invalidErrors[field]);
    if (!first) return;
    if (["source", "source_detail", "work_mode", "location", "salary_text", "description"].includes(first)) {
      setMoreDetailsOpen(true);
    }
    window.setTimeout(() => setFocus(first), 0);
  }

  const candidates = duplicateQuery.data?.candidates ?? [];
  const sourceNeedsDetail = ["RECRUITER", "REFERRAL", "CAREER_FAIR", "OTHER"].includes(
    source,
  );
  const visibleStage = CREATE_STATUSES.find((item) => item.value === selectedStatus);

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={handleSubmit(submit, focusFirstError)}
    >
      {blocker.state === "blocked" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            ref={unsavedDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-create-title"
            aria-describedby="unsaved-create-description"
            className="w-full max-w-md rounded-2xl border border-line bg-surface-raised p-6 shadow-2xl"
          >
            <h2 id="unsaved-create-title" className="text-xl font-bold text-ink">
              Leave without adding this application?
            </h2>
            <p id="unsaved-create-description" className="mt-3 text-sm leading-6 text-ink-muted">
              The opportunity details you entered will be lost.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button ref={keepEditingButtonRef} variant="secondary" onClick={keepEditing}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()}>
                Leave page
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {Object.keys(errors).length
          ? `${Object.keys(errors).length} field ${Object.keys(errors).length === 1 ? "needs" : "fields need"} attention.`
          : ""}
      </p>

      {serverError ? <ErrorPanel error={serverError} compact title="Application could not be added" /> : null}

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-panel sm:p-7" aria-labelledby="quick-capture-title">
        <div className="border-b border-line pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Quick capture</p>
          <h2 id="quick-capture-title" className="mt-1 text-xl font-bold text-ink">
            What opportunity are you tracking?
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Company and role are all you need to begin. Everything else can be added later.
          </p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="company_name" className="text-sm font-semibold text-ink">
              Company <span className="text-danger">*</span>
            </label>
            <input
              id="company_name"
              autoComplete="organization"
              required
              maxLength={120}
              aria-invalid={Boolean(errors.company_name)}
              aria-describedby={errors.company_name ? "company_name-error" : undefined}
              className={`${fieldClassName} text-base font-semibold`}
              {...register("company_name")}
              onKeyDown={companyKeyDown}
            />
            <FieldError id="company_name-error" message={errors.company_name?.message} />
          </div>

          <div>
            <label htmlFor="job_title" className="text-sm font-semibold text-ink">
              Role <span className="text-danger">*</span>
            </label>
            <input
              id="job_title"
              autoComplete="organization-title"
              required
              maxLength={120}
              aria-invalid={Boolean(errors.job_title)}
              aria-describedby={errors.job_title ? "job_title-error" : undefined}
              className={`${fieldClassName} text-base font-semibold`}
              {...register("job_title")}
            />
            <FieldError id="job_title-error" message={errors.job_title?.message} />
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">Current stage</legend>
          <div className="mt-2 grid grid-cols-3 rounded-2xl border border-line-strong bg-surface-muted p-1">
            {CREATE_STATUSES.map((stage) => (
              <label
                key={stage.value}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${
                  selectedStatus === stage.value
                    ? "bg-surface-raised text-accent shadow-sm ring-1 ring-accent/40"
                    : "text-ink-muted hover:bg-surface hover:text-ink"
                }`}
                title={stage.description}
              >
                <input
                  type="radio"
                  value={stage.value}
                  className="sr-only"
                  {...register("status")}
                  onChange={() => chooseStatus(stage.value)}
                />
                {stage.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            {visibleStage?.description}. You can update the stage later from the application.
          </p>
        </fieldset>

        {selectedStatus === "APPLIED" || selectedStatus === "INTERVIEW" ? (
          <div className="mt-5 max-w-sm">
            <div className="flex items-end justify-between gap-3">
              <label htmlFor="applied_date" className="text-sm font-semibold text-ink">
                Applied on <span className="text-danger">*</span>
              </label>
              <button
                type="button"
                className="min-h-11 rounded-lg px-2 text-sm font-semibold text-accent hover:underline"
                onClick={() =>
                  setValue("applied_date", today, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                Today
              </button>
            </div>
            <input
              id="applied_date"
              type="date"
              max={today}
              required
              aria-invalid={Boolean(errors.applied_date)}
              aria-describedby={errors.applied_date ? "applied_date-error" : undefined}
              className={fieldClassName}
              {...register("applied_date")}
            />
            <FieldError id="applied_date-error" message={errors.applied_date?.message} />
          </div>
        ) : null}

        <div className="mt-6">
          <label htmlFor="job_url" className="text-sm font-semibold text-ink">
            Job posting link <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="job_url"
            type="url"
            inputMode="url"
            placeholder="https://company.example/jobs/role"
            maxLength={2048}
            aria-invalid={Boolean(errors.job_url)}
            aria-describedby={errors.job_url ? "job_url-hint job_url-error" : "job_url-hint"}
            className={fieldClassName}
            {...register("job_url")}
          />
          <p id="job_url-hint" className="mt-1.5 text-xs text-ink-muted">
            A posting link helps HireFlux recognize an opportunity you may already track.
          </p>
          <FieldError id="job_url-error" message={errors.job_url?.message} />
        </div>

        {candidates.length ? (
          <aside
            className={`mt-5 rounded-2xl border p-4 ${
              candidates[0].confidence === "HIGH"
                ? "border-warning/40 bg-warning-soft"
                : "border-accent/25 bg-accent-soft"
            }`}
            aria-labelledby="duplicate-advisory-title"
            aria-live="polite"
          >
            <p id="duplicate-advisory-title" className="font-semibold text-ink">
              {candidates[0].confidence === "HIGH"
                ? "You may already be tracking this role"
                : "Possible existing application"}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              You can review a match or continue adding this as a separate opportunity.
            </p>
            <ul className="mt-3 space-y-2">
              {candidates.map((candidate) => (
                <li key={candidate.application_id} className="rounded-xl bg-surface-raised/80 px-3 py-2.5">
                  <Link
                    to={`/applications/${candidate.application_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg text-sm font-semibold text-ink hover:text-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{candidate.job_title} at {candidate.company_name}</span>
                      <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                        {statusLabel(candidate.status)} · {candidate.applied_date ? `Applied ${formatDateOnly(candidate.applied_date)}` : `Added ${formatDateOnly(candidate.created_at.slice(0, 10))}`}
                      </span>
                    </span>
                    <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </section>

      <details
        open={moreDetailsOpen}
        onToggle={(event) => setMoreDetailsOpen(event.currentTarget.open)}
        className="group rounded-2xl border border-line bg-surface shadow-panel"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left marker:hidden sm:px-6">
          <span>
            <span className="flex items-center gap-2 text-base font-semibold text-ink">
              <Sparkles aria-hidden="true" className="size-4 text-violet" />
              More details
              <span className="text-sm font-normal text-ink-muted">· optional</span>
            </span>
            <span className="mt-1 block text-sm text-ink-muted">
              Add source, work arrangement, location, salary, or the description.
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-5 border-t border-line px-5 pb-5 pt-5 sm:grid-cols-2 sm:px-6 sm:pb-6" role="group" aria-label="Optional application details">
          <div>
            <label htmlFor="source" className="text-sm font-semibold text-ink">
              Where did you find this job?
            </label>
            <select
              id="source"
              className={fieldClassName}
              aria-invalid={Boolean(errors.source)}
              {...register("source", {
                onChange: (event) => {
                  if (!["RECRUITER", "REFERRAL", "CAREER_FAIR", "OTHER"].includes(event.target.value)) {
                    setValue("source_detail", "");
                  }
                },
              })}
            >
              <option value="">Not specified</option>
              {APPLICATION_SOURCES.map((applicationSource) => (
                <option key={applicationSource} value={applicationSource}>{formatSource(applicationSource)}</option>
              ))}
            </select>
          </div>

          {sourceNeedsDetail ? (
            <div>
              <label htmlFor="source_detail" className="text-sm font-semibold text-ink">
                {sourceDetailLabel(source)} <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="source_detail"
                maxLength={120}
                className={fieldClassName}
                aria-invalid={Boolean(errors.source_detail)}
                aria-describedby={errors.source_detail ? "source_detail-error" : undefined}
                {...register("source_detail")}
              />
              <FieldError id="source_detail-error" message={errors.source_detail?.message} />
            </div>
          ) : null}

          <div>
            <label htmlFor="work_mode" className="text-sm font-semibold text-ink">Work arrangement</label>
            <select id="work_mode" className={fieldClassName} {...register("work_mode")}>
              <option value="">Not specified</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
            </select>
          </div>

          <div>
            <label htmlFor="location" className="text-sm font-semibold text-ink">
              {workMode === "REMOTE" ? "Location restriction" : "Location"} <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="location"
              autoComplete="address-level2"
              maxLength={160}
              placeholder={workMode === "REMOTE" ? "Region or time zone, if restricted" : "City, state, or region"}
              className={fieldClassName}
              aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? "location-error" : undefined}
              {...register("location")}
            />
            <FieldError id="location-error" message={errors.location?.message} />
          </div>

          <div>
            <label htmlFor="salary_text" className="text-sm font-semibold text-ink">
              Salary range <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input id="salary_text" placeholder="$120k–$145k, equity" maxLength={120} className={fieldClassName} aria-invalid={Boolean(errors.salary_text)} aria-describedby={errors.salary_text ? "salary_text-error" : undefined} {...register("salary_text")} />
            <FieldError id="salary_text-error" message={errors.salary_text?.message} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="text-sm font-semibold text-ink">
              Job description <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea id="description" rows={5} maxLength={5000} className={`${fieldClassName} resize-y leading-6`} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} {...register("description")} />
            <FieldError id="description-error" message={errors.description?.message} />
          </div>
        </div>
      </details>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-2 flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between md:static md:mx-0">
        <p className="px-1 text-xs leading-5 text-ink-muted">
          Adds this opportunity as {visibleStage?.label ?? "Saved"}. You can enrich it anytime.
        </p>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Adding…" : "Add application"}
        </Button>
      </div>
    </form>
  );
}
