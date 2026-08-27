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
export const ROLE_FAMILIES = [
  "GENERAL",
  "SOFTWARE_IT",
  "CUSTOMER_SERVICE",
  "SALES",
  "MARKETING_COMMUNICATIONS",
  "FINANCE_ACCOUNTING",
  "HUMAN_RESOURCES",
  "ADMINISTRATIVE",
  "PROJECT_PROGRAM_MANAGEMENT",
  "OPERATIONS_LOGISTICS",
  "MANUFACTURING_SKILLED_TRADES",
  "HOSPITALITY_FOOD_SERVICE",
  "HEALTHCARE",
  "EDUCATION",
  "MANAGEMENT_LEADERSHIP",
  "EXECUTIVE",
] as const;
export const DASHBOARD_RANGES = ["30d", "90d", "all"] as const;
export const COLOR_THEMES = ["SYSTEM", "LIGHT", "DARK"] as const;
export const APPLICATION_SORTS = ["updated_desc", "updated_asc"] as const;
export const APPLICATION_VIEWS = ["ACTIVE", "ALL", "ARCHIVED"] as const;
export const STAGE_AGE_BUCKETS = ["0-7", "8-14", "15-30", "31+"] as const;
export const FOLLOW_UP_FILTERS = ["NEEDS_ATTENTION"] as const;
export const PIPELINE_FOLLOW_UP_STATES = ["NONE", "UPCOMING", "TODAY", "OVERDUE"] as const;

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const workModeSchema = z.enum(WORK_MODES);
export const applicationSourceSchema = z.enum(APPLICATION_SOURCES);
export const interviewTypeSchema = z.enum(INTERVIEW_TYPES);
export const interviewStatusSchema = z.enum(INTERVIEW_STATUSES);
export const roleFamilySchema = z.enum(ROLE_FAMILIES);
export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES);
export const colorThemeSchema = z.enum(COLOR_THEMES);
export const applicationSortSchema = z.enum(APPLICATION_SORTS);
export const applicationViewSchema = z.enum(APPLICATION_VIEWS);
export const stageAgeBucketSchema = z.enum(STAGE_AGE_BUCKETS);
export const followUpFilterSchema = z.enum(FOLLOW_UP_FILTERS);
export const pipelineFollowUpStateSchema = z.enum(PIPELINE_FOLLOW_UP_STATES);

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
  next_step_responsibility: z.enum(["CANDIDATE", "EMPLOYER", "NONE"]).nullable(),
  next_step_note: z.string().nullable(),
  job_url: httpUrlSchema.nullable(),
  location: z.string().nullable(),
  work_mode: workModeSchema.nullable(),
  source: applicationSourceSchema.nullable(),
  source_detail: z.string().nullable(),
  salary_text: z.string().nullable(),
  description: z.string().nullable(),
  role_family: roleFamilySchema.nullable(),
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

export const opportunityGroupSchema = z.enum([
  "needs_action",
  "moving_forward",
  "waiting",
]);
export const opportunityReasonSchema = z.enum([
  "MISSED_INTERVIEW",
  "FOLLOW_UP_OVERDUE",
  "FOLLOW_UP_DUE_TODAY",
  "INTERVIEW_PREPARATION_DUE",
  "OFFER_DECISION",
  "CANDIDATE_ACTION_UPCOMING",
  "INTERVIEW_PREPARATION_UPCOMING",
  "CANDIDATE_ACTION_UNSCHEDULED",
  "INTERVIEW_SCHEDULED",
  "PROCESS_PROGRESSING",
  "CANDIDATE_ACTION_PLANNED",
  "WAITING_FOR_EMPLOYER",
  "RECENTLY_APPLIED",
]);
export const opportunityActionSchema = z.enum([
  "RESOLVE_INTERVIEW",
  "REVIEW_FOLLOW_UP",
  "PREPARE_INTERVIEW",
  "REVIEW_OFFER",
  "OPEN_OPPORTUNITY",
]);
export const opportunityInterviewSchema = z.object({
  interview_id: z.string().uuid(),
  scheduled_at: timestampSchema,
  preparation_essentials_complete: z.boolean(),
});
export const opportunityClassificationSchema = z.object({
  group: opportunityGroupSchema,
  reason_code: opportunityReasonSchema,
  relevant_date: dateOnlySchema.nullable(),
  relevant_at: timestampSchema.nullable(),
  action_type: opportunityActionSchema,
  interview_id: z.string().uuid().nullable(),
  next_interview: opportunityInterviewSchema.nullable(),
});
export const opportunityWorkspaceItemSchema = z.object({
  application: applicationSchema,
  classification: opportunityClassificationSchema,
});
export const opportunityGroupResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  items: z.array(opportunityWorkspaceItemSchema),
  next_cursor: z.string().min(1).nullable(),
});
export const opportunityWorkspaceResponseSchema = z.object({
  generated_at: timestampSchema,
  groups: z.object({
    needs_action: opportunityGroupResponseSchema,
    moving_forward: opportunityGroupResponseSchema,
    waiting: opportunityGroupResponseSchema,
  }),
});

export const duplicateConfidenceSchema = z.enum(["HIGH", "MEDIUM"]);
export const duplicateSignalSchema = z.enum([
  "JOB_URL",
  "REQUISITION_ID",
  "COMPANY",
  "TITLE",
  "LOCATION",
]);
export const duplicateCandidateSchema = z.object({
  application_id: z.string().uuid(),
  company_name: z.string().min(1),
  job_title: z.string().min(1),
  status: applicationStatusSchema,
  applied_date: dateOnlySchema.nullable(),
  created_at: timestampSchema,
  confidence: duplicateConfidenceSchema,
  matched_on: z.array(duplicateSignalSchema),
});
export const duplicateCandidateListResponseSchema = z.object({
  candidates: z.array(duplicateCandidateSchema).max(3),
});

export const pipelineCardSchema = z.object({
  application: applicationSchema,
  stage_age_days: z.number().int().nonnegative().nullable(),
  follow_up_state: pipelineFollowUpStateSchema,
});

export const pipelineLaneSchema = z.object({
  status: applicationStatusSchema,
  count: z.number().int().nonnegative(),
  has_more: z.boolean(),
  cards: z.array(pipelineCardSchema),
});

export const pipelineResponseSchema = z.object({
  generated_at: timestampSchema,
  lanes: z.array(pipelineLaneSchema),
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
  next_cursor: z.string().min(1).nullable(),
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

export const noteListResponseSchema = z.object({
  items: z.array(noteSchema),
  next_cursor: z.string().min(1).nullable(),
});

const interviewChecklistItemSchema = z.object({
  item_id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  phase: z.enum(["UNDERSTAND", "PREPARE", "CONFIRM"]),
  source: z.enum(["UNIVERSAL", "INTERVIEW_TYPE", "ROLE_FAMILY", "CANDIDATE"]),
  source_label: z.string().min(1),
  category: z.enum(["ESSENTIAL", "ADDITIONAL", "CANDIDATE"]),
  outcome_id: z.enum([
    "OPPORTUNITY_UNDERSTANDING",
    "RELEVANT_EVIDENCE",
    "CONVERSATION_PLAN",
    "INTERVIEW_REQUIREMENTS",
  ]).nullable(),
  removable: z.boolean(),
  completed: z.boolean(),
});

const curatedTextSchema = z.object({
  text: z.string().min(1),
  source: z.enum(["UNIVERSAL", "INTERVIEW_TYPE", "ROLE_FAMILY"]),
  source_label: z.string().min(1),
});

const interviewGuidanceSchema = z.object({
  role_context: z.object({
    role_family: roleFamilySchema,
    role_family_label: z.string().min(1),
    source: z.enum(["USER_SELECTED", "TITLE_INFERRED", "UNIVERSAL_FALLBACK"]),
    explanation: z.string().min(1),
  }),
  checklist_items: z.array(interviewChecklistItemSchema),
  focus_prompts: z.array(curatedTextSchema).max(4),
  suggested_questions: z.array(curatedTextSchema).max(6),
  tips: z.array(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      source: z.enum(["UNIVERSAL", "INTERVIEW_TYPE", "ROLE_FAMILY"]),
      source_label: z.string().min(1),
    }),
  ).max(3),
  essential_outcomes: z.array(z.object({
    outcome_id: z.enum([
      "OPPORTUNITY_UNDERSTANDING",
      "RELEVANT_EVIDENCE",
      "CONVERSATION_PLAN",
      "INTERVIEW_REQUIREMENTS",
    ]),
    label: z.string().min(1),
    description: z.string().min(1),
    completed: z.boolean(),
    action_item_id: z.string().min(1),
  })),
  progress: z.object({
    essentials: z.object({
      completed: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      complete: z.boolean(),
      remaining_actions: z.array(z.string().min(1)),
    }),
    additional: z.object({
      completed: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    candidate: z.object({
      completed: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  }),
});

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
  preparation_notes: z.string().nullable(),
  completed_checklist_items: z.array(z.string().min(1)),
  candidate_questions: z.array(z.string().min(1)),
  custom_preparation_items: z.array(interviewChecklistItemSchema).max(2),
  debrief_went_well: z.string().nullable(),
  debrief_improve: z.string().nullable(),
  debrief_signals: z.string().nullable(),
  debrief_next_step: z.string().nullable(),
  debrief_primary_reflection: z.string().nullable(),
  debrief_carry_forward: z.string().nullable(),
  debrief_completed_at: timestampSchema.nullable(),
  guidance: interviewGuidanceSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: z.number().int().positive(),
  allowed_statuses: z.array(interviewStatusSchema),
});

export const interviewListResponseSchema = z.object({
  items: z.array(interviewSchema),
  next_cursor: z.string().min(1).nullable(),
});

export const notePreviewResponseSchema = z.object({
  items: z.array(noteSchema),
  total_count: z.number().int().nonnegative(),
});

const interviewWorkspaceContextSchema = z.object({
  application_status: applicationStatusSchema,
  follow_up_date: dateOnlySchema.nullable(),
  follow_up_state: z.enum(["NONE", "UPCOMING", "TODAY", "OVERDUE"]),
  workflow_state: z.enum([
    "PREPARE",
    "UPCOMING",
    "IMMINENT",
    "MISSED",
    "CAPTURE",
    "FOLLOW_UP",
    "HISTORY",
    "CANCELED",
  ]),
  next_action: z.enum([
    "PREPARE",
    "JOIN_MEETING",
    "MARK_COMPLETE",
    "CAPTURE_NOTES",
    "REVIEW_FOLLOW_UP",
    "REVIEW_DEBRIEF",
    "OPEN_APPLICATION",
  ]),
  next_step_responsibility: z.enum(["CANDIDATE", "EMPLOYER", "NONE"]).nullable(),
  next_step_note: z.string().nullable(),
  has_later_scheduled_interview: z.boolean(),
});

export const workspaceInterviewSchema = interviewSchema.extend({
  context: interviewWorkspaceContextSchema,
});

export const workspaceInterviewListResponseSchema = z.object({
  items: z.array(workspaceInterviewSchema),
  next_cursor: z.string().min(1).nullable(),
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

export const workspaceExportSchema = z.object({
  export_version: z.literal(1),
  exported_at: timestampSchema,
  profile: userSchema,
  settings: settingsSchema,
  applications: z.array(applicationSchema),
  activities: z.array(activitySchema),
  notes: z.array(noteSchema),
  interviews: z.array(interviewSchema),
  counts: z.object({
    applications: z.number().int().nonnegative(),
    activities: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    interviews: z.number().int().nonnegative(),
  }),
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type WorkMode = z.infer<typeof workModeSchema>;
export type ApplicationSource = z.infer<typeof applicationSourceSchema>;
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;
export type RoleFamily = z.infer<typeof roleFamilySchema>;
export type InterviewType = z.infer<typeof interviewTypeSchema>;
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;
export type ColorTheme = z.infer<typeof colorThemeSchema>;
export type ApplicationSort = z.infer<typeof applicationSortSchema>;
export type ApplicationView = z.infer<typeof applicationViewSchema>;
export type StageAgeBucket = z.infer<typeof stageAgeBucketSchema>;
export type FollowUpFilter = z.infer<typeof followUpFilterSchema>;
export type User = z.infer<typeof userSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type NextStepResponsibility = Application["next_step_responsibility"];
export type PipelineCard = z.infer<typeof pipelineCardSchema>;
export type PipelineLane = z.infer<typeof pipelineLaneSchema>;
export type Pipeline = z.infer<typeof pipelineResponseSchema>;
export type ApplicationListResponse = z.infer<
  typeof applicationListResponseSchema
>;
export type Activity = z.infer<typeof activitySchema>;
export type DemoSession = z.infer<typeof demoSessionSchema>;
export type Note = z.infer<typeof noteSchema>;
export type NotePreview = z.infer<typeof notePreviewResponseSchema>;
export type Interview = z.infer<typeof interviewSchema>;
export type WorkspaceInterview = z.infer<typeof workspaceInterviewSchema>;
export type InterviewWorkspace = Pick<
  Interview,
  | "completed_checklist_items"
  | "preparation_notes"
  | "candidate_questions"
  | "debrief_went_well"
  | "debrief_improve"
  | "debrief_signals"
  | "debrief_next_step"
  | "debrief_primary_reflection"
  | "debrief_carry_forward"
>;
export type OpportunityGroup = z.infer<typeof opportunityGroupSchema>;
export type OpportunityReason = z.infer<typeof opportunityReasonSchema>;
export type OpportunityAction = z.infer<typeof opportunityActionSchema>;
export type OpportunityWorkspaceItem = z.infer<typeof opportunityWorkspaceItemSchema>;
export type OpportunityGroupResponse = z.infer<typeof opportunityGroupResponseSchema>;
export type OpportunityWorkspace = z.infer<typeof opportunityWorkspaceResponseSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type WorkspaceExport = z.infer<typeof workspaceExportSchema>;
