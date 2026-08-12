import { z } from "zod";

export const APPLICATION_STATUSES = [
  "DRAFT",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
] as const;

export const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE"] as const;
export const APPLICATION_SOURCES = [
  "LINKEDIN",
  "INDEED",
  "COMPANY_WEBSITE",
  "RECRUITER",
  "REFERRAL",
  "HANDSHAKE",
  "CAREER_FAIR",
  "OTHER",
] as const;
export const INTERVIEW_TYPES = [
  "RECRUITER_CALL",
  "TECHNICAL_SCREEN",
  "BEHAVIORAL",
  "CODING_ASSESSMENT",
  "HIRING_MANAGER",
  "ONSITE",
  "FINAL",
  "OTHER",
] as const;
export const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELED"] as const;
export const DASHBOARD_RANGES = ["30d", "90d", "all"] as const;
export const COLOR_THEMES = ["SYSTEM", "LIGHT", "DARK"] as const;
export const APPLICATION_SORTS = ["updated_desc", "updated_asc"] as const;
export const APPLICATION_VIEWS = ["ACTIVE", "ALL", "ARCHIVED"] as const;

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const workModeSchema = z.enum(WORK_MODES);
export const applicationSourceSchema = z.enum(APPLICATION_SOURCES);
export const interviewTypeSchema = z.enum(INTERVIEW_TYPES);
export const interviewStatusSchema = z.enum(INTERVIEW_STATUSES);
export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES);
export const colorThemeSchema = z.enum(COLOR_THEMES);
export const applicationSortSchema = z.enum(APPLICATION_SORTS);
export const applicationViewSchema = z.enum(APPLICATION_VIEWS);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD).");
const timestampSchema = z.string().datetime({ offset: true });
const httpUrlSchema = z.string().url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "Expected an HTTP or HTTPS URL.");

export const userSchema = z.object({
  user_id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["STANDARD_USER", "ADMIN"]),
  created_at: timestampSchema,
  last_login_at: timestampSchema.nullable(),
});

export const applicationSchema = z.object({
  application_id: z.string().uuid(),
  owner_user_id: z.string().min(1),
  company_name: z.string(),
  job_title: z.string(),
  status: applicationStatusSchema,
  applied_date: dateOnlySchema.nullable(),
  follow_up_date: dateOnlySchema.nullable(),
  job_url: httpUrlSchema.nullable(),
  location: z.string().nullable(),
  work_mode: workModeSchema.nullable(),
  source: applicationSourceSchema.nullable(),
  source_detail: z.string().nullable(),
  salary_text: z.string().nullable(),
  description: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: z.number().int().positive(),
  allowed_transitions: z.array(applicationStatusSchema),
  submitted_at: timestampSchema.nullable(),
  stage_entered_at: timestampSchema.nullable(),
  first_response_at: timestampSchema.nullable(),
  first_screening_at: timestampSchema.nullable(),
  first_interview_at: timestampSchema.nullable(),
  first_offer_at: timestampSchema.nullable(),
  first_acceptance_at: timestampSchema.nullable(),
});

export const applicationListResponseSchema = z.object({
  items: z.array(applicationSchema),
  next_cursor: z.string().min(1).nullable(),
});

export const activitySchema = z.object({
  activity_id: z.string().uuid(),
  application_id: z.string().uuid(),
  activity_type: z.string().min(1),
  summary: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: timestampSchema,
});

export const activityListResponseSchema = z.object({
  items: z.array(activitySchema),
});

export const demoSessionSchema = z.object({
  access_token: z.string().min(20),
  token_type: z.literal("Bearer"),
  expires_at: timestampSchema,
});

export const noteSchema = z.object({
  note_id: z.string().uuid(),
  application_id: z.string().uuid(),
  content: z.string().min(1),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: z.number().int().positive(),
});

export const noteListResponseSchema = z.object({ items: z.array(noteSchema) });

export const interviewSchema = z.object({
  interview_id: z.string().uuid(),
  application_id: z.string().uuid(),
  company_name: z.string().min(1),
  job_title: z.string().min(1),
  interview_type: interviewTypeSchema,
  status: interviewStatusSchema,
  scheduled_at: timestampSchema,
  duration_minutes: z.number().int().min(15).max(480),
  location: z.string().nullable(),
  meeting_url: httpUrlSchema.nullable(),
  details: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: z.number().int().positive(),
  allowed_statuses: z.array(interviewStatusSchema),
});

export const interviewListResponseSchema = z.object({
  items: z.array(interviewSchema),
  next_cursor: z.string().min(1).nullable().optional(),
});

export const settingsSchema = z.object({
  time_zone: z.string().min(1),
  default_follow_up_days: z.number().int().min(1).max(30),
  default_application_view: z.enum(["ACTIVE", "ALL", "ARCHIVED"]),
  default_dashboard_range: dashboardRangeSchema,
  theme: colorThemeSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: z.number().int().positive(),
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type WorkMode = z.infer<typeof workModeSchema>;
export type ApplicationSource = z.infer<typeof applicationSourceSchema>;
export type InterviewType = z.infer<typeof interviewTypeSchema>;
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;
export type ColorTheme = z.infer<typeof colorThemeSchema>;
export type ApplicationSort = z.infer<typeof applicationSortSchema>;
export type ApplicationView = z.infer<typeof applicationViewSchema>;
export type User = z.infer<typeof userSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationListResponse = z.infer<
  typeof applicationListResponseSchema
>;
export type Activity = z.infer<typeof activitySchema>;
export type DemoSession = z.infer<typeof demoSessionSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Interview = z.infer<typeof interviewSchema>;
export type Settings = z.infer<typeof settingsSchema>;
