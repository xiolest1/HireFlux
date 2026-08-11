import type { Activity, Application, User } from "../api/schemas";

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
    source: "Company website",
    salary_text: "$125k–$145k",
    description: "Build thoughtful tools for customers.",
    created_at: "2026-08-10T13:00:00Z",
    updated_at: "2026-08-10T13:00:00Z",
    version: 1,
    allowed_transitions: ["INTERVIEW", "REJECTED", "ARCHIVED"],
    ...overrides,
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
