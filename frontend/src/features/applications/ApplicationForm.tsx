import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import type { Application } from "../../api/schemas";
import { Button } from "../../components/ui/Button";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { ErrorPanel } from "../../components/ui/Feedback";
import {
  applicationFormDefaults,
  applicationFormSchema,
  type ApplicationFormInput,
  type ApplicationFormValues,
} from "./formSchema";

const fieldClassName =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-rose-700">
      {message}
    </p>
  );
}

interface ApplicationFormProps {
  mode: "create" | "edit";
  application?: Application;
  isSubmitting: boolean;
  serverError?: unknown;
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>;
}

export function ApplicationForm({
  mode,
  application,
  isSubmitting,
  serverError,
  onSubmit,
}: ApplicationFormProps) {
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ApplicationFormInput, unknown, ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema(mode)),
    defaultValues: applicationFormDefaults(application),
  });
  const selectedStatus = watch("status");
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={handleSubmit(onSubmit, () => {
        window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      })}
    >
      {hasErrors ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950"
        >
          <p className="font-semibold">Review the highlighted fields.</p>
          <p className="mt-1 text-rose-900">
            Your changes have not been submitted yet.
          </p>
        </div>
      ) : null}

      {serverError ? <ErrorPanel error={serverError} compact /> : null}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <legend className="px-1 text-base font-semibold text-slate-950">
          Opportunity
        </legend>
        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="company_name" className="text-sm font-semibold text-slate-800">
              Company name <span className="text-rose-700">*</span>
            </label>
            <input
              id="company_name"
              autoComplete="organization"
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
            <label htmlFor="job_title" className="text-sm font-semibold text-slate-800">
              Job title <span className="text-rose-700">*</span>
            </label>
            <input
              id="job_title"
              autoComplete="organization-title"
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
              <label htmlFor="status" className="text-sm font-semibold text-slate-800">
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
              <p id="status-hint" className="mt-1.5 text-xs leading-5 text-slate-500">
                Further status changes happen from the application page.
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="applied_date" className="text-sm font-semibold text-slate-800">
              Applied date{mode === "create" && selectedStatus === "APPLIED" ? (
                <span className="text-rose-700"> *</span>
              ) : null}
            </label>
            <input
              id="applied_date"
              type="date"
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
            <label htmlFor="follow_up_date" className="text-sm font-semibold text-slate-800">
              Follow-up date <span className="font-normal text-slate-500">(optional)</span>
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

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <legend className="px-1 text-base font-semibold text-slate-950">
          Details
        </legend>
        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="job_url" className="text-sm font-semibold text-slate-800">
              Job URL <span className="font-normal text-slate-500">(optional)</span>
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
            <p id="job_url-hint" className="mt-1.5 text-xs text-slate-500">
              Include the full http:// or https:// address.
            </p>
            <FieldError id="job_url-error" message={errors.job_url?.message} />
          </div>

          <div>
            <label htmlFor="location" className="text-sm font-semibold text-slate-800">
              Location <span className="font-normal text-slate-500">(optional)</span>
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
            <label htmlFor="work_mode" className="text-sm font-semibold text-slate-800">
              Work mode <span className="font-normal text-slate-500">(optional)</span>
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
            <label htmlFor="source" className="text-sm font-semibold text-slate-800">
              Source <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="source"
              placeholder="Company site, referral, job board…"
              maxLength={120}
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errors.source ? "source-error" : undefined}
              className={fieldClassName}
              {...register("source")}
            />
            <FieldError id="source-error" message={errors.source?.message} />
          </div>

          <div>
            <label htmlFor="salary_text" className="text-sm font-semibold text-slate-800">
              Salary <span className="font-normal text-slate-500">(optional)</span>
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
            <label htmlFor="description" className="text-sm font-semibold text-slate-800">
              Description <span className="font-normal text-slate-500">(optional)</span>
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
            <p id="description-hint" className="mt-1.5 text-xs text-slate-500">
              Capture the role summary or details you want handy later.
            </p>
            <FieldError
              id="description-error"
              message={errors.description?.message}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
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
