import { z } from "zod";
import { apiRequest } from "./client";
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  WORK_MODES,
  applicationSchema,
  applicationSourceSchema,
  applicationStatusSchema,
  dashboardRangeSchema,
  interviewSchema,
  stageAgeBucketSchema,
  workModeSchema,
  type ApplicationSource,
  type ApplicationStatus,
  type DashboardRange,
  type WorkMode,
} from "./schemas";

const timestampSchema = z.string().datetime({ offset: true });
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const summarySchema = z.object({
  total_tracked: z.number().int().nonnegative(),
  active_pursuits: z.number().int().nonnegative(),
  drafts: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  withdrawn: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
});

const ratesSchema = z.object({
  submitted_count: z.number().int().nonnegative(),
  response_count: z.number().int().nonnegative(),
  response_rate: z.number().min(0).max(1),
  interview_count: z.number().int().nonnegative(),
  interview_rate: z.number().min(0).max(1),
  offer_count: z.number().int().nonnegative(),
  offer_rate: z.number().min(0).max(1),
  acceptance_count: z.number().int().nonnegative(),
  acceptance_rate: z.number().min(0).max(1),
});

const statusCountSchema = z.object({
  status: applicationStatusSchema,
  count: z.number().int().nonnegative(),
});

const trendPointSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative(),
});

export const dashboardSchema = z.object({
  range: dashboardRangeSchema,
  generated_at: timestampSchema,
  summary: summarySchema,
  rates: ratesSchema,
  actions: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.enum(["FOLLOW_UP_OVERDUE", "FOLLOW_UP_TODAY"]),
        application_id: z.string().uuid(),
        company_name: z.string().min(1),
        job_title: z.string().min(1),
        due_date: dateOnlySchema,
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
        label: z.string().min(1),
      }),
      z.object({
        kind: z.enum(["STALE_APPLICATION", "INTERVIEW_SOON"]),
        application_id: z.string().uuid(),
        company_name: z.string().min(1),
        job_title: z.string().min(1),
        due_at: timestampSchema,
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
        label: z.string().min(1),
      }),
    ]),
  ),
  upcoming_interviews: z.array(interviewSchema),
  recent_applications: z.array(applicationSchema),
  submission_trend: z.array(trendPointSchema),
  status_breakdown: z.array(statusCountSchema),
});

export const analyticsSchema = z.object({
  range: dashboardRangeSchema,
  filters: z.object({
    status: applicationStatusSchema.nullable().optional(),
    source: applicationSourceSchema.nullable().optional(),
    work_mode: workModeSchema.nullable().optional(),
  }),
  generated_at: timestampSchema,
  summary: summarySchema,
  rates: ratesSchema,
  status_breakdown: z.array(statusCountSchema),
  submission_trend: z.array(trendPointSchema),
  funnel: z.array(
    z.object({
      stage: z.string().min(1),
      count: z.number().int().nonnegative(),
      rate: z.number().min(0).max(1),
    }),
  ),
  stage_aging: z.array(
    z.object({ bucket: stageAgeBucketSchema, count: z.number().int().nonnegative() }),
  ),
  source_performance: z.array(
    z.object({
      source: applicationSourceSchema,
      submitted_count: z.number().int().nonnegative(),
      response_count: z.number().int().nonnegative(),
      response_rate: z.number().min(0).max(1),
      interview_count: z.number().int().nonnegative(),
      interview_rate: z.number().min(0).max(1),
      offer_count: z.number().int().nonnegative(),
      offer_rate: z.number().min(0).max(1),
      sample_sufficient: z.boolean(),
      application_share: z.number().min(0).max(1),
      response_rate_delta_vs_overall: z.number().min(-1).max(1),
      interview_rate_delta_vs_overall: z.number().min(-1).max(1),
      recent: z.object({
        submitted_count: z.number().int().nonnegative(),
        response_count: z.number().int().nonnegative(),
        response_rate: z.number().min(0).max(1),
        interview_count: z.number().int().nonnegative(),
        interview_rate: z.number().min(0).max(1),
        offer_count: z.number().int().nonnegative(),
        offer_rate: z.number().min(0).max(1),
        previous_submitted_count: z.number().int().nonnegative(),
        previous_response_rate: z.number().min(0).max(1),
        previous_interview_rate: z.number().min(0).max(1),
        response_rate_delta: z.number().min(-1).max(1).nullable(),
        interview_rate_delta: z.number().min(-1).max(1).nullable(),
      }),
      recent_sample_sufficient: z.boolean(),
      signal: z.enum([
        "STRONG_PERFORMER",
        "HIGH_VOLUME_LOW_RESPONSE",
        "PROMISING_EARLY",
        "CONCENTRATED_MIX",
        "LIMITED_DATA",
      ]).nullable(),
      guidance: z.string().min(1).nullable(),
    }),
  ),
  source_period: z.object({
    label: z.enum(["Selected range", "Last 30 days"]),
    current_start: dateOnlySchema,
    current_end: dateOnlySchema,
    previous_start: dateOnlySchema,
    previous_end: dateOnlySchema,
  }),
  source_summary: z.object({
    submitted_count: z.number().int().nonnegative(),
    sufficient_for_strategy: z.boolean(),
    top_volume: z.object({
      source: applicationSourceSchema,
      submitted_count: z.number().int().nonnegative(),
      application_share: z.number().min(0).max(1),
      response_rate: z.number().min(0).max(1),
      response_rate_delta_vs_overall: z.number().min(-1).max(1),
    }).nullable(),
    strongest_response: z.object({
      source: applicationSourceSchema,
      submitted_count: z.number().int().nonnegative(),
      application_share: z.number().min(0).max(1),
      response_rate: z.number().min(0).max(1),
      response_rate_delta_vs_overall: z.number().min(-1).max(1),
    }).nullable(),
    recent_movement: z.object({
      source: applicationSourceSchema,
      submitted_count: z.number().int().nonnegative(),
      response_rate: z.number().min(0).max(1),
      response_rate_delta: z.number().min(-1).max(1),
      direction: z.enum(["IMPROVING", "DECLINING", "STABLE"]),
    }).nullable(),
    concentration: z.object({
      flagged: z.boolean(),
      source: applicationSourceSchema.nullable(),
      application_share: z.number().min(0).max(1),
      threshold: z.number().min(0).max(1),
      submitted_count: z.number().int().nonnegative(),
    }),
  }),
  work_mode_breakdown: z.array(
    z.object({ work_mode: workModeSchema, count: z.number().int().nonnegative() }),
  ),
  average_days_to_first_response: z.number().nonnegative().nullable(),
  no_response_count: z.number().int().nonnegative(),
  period_comparison: z.object({
    available: z.boolean(),
    current_start: dateOnlySchema.nullable(),
    current_end: dateOnlySchema.nullable(),
    previous_start: dateOnlySchema.nullable(),
    previous_end: dateOnlySchema.nullable(),
    current: z
      .object({
        submitted_count: z.number().int().nonnegative(),
        response_rate: z.number().min(0).max(1),
        interview_rate: z.number().min(0).max(1),
        offer_rate: z.number().min(0).max(1),
        acceptance_rate: z.number().min(0).max(1),
        average_days_to_first_response: z.number().nonnegative().nullable(),
      })
      .nullable(),
    previous: z
      .object({
        submitted_count: z.number().int().nonnegative(),
        response_rate: z.number().min(0).max(1),
        interview_rate: z.number().min(0).max(1),
        offer_rate: z.number().min(0).max(1),
        acceptance_rate: z.number().min(0).max(1),
        average_days_to_first_response: z.number().nonnegative().nullable(),
      })
      .nullable(),
    deltas: z
      .object({
        submitted_count: z.number().int(),
        response_rate: z.number().min(-1).max(1),
        interview_rate: z.number().min(-1).max(1),
        offer_rate: z.number().min(-1).max(1),
        acceptance_rate: z.number().min(-1).max(1),
        average_days_to_first_response: z.number().nullable(),
      })
      .nullable(),
  }),
  follow_up_coverage: z.object({
    active_count: z.number().int().nonnegative(),
    scheduled_count: z.number().int().nonnegative(),
    coverage_rate: z.number().min(0).max(1),
    overdue_count: z.number().int().nonnegative(),
    due_today_count: z.number().int().nonnegative(),
    missing_count: z.number().int().nonnegative(),
  }),
  progress_narrative: z.object({
    state: z.enum(["READY", "LIMITED", "EMPTY", "ALL_TIME"]),
    tone: z.enum(["POSITIVE", "NEUTRAL", "WATCH", "ACTION_NEEDED"]),
    headline: z.string().min(1),
    explanation: z.string().min(1),
    primary_signal: z.object({
      code: z.enum([
        "VOLUME_UP_INTERVIEW_DOWN",
        "MOMENTUM_WITH_INTERVIEWS",
        "SEARCH_CONVERTING",
        "INTERVIEW_DECLINING",
        "INTERVIEW_IMPROVING",
        "VOLUME_UP_RESPONSE_DOWN",
        "RESPONSE_DECLINING",
        "RESPONSE_IMPROVING",
        "MOMENTUM_DOWN",
        "MOMENTUM_UP",
      ]),
      category: z.enum(["PERFORMANCE", "ACTIVITY"]),
      direction: z.enum(["IMPROVING", "DECLINING", "MIXED", "STABLE"]),
      priority: z.number().int().min(0).max(100),
      evidence_metric_keys: z.array(
        z.enum(["SUBMISSIONS", "RESPONSE_RATE", "INTERVIEW_RATE"]),
      ),
      evidence_summary: z.string().min(1),
      sample_label: z.string().min(1).nullable(),
    }).nullable(),
    supporting_signals: z.array(z.object({
      metric_key: z.enum(["SUBMISSIONS", "RESPONSE_RATE", "INTERVIEW_RATE"]),
      category: z.enum(["PERFORMANCE", "ACTIVITY"]),
      direction: z.enum(["IMPROVING", "DECLINING", "STABLE", "NOT_AVAILABLE"]),
      emphasis: z.enum(["PRIMARY", "CONTEXT"]),
    })),
    process_health: z.object({
      tone: z.enum(["POSITIVE", "NEUTRAL", "WATCH", "ACTION_NEEDED"]),
      summary: z.string().min(1),
      active_count: z.number().int().nonnegative(),
      scheduled_count: z.number().int().nonnegative(),
      coverage_rate: z.number().min(0).max(1),
      overdue_count: z.number().int().nonnegative(),
      due_today_count: z.number().int().nonnegative(),
      missing_count: z.number().int().nonnegative(),
    }),
    recommended_focus: z.object({
      title: z.string().min(1),
      explanation: z.string().min(1),
      tone: z.enum(["POSITIVE", "NEUTRAL", "WATCH", "ACTION_NEEDED"]),
      action: z.object({
        kind: z.enum(["VIEW_APPLICATIONS", "ADD_APPLICATION"]),
        label: z.string().min(1),
        parameters: z.record(z.string(), z.string()),
      }),
    }).nullable(),
  }),
  insights: z.array(
    z.object({
      code: z.enum([
        "BUILD_SAMPLE",
        "FOLLOW_UP_ATTENTION",
        "STALLED_PIPELINE",
        "MOMENTUM_WITH_INTERVIEWS",
        "VOLUME_UP_INTERVIEW_DOWN",
        "VOLUME_UP_RESPONSE_DOWN",
        "SEARCH_CONVERTING",
        "INTERVIEW_IMPROVING",
        "INTERVIEW_DECLINING",
        "MOMENTUM_DOWN",
        "MOMENTUM_UP",
        "RESPONSE_IMPROVING",
        "RESPONSE_DECLINING",
        "STRONG_SOURCE",
        "HIGH_VOLUME_LOW_RESPONSE",
        "SOURCE_CONCENTRATION",
        "PROMISING_SOURCE",
        "HEALTHY_PIPELINE",
      ]),
      category: z.enum(["momentum", "response", "pipeline", "follow_up", "source"]),
      semantic_type: z.enum(["action", "trend", "observation", "achievement"]),
      tone: z.enum(["ACTION_NEEDED", "WATCH", "INFO", "POSITIVE"]),
      title: z.string().min(1),
      description: z.string().min(1),
      evidence_summary: z.string().min(1),
      evidence: z.string().min(1),
      evidence_strength: z.enum(["LIMITED", "MODERATE", "STRONG"]),
      evidence_label: z.string().min(1).nullable(),
      priority: z.number().int().min(0).max(100),
      action: z
        .object({
          kind: z.enum(["VIEW_APPLICATIONS", "ADD_APPLICATION"]),
          label: z.string().min(1),
          parameters: z.record(z.string(), z.string()),
        })
        .nullable(),
    }),
  ),
  disclaimer: z.string().min(1),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
export type Analytics = z.infer<typeof analyticsSchema>;

export function getDashboard(range: DashboardRange, signal?: AbortSignal) {
  return apiRequest(`/api/v1/dashboard?range=${range}`, dashboardSchema, { signal });
}

export interface AnalyticsFilters {
  range: DashboardRange;
  status?: ApplicationStatus;
  source?: ApplicationSource;
  workMode?: WorkMode;
}

export function getAnalytics(filters: AnalyticsFilters, signal?: AbortSignal) {
  const search = new URLSearchParams({ range: filters.range });
  if (filters.status && APPLICATION_STATUSES.includes(filters.status)) {
    search.set("status", filters.status);
  }
  if (filters.source && APPLICATION_SOURCES.includes(filters.source)) {
    search.set("source", filters.source);
  }
  if (filters.workMode && WORK_MODES.includes(filters.workMode)) {
    search.set("work_mode", filters.workMode);
  }
  return apiRequest(`/api/v1/analytics?${search.toString()}`, analyticsSchema, {
    signal,
  });
}
