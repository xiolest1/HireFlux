import type { Activity, Application, Interview, Pipeline, Settings, User, WorkspaceInterview } from "../api/schemas";
import type { Analytics, Dashboard } from "../api/workspace";

export const testUser: User = {
  user_id: "local-user-001",
  name: "Jordan Lee",
  email: "jordan@example.com",
  role: "STANDARD_USER",
  created_at: "2026-08-10T13:00:00Z",
  last_login_at: "2026-08-10T13:00:00Z",
};

export function makeApplication(
  overrides: Partial<Application> = {},
): Application {
  return {
    application_id: "11111111-1111-4111-8111-111111111111",
    owner_user_id: testUser.user_id,
    company_name: "Northstar Labs",
    job_title: "Frontend Engineer",
    status: "APPLIED",
    applied_date: "2026-08-08",
    follow_up_date: null,
    next_step_responsibility: null,
    next_step_note: null,
    job_url: "https://example.com/jobs/frontend-engineer",
    location: "New York, NY",
    work_mode: "HYBRID",
    source: "COMPANY_WEBSITE",
    source_detail: null,
    salary_text: "$125k–$145k",
    description: "Build thoughtful tools for customers.",
    role_family: null,
    created_at: "2026-08-10T13:00:00Z",
    updated_at: "2026-08-10T13:00:00Z",
    version: 1,
    submitted_at: "2026-08-08T13:00:00Z",
    stage_entered_at: "2026-08-08T13:00:00Z",
    first_response_at: null,
    first_screening_at: null,
    first_interview_at: null,
    first_offer_at: null,
    first_acceptance_at: null,
    allowed_transitions: ["INTERVIEW", "REJECTED", "ARCHIVED"],
    ...overrides,
  };
}

export function makePipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  const statuses = ["DRAFT", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
  return {
    generated_at: "2026-08-12T13:00:00Z",
    lanes: statuses.map((status) => ({
      status,
      count: status === "APPLIED" ? 1 : 0,
      has_more: false,
      cards: status === "APPLIED" ? [{
        application: makeApplication({ allowed_transitions: ["SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"] }),
        stage_age_days: 4,
        follow_up_state: "UPCOMING",
      }] : [],
    })),
    ...overrides,
  };
}

export const testSettings: Settings = {
  time_zone: "UTC",
  default_follow_up_days: 7,
  default_application_view: "ACTIVE",
  default_dashboard_range: "30d",
  theme: "SYSTEM",
  created_at: "2026-08-10T13:00:00Z",
  updated_at: "2026-08-10T13:00:00Z",
  version: 1,
};

export function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    interview_id: "44444444-4444-4444-8444-444444444444",
    application_id: "11111111-1111-4111-8111-111111111111",
    company_name: "Northstar Labs",
    job_title: "Frontend Engineer",
    interview_type: "TECHNICAL_SCREEN",
    status: "SCHEDULED",
    scheduled_at: "2026-08-14T15:00:00Z",
    duration_minutes: 60,
    location: "Video call",
    meeting_url: "https://example.com/meeting",
    details: null,
    preparation_notes: null,
    completed_checklist_items: [],
    candidate_questions: [],
    custom_preparation_items: [],
    debrief_went_well: null,
    debrief_improve: null,
    debrief_signals: null,
    debrief_next_step: null,
    debrief_primary_reflection: null,
    debrief_carry_forward: null,
    debrief_completed_at: null,
    guidance: {
      role_context: {
        role_family: "SOFTWARE_IT",
        role_family_label: "Software / IT",
        source: "TITLE_INFERRED",
        explanation: "Suggested from the job title; you can change the Software / IT focus.",
      },
      checklist_items: [
        {
          item_id: "research_company",
          label: "Research the company and role",
          description: "Review the company, product, role, and recent context.",
          phase: "UNDERSTAND",
          source: "UNIVERSAL",
          source_label: "Useful for every interview",
          category: "ESSENTIAL",
          outcome_id: "OPPORTUNITY_UNDERSTANDING",
          removable: false,
          completed: false,
        },
        {
          item_id: "prepare_examples",
          label: "Prepare evidence stories",
          description: "Write concise examples with situation, action, and result.",
          phase: "PREPARE",
          source: "INTERVIEW_TYPE",
          source_label: "Suggested for technical or skills screens",
          category: "ESSENTIAL",
          outcome_id: "RELEVANT_EVIDENCE",
          removable: false,
          completed: false,
        },
        {
          item_id: "prepare_questions",
          label: "Prepare candidate questions",
          description: "Bring at least two questions you want answered.",
          phase: "PREPARE",
          source: "UNIVERSAL",
          source_label: "Useful for every interview",
          category: "ESSENTIAL",
          outcome_id: "CONVERSATION_PLAN",
          removable: false,
          completed: false,
        },
        {
          item_id: "review_role_topics",
          label: "Review technical evidence",
          description: "Choose a project or technical decision and explain its tradeoffs.",
          phase: "PREPARE",
          source: "ROLE_FAMILY",
          source_label: "Suggested for Software / IT roles",
          category: "ADDITIONAL",
          outcome_id: null,
          removable: false,
          completed: false,
        },
      ],
      focus_prompts: [{ text: "Which experience is most relevant?", source: "UNIVERSAL", source_label: "Useful for every interview" }],
      suggested_questions: [{ text: "What does success look like in the first 90 days?", source: "UNIVERSAL", source_label: "Useful for every interview" }],
      tips: [
        { title: "Build evidence, not a script", body: "Prepare context, your action, and the result.", source: "UNIVERSAL", source_label: "Useful for every interview" },
        { title: "Confirm the format", body: "Ask what will be assessed and which tools you may use.", source: "INTERVIEW_TYPE", source_label: "Suggested for technical or skills screens" },
      ],
      essential_outcomes: [
        { outcome_id: "OPPORTUNITY_UNDERSTANDING", label: "Understand the opportunity", description: "Review the company, product, role, and recent context.", completed: false, action_item_id: "research_company" },
        { outcome_id: "RELEVANT_EVIDENCE", label: "Prepare relevant evidence", description: "Write concise examples with situation, action, and result.", completed: false, action_item_id: "prepare_examples" },
        { outcome_id: "CONVERSATION_PLAN", label: "Plan the conversation", description: "Bring at least two questions you want answered.", completed: false, action_item_id: "prepare_questions" },
      ],
      progress: {
        essentials: { completed: 0, total: 3, complete: false, remaining_actions: ["Research the company and role", "Prepare evidence stories", "Prepare candidate questions"] },
        additional: { completed: 0, total: 1 },
        candidate: { completed: 0, total: 0 },
      },
    },
    created_at: "2026-08-10T13:00:00Z",
    updated_at: "2026-08-10T13:00:00Z",
    version: 1,
    allowed_statuses: ["COMPLETED", "CANCELED"],
    ...overrides,
  };
}

export function makeWorkspaceInterview(
  overrides: Partial<WorkspaceInterview> = {},
): WorkspaceInterview {
  const { context, ...interviewOverrides } = overrides;
  return {
    ...makeInterview(interviewOverrides),
    context: {
      application_status: "APPLIED",
      follow_up_date: null,
      follow_up_state: "NONE",
      workflow_state: "PREPARE",
      next_action: "PREPARE",
      next_step_responsibility: null,
      next_step_note: null,
      has_later_scheduled_interview: false,
      ...context,
    },
  };
}

export const testDashboard: Dashboard = {
  range: "30d",
  generated_at: "2026-08-12T13:00:00Z",
  summary: { total_tracked: 16, active_pursuits: 7, drafts: 2, accepted: 1, rejected: 3, withdrawn: 1, archived: 1 },
  rates: { submitted_count: 13, response_count: 8, response_rate: 8 / 13, interview_count: 4, interview_rate: 4 / 13, offer_count: 2, offer_rate: 2 / 13, acceptance_count: 1, acceptance_rate: 1 / 13 },
  actions: [],
  upcoming_interviews: [],
  recent_applications: [],
  submission_trend: [
    { week_start: "2026-07-20", count: 2 },
    { week_start: "2026-07-27", count: 3 },
    { week_start: "2026-08-03", count: 2 },
    { week_start: "2026-08-10", count: 1 },
  ],
  status_breakdown: [{ status: "APPLIED", count: 4 }],
};

export function makeAnalytics(range: "30d" | "90d" | "all" = "30d"): Analytics {
  const comparisonAvailable = range !== "all";
  return {
    range,
    filters: { status: null, source: null, work_mode: null },
    generated_at: "2026-08-12T13:00:00Z",
    summary: testDashboard.summary,
    rates: testDashboard.rates,
    status_breakdown: testDashboard.status_breakdown,
    submission_trend: testDashboard.submission_trend,
    funnel: [{ stage: "SUBMITTED", count: 13, rate: 1 }],
    stage_aging: [],
    source_performance: [],
    source_period: {
      label: "Selected range",
      current_start: "2026-07-13",
      current_end: "2026-08-12",
      previous_start: "2026-06-12",
      previous_end: "2026-07-12",
    },
    source_summary: {
      submitted_count: 13,
      sufficient_for_strategy: true,
      top_volume: null,
      strongest_response: null,
      recent_movement: null,
      concentration: {
        flagged: false,
        source: null,
        application_share: 0,
        threshold: 0.5,
        submitted_count: 13,
      },
    },
    work_mode_breakdown: [],
    average_days_to_first_response: 3.5,
    no_response_count: 5,
    period_comparison: comparisonAvailable ? {
      available: true,
      current_start: "2026-07-13",
      current_end: "2026-08-12",
      previous_start: "2026-06-12",
      previous_end: "2026-07-12",
      current: {
        submitted_count: 8,
        response_rate: 0.5,
        interview_rate: 0.25,
        offer_rate: 0.125,
        acceptance_rate: 0,
        average_days_to_first_response: 3.5,
      },
      previous: {
        submitted_count: 5,
        response_rate: 0.3,
        interview_rate: 0.2,
        offer_rate: 0,
        acceptance_rate: 0,
        average_days_to_first_response: 4,
      },
      deltas: {
        submitted_count: 3,
        response_rate: 0.2,
        interview_rate: 0.05,
        offer_rate: 0.125,
        acceptance_rate: 0,
        average_days_to_first_response: -0.5,
      },
    } : {
      available: false,
      current_start: null,
      current_end: null,
      previous_start: null,
      previous_end: null,
      current: null,
      previous: null,
      deltas: null,
    },
    follow_up_coverage: {
      active_count: 7,
      scheduled_count: 5,
      coverage_rate: 5 / 7,
      overdue_count: 1,
      due_today_count: 1,
      missing_count: 2,
    },
    next_step_summary: {
      active_count: 7,
      accounted_for_count: 5,
      coverage_rate: 5 / 7,
      unresolved_count: 2,
      candidate_action_count: 1,
      employer_wait_count: 1,
      no_action_count: 1,
    },
    progress_narrative: {
      state: comparisonAvailable ? "READY" : "ALL_TIME",
      tone: comparisonAvailable ? "POSITIVE" : "NEUTRAL",
      headline: comparisonAvailable ? "Recent applications are converting more effectively" : "Your complete tracked search history",
      explanation: comparisonAvailable ? "Response and interview conversion improved across equal comparison periods." : "All-time results show the full journey without treating separate periods as directly comparable.",
      primary_signal: comparisonAvailable ? {
        code: "SEARCH_CONVERTING",
        category: "PERFORMANCE",
        direction: "IMPROVING",
        priority: 60,
        evidence_metric_keys: ["RESPONSE_RATE", "INTERVIEW_RATE"],
        evidence_summary: "50% response · 25% interview",
        sample_label: "Early signal · Based on 13 applications",
      } : null,
      supporting_signals: [
        { metric_key: "SUBMISSIONS", category: "ACTIVITY", direction: comparisonAvailable ? "IMPROVING" : "NOT_AVAILABLE", emphasis: "CONTEXT" },
        { metric_key: "RESPONSE_RATE", category: "PERFORMANCE", direction: comparisonAvailable ? "IMPROVING" : "NOT_AVAILABLE", emphasis: comparisonAvailable ? "PRIMARY" : "CONTEXT" },
        { metric_key: "INTERVIEW_RATE", category: "PERFORMANCE", direction: comparisonAvailable ? "IMPROVING" : "NOT_AVAILABLE", emphasis: comparisonAvailable ? "PRIMARY" : "CONTEXT" },
      ],
      process_health: {
        tone: "ACTION_NEEDED",
        summary: "Some active opportunities need follow-up attention now.",
        active_count: 7,
        scheduled_count: 5,
        coverage_rate: 5 / 7,
        overdue_count: 1,
        due_today_count: 1,
        missing_count: 2,
      },
      recommended_focus: {
        title: "1 follow-up is overdue",
        explanation: "2 other active applications do not have a next step scheduled.",
        tone: "ACTION_NEEDED",
        action: {
          kind: "VIEW_APPLICATIONS",
          label: "Review follow-ups",
          parameters: { view: "ACTIVE", follow_up: "NEEDS_ATTENTION" },
        },
      },
    },
    insights: [{
      code: "FOLLOW_UP_ATTENTION",
      category: "follow_up",
      semantic_type: "action",
      tone: "ACTION_NEEDED",
      title: "1 follow-up is overdue",
      description: "2 other active applications do not have a next step scheduled.",
      evidence_summary: "1 overdue · 2 missing a next step",
      evidence: "1 follow-up overdue and 2 without a next step scheduled across 7 active applications.",
      evidence_strength: "STRONG",
      evidence_label: null,
      priority: 100,
      action: {
        kind: "VIEW_APPLICATIONS",
        label: "Review follow-ups",
        parameters: { view: "ACTIVE", follow_up: "NEEDS_ATTENTION" },
      },
    }],
    disclaimer: "This dataset is descriptive, not predictive.",
  };
}

export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    activity_id: "22222222-2222-4222-8222-222222222222",
    application_id: "11111111-1111-4111-8111-111111111111",
    activity_type: "APPLICATION_CREATED",
    summary: "Application created as Applied.",
    metadata: null,
    created_at: "2026-08-10T13:00:00Z",
    ...overrides,
  };
}
