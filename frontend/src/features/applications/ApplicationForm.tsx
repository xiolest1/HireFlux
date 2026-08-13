import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useBlocker } from "react-router-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { APPLICATION_SOURCES, type Application } from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { ErrorPanel } from "../../components/ui/Feedback";
import { useModalFocus } from "../../components/ui/useModalFocus";
import {
  applicationFormDefaults,
  applicationFormSchema,
  type ApplicationFormDefaultPreferences,
  type ApplicationFormInput,
  type ApplicationFormValues,
} from "./formSchema";
import { formatSource } from "./format";

const fieldClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-ink shadow-sm transition-colors placeholder:text-ink-muted hover:border-accent/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-muted";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

interface ApplicationFormProps {
  mode: "create" | "edit";
  application?: Application;
  defaultPreferences?: ApplicationFormDefaultPreferences;
  isSubmitting: boolean;
  serverError?: unknown;
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>;
}

export function ApplicationForm({
  mode,
  application,
  defaultPreferences,
  isSubmitting,
  serverError,
  onSubmit,
}: ApplicationFormProps) {
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const unsavedDialogRef = useRef<HTMLElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const allowNavigationRef = useRef(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(
    () =>
      mode === "edit" &&
      Boolean(
        application?.job_url ||
          application?.location ||
          application?.work_mode ||
          application?.source ||
          application?.source_detail ||
          application?.salary_text ||
          application?.description,
      ),
  );
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<ApplicationFormInput, unknown, ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema(mode)),
    defaultValues: applicationFormDefaults(application, defaultPreferences),
  });
  const selectedStatus = watch("status");
  const hasErrors = Object.keys(errors).length > 0;
  const hasOptionalErrors = Boolean(
    errors.job_url ||
      errors.location ||
      errors.work_mode ||
      errors.source ||
      errors.source_detail ||
      errors.salary_text ||
      errors.description,
  );
  const errorSummaryItems = [
    ["company_name", "Company name", errors.company_name?.message],
    ["job_title", "Job title", errors.job_title?.message],
    ["status", "Starting status", errors.status?.message],
    ["applied_date", "Applied date", errors.applied_date?.message],
    ["follow_up_date", "Follow-up date", errors.follow_up_date?.message],
    ["job_url", "Job URL", errors.job_url?.message],
    ["location", "Location", errors.location?.message],
    ["work_mode", "Work mode", errors.work_mode?.message],
    ["source", "Source", errors.source?.message],
    ["source_detail", "Source detail", errors.source_detail?.message],
    ["salary_text", "Salary", errors.salary_text?.message],
    ["description", "Description", errors.description?.message],
  ].filter((item): item is [string, string, string] => typeof item[2] === "string");
  const blocker = useBlocker(
    () => isDirty && !isSubmitting && !allowNavigationRef.current,
  );

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

  useEffect(() => {
    if (hasOptionalErrors) setOptionalDetailsOpen(true);
  }, [hasOptionalErrors]);

  async function submit(values: ApplicationFormValues) {
    allowNavigationRef.current = true;
    setAllowNavigation(true);
    try {
      await onSubmit(values);
    } finally {
      allowNavigationRef.current = false;
      setAllowNavigation(false);
    }
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={handleSubmit(submit, () => {
        window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      })}
    >
      {blocker.state === "blocked" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            ref={unsavedDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
            aria-describedby="unsaved-description"
          className="w-full max-w-md rounded-2xl border border-line bg-surface-raised p-6 shadow-2xl"
          >
            <h2 id="unsaved-title" className="text-xl font-bold text-ink">
              Leave without saving?
            </h2>
            <p id="unsaved-description" className="mt-3 text-sm leading-6 text-ink-muted">
              Your changes on this form will be lost.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                ref={keepEditingButtonRef}
                variant="secondary"
                onClick={keepEditing}
              >
                Keep editing
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()}>
                Leave page
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      {hasErrors ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          <p className="font-semibold">Review the highlighted fields.</p>
          <ul className="mt-2 space-y-1">
            {errorSummaryItems.map(([field, label, message]) => (
              <li key={field}>
                <a className="font-medium underline underline-offset-2" href={`#${field}`}>
                  {label}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {serverError ? <ErrorPanel error={serverError} compact /> : null}

      <fieldset className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-6">
        <legend className="px-1 text-base font-semibold text-ink">
          Opportunity
        </legend>
        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="company_name" className="text-sm font-semibold text-ink">
              Company name <span className="text-danger">*</span>
            </label>
            <input
              id="company_name"
              autoComplete="organization"
              required
              maxLength={120}
              aria-invalid={Boolean(errors.company_name)}
              aria-describedby={errors.company_name ? "company_name-error" : undefined}
              className={fieldClassName}
              {...register("company_name")}
            />
            <FieldError
              id="company_name-error"
              message={errors.company_name?.message}
            />
          </div>

          <div>
            <label htmlFor="job_title" className="text-sm font-semibold text-ink">
              Job title <span className="text-danger">*</span>
            </label>
            <input
              id="job_title"
              autoComplete="organization-title"
              required
              maxLength={120}
              aria-invalid={Boolean(errors.job_title)}
              aria-describedby={errors.job_title ? "job_title-error" : undefined}
              className={fieldClassName}
              {...register("job_title")}
            />
            <FieldError id="job_title-error" message={errors.job_title?.message} />
          </div>

          {mode === "create" ? (
            <div>
              <label htmlFor="status" className="text-sm font-semibold text-ink">
                Starting status
              </label>
              <select
                id="status"
                aria-invalid={Boolean(errors.status)}
                aria-describedby="status-hint"
                className={fieldClassName}
                {...register("status")}
              >
                <option value="DRAFT">Draft</option>
                <option value="APPLIED">Applied</option>
              </select>
              <p id="status-hint" className="mt-1.5 text-xs leading-5 text-ink-muted">
                Further status changes happen from the application page.
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="applied_date" className="text-sm font-semibold text-ink">
              Applied date{mode === "create" && selectedStatus === "APPLIED" ? (
                <span className="text-danger"> *</span>
              ) : null}
            </label>
            <input
              id="applied_date"
              type="date"
              required={mode === "create" && selectedStatus === "APPLIED"}
              aria-invalid={Boolean(errors.applied_date)}
              aria-describedby={errors.applied_date ? "applied_date-error" : undefined}
              className={fieldClassName}
              {...register("applied_date")}
            />
            <FieldError
              id="applied_date-error"
              message={errors.applied_date?.message}
            />
          </div>

          <div>
            <label htmlFor="follow_up_date" className="text-sm font-semibold text-ink">
              Follow-up date <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="follow_up_date"
              type="date"
              aria-invalid={Boolean(errors.follow_up_date)}
              aria-describedby={errors.follow_up_date ? "follow_up_date-error" : undefined}
              className={fieldClassName}
              {...register("follow_up_date")}
            />
            <FieldError
              id="follow_up_date-error"
              message={errors.follow_up_date?.message}
            />
          </div>
        </div>
      </fieldset>

      <details
        open={optionalDetailsOpen}
        onToggle={(event) => setOptionalDetailsOpen(event.currentTarget.open)}
        className="group rounded-2xl border border-line bg-surface shadow-panel"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left marker:hidden sm:px-6">
          <span>
            <span className="flex items-center gap-2 text-base font-semibold text-ink">
              <Sparkles aria-hidden="true" className="size-4 text-violet" />
              Optional details
            </span>
            <span className="mt-1 block text-sm text-ink-muted">
              Add the posting, source, location, salary, and role context.
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div
          className="grid gap-5 border-t border-line px-5 pb-5 pt-5 sm:grid-cols-2 sm:px-6 sm:pb-6"
          role="group"
          aria-label="Optional application details"
        >
          <div className="sm:col-span-2">
            <label htmlFor="job_url" className="text-sm font-semibold text-ink">
              Job URL <span className="font-normal text-ink-muted">(optional)</span>
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
              Include the full http:// or https:// address.
            </p>
            <FieldError id="job_url-error" message={errors.job_url?.message} />
          </div>

          <div>
            <label htmlFor="location" className="text-sm font-semibold text-ink">
              Location <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="location"
              autoComplete="address-level2"
              maxLength={160}
              aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? "location-error" : undefined}
              className={fieldClassName}
              {...register("location")}
            />
            <FieldError id="location-error" message={errors.location?.message} />
          </div>

          <div>
            <label htmlFor="work_mode" className="text-sm font-semibold text-ink">
              Work mode <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <select
              id="work_mode"
              aria-invalid={Boolean(errors.work_mode)}
              className={fieldClassName}
              {...register("work_mode")}
            >
              <option value="">Not specified</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
            </select>
          </div>

          <div>
            <label htmlFor="source" className="text-sm font-semibold text-ink">
              Source <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <select
              id="source"
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errors.source ? "source-error" : undefined}
              className={fieldClassName}
              {...register("source")}
            >
              <option value="">Not specified</option>
              {APPLICATION_SOURCES.map((source) => (
                <option key={source} value={source}>{formatSource(source)}</option>
              ))}
            </select>
            <FieldError id="source-error" message={errors.source?.message} />
          </div>

          <div>
            <label htmlFor="source_detail" className="text-sm font-semibold text-ink">
              Source detail <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="source_detail"
              placeholder="Recruiter name, event, or job board detail"
              maxLength={120}
              aria-invalid={Boolean(errors.source_detail)}
              aria-describedby={errors.source_detail ? "source_detail-error" : undefined}
              className={fieldClassName}
              {...register("source_detail")}
            />
            <FieldError id="source_detail-error" message={errors.source_detail?.message} />
          </div>

          <div>
            <label htmlFor="salary_text" className="text-sm font-semibold text-ink">
              Salary <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="salary_text"
              placeholder="$120k–$145k, equity"
              maxLength={120}
              aria-invalid={Boolean(errors.salary_text)}
              aria-describedby={errors.salary_text ? "salary_text-error" : undefined}
              className={fieldClassName}
              {...register("salary_text")}
            />
            <FieldError
              id="salary_text-error"
              message={errors.salary_text?.message}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="text-sm font-semibold text-ink">
              Description <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={6}
              maxLength={5000}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "description-error" : "description-hint"}
              className={`${fieldClassName} resize-y leading-6`}
              {...register("description")}
            />
            <p id="description-hint" className="mt-1.5 text-xs text-ink-muted">
              Capture the role summary or details you want handy later.
            </p>
            <FieldError
              id="description-error"
              message={errors.description?.message}
            />
          </div>
        </div>
      </details>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-2 flex flex-col-reverse gap-3 rounded-2xl border border-line bg-surface-raised/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end lg:bottom-4">
        <Link
          to={
            mode === "edit" && application
              ? `/applications/${application.application_id}`
              : "/applications"
          }
          className={buttonClassName("secondary")}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create application"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
