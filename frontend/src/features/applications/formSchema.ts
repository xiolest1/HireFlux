import { z } from "zod";
import type {
  ApplicationFields,
  CreateApplicationRequest,
} from "../../api/applications";
import {
  applicationStatusSchema,
  applicationSourceSchema,
  roleFamilySchema,
  workModeSchema,
  type Application,
} from "../../api/schemas";

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function optionalText(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
    .transform((value) => value || null);
}

const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || isValidDateOnly(value),
      `${label} must be a valid date.`,
    )
    .transform((value) => value || null);

export function currentDateInTimeZone(
  timeZone = "UTC",
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const optionalUrl = z
  .string()
  .trim()
  .max(2048, "Job URL must be 2,048 characters or fewer.")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a complete http:// or https:// URL.")
  .transform((value) => value || null);

const applicationFormSchemaBase = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, "Company name is required.")
    .max(120, "Company name must be 120 characters or fewer."),
  job_title: z
    .string()
    .trim()
    .min(1, "Job title is required.")
    .max(120, "Job title must be 120 characters or fewer."),
  status: applicationStatusSchema,
  applied_date: optionalDate("Applied date"),
  follow_up_date: optionalDate("Follow-up date"),
  job_url: optionalUrl,
  location: optionalText("Location", 160),
  work_mode: z
    .union([workModeSchema, z.literal("")])
    .transform((value) => value || null),
  source: z.union([applicationSourceSchema, z.literal("")]).transform((value) => value || null),
  source_detail: optionalText("Source detail", 120),
  salary_text: optionalText("Salary", 120),
  description: optionalText("Description", 5000),
  role_family: z
    .union([roleFamilySchema, z.literal("")])
    .default("")
    .transform((value) => value || null),
});

export type ApplicationFormInput = z.input<
  typeof applicationFormSchemaBase
>;
export type ApplicationFormValues = z.output<
  typeof applicationFormSchemaBase
>;

export interface ApplicationFormDefaultPreferences {
  defaultFollowUpDays: number;
  timeZone: string;
  now?: Date;
}

export function preferredFollowUpDate({
  defaultFollowUpDays,
  timeZone,
  now = new Date(),
}: ApplicationFormDefaultPreferences): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  const preferred = new Date(
    Date.UTC(value("year"), value("month") - 1, value("day") + defaultFollowUpDays),
  );
  return preferred.toISOString().slice(0, 10);
}

export function applicationFormSchema(
  mode: "create" | "edit",
  today = currentDateInTimeZone(),
) {
  return applicationFormSchemaBase.superRefine((values, context) => {
    if (values.applied_date && values.applied_date > today) {
      context.addIssue({
        code: "custom",
        path: ["applied_date"],
        message: "Applied date cannot be in the future.",
      });
    }
    if (
      mode === "create" &&
      values.status === "APPLIED" &&
      !values.applied_date
    ) {
      context.addIssue({
        code: "custom",
        path: ["applied_date"],
        message: "Applied date is required for an applied application.",
      });
    }
  });
}

export function applicationFormDefaults(
  application?: Application,
  preferences?: ApplicationFormDefaultPreferences,
): ApplicationFormInput {
  return {
    company_name: application?.company_name ?? "",
    job_title: application?.job_title ?? "",
    status: application?.status ?? "DRAFT",
    applied_date: application?.applied_date ?? "",
    follow_up_date:
      application?.follow_up_date ??
      (application ? "" : preferences ? preferredFollowUpDate(preferences) : ""),
    job_url: application?.job_url ?? "",
    location: application?.location ?? "",
    work_mode: application?.work_mode ?? "",
    source: application?.source ?? "",
    source_detail: application?.source_detail ?? "",
    salary_text: application?.salary_text ?? "",
    description: application?.description ?? "",
    role_family: application?.role_family ?? "",
  };
}

export function toApplicationFields(
  values: ApplicationFormValues,
): ApplicationFields {
  return {
    company_name: values.company_name,
    job_title: values.job_title,
    applied_date: values.applied_date,
    follow_up_date: values.follow_up_date,
    job_url: values.job_url,
    location: values.location,
    work_mode: values.work_mode,
    source: values.source,
    source_detail: values.source_detail,
    salary_text: values.salary_text,
    description: values.description,
    role_family: values.role_family,
  };
}

export function toCreateApplicationRequest(
  values: ApplicationFormValues,
): CreateApplicationRequest {
  if (values.status !== "DRAFT" && values.status !== "APPLIED") {
    throw new Error("New applications must begin as DRAFT or APPLIED.");
  }
  return { ...toApplicationFields(values), status: values.status };
}
