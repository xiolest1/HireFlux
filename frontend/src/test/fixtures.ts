import type { Activity, Application, Interview, Settings, User } from "../api/schemas";
import type { Dashboard } from "../api/workspace";

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
    job_url: "https://example.com/jobs/frontend-engineer",
    location: "New York, NY",
    work_mode: "HYBRID",
    source: "COMPANY_WEBSITE",
    source_detail: null,
    salary_text: "$125k–$145k",
    description: "Build thoughtful tools for customers.",
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
    created_at: "2026-08-10T13:00:00Z",
    updated_at: "2026-08-10T13:00:00Z",
    version: 1,
    allowed_statuses: ["COMPLETED", "CANCELED"],
    ...overrides,
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
