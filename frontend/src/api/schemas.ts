import { z } from "zod";

export const APPLICATION_STATUSES = [
  "DRAFT",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
] as const;

export const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE"] as const;

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const workModeSchema = z.enum(WORK_MODES);

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
  source: z.string().nullable(),
  salary_text: z.string().nullable(),
  description: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: z.number().int().positive(),
  allowed_transitions: z.array(applicationStatusSchema),
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

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type WorkMode = z.infer<typeof workModeSchema>;
export type User = z.infer<typeof userSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationListResponse = z.infer<
  typeof applicationListResponseSchema
>;
export type Activity = z.infer<typeof activitySchema>;
export type DemoSession = z.infer<typeof demoSessionSchema>;
