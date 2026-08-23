import type { Page, Route } from "@playwright/test";

export const applicationId = "11111111-1111-4111-8111-111111111111";

export const application = {
  application_id: applicationId,
  owner_user_id: "browser-test-user",
  company_name: "Northstar Labs",
  job_title: "Senior Frontend Platform Engineer",
  status: "APPLIED",
  applied_date: "2026-08-08",
  follow_up_date: "2026-08-14",
  job_url: "https://example.com/jobs/frontend-platform",
  location: "New York, NY",
  work_mode: "HYBRID",
  source: "REFERRAL",
  source_detail: "Design systems team",
  salary_text: "$135k–$155k",
  description: "Build accessible tools and a shared product platform for a growing engineering organization.",
  created_at: "2026-08-08T13:00:00Z",
  updated_at: "2026-08-12T16:30:00Z",
  version: 3,
  allowed_transitions: ["SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  submitted_at: "2026-08-08T13:00:00Z",
  stage_entered_at: "2026-08-08T13:00:00Z",
  first_response_at: null,
  first_screening_at: null,
  first_interview_at: null,
  first_offer_at: null,
  first_acceptance_at: null,
};

const secondApplication = {
  ...application,
  application_id: "22222222-2222-4222-8222-222222222222",
  company_name: "Cedar Analytics",
  job_title: "Product Design Systems Lead",
  status: "INTERVIEW",
  location: "Remote",
  work_mode: "REMOTE",
  source: "LINKEDIN",
  source_detail: null,
  follow_up_date: "2026-08-15",
  allowed_transitions: ["OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"],
};

const interview = {
  interview_id: "44444444-4444-4444-8444-444444444444",
  application_id: applicationId,
  company_name: application.company_name,
  job_title: application.job_title,
  interview_type: "TECHNICAL_SCREEN",
  status: "SCHEDULED",
  scheduled_at: "2026-08-15T15:00:00Z",
  duration_minutes: 60,
  location: "Video call",
  meeting_url: "https://example.com/meeting",
  details: "Review platform architecture and accessibility tradeoffs.",
  preparation_notes: null,
  completed_checklist_items: [],
  candidate_questions: [],
  debrief_went_well: null,
  debrief_improve: null,
  debrief_signals: null,
  debrief_next_step: null,
  debrief_completed_at: null,
  guidance: {
    checklist_items: [
      {
        item_id: "research_company",
        label: "Research the company and role",
        description: "Review the company, product, role, and recent context.",
      },
      {
        item_id: "prepare_examples",
        label: "Prepare evidence stories",
        description: "Write concise examples with situation, action, and result.",
      },
      {
        item_id: "prepare_questions",
        label: "Prepare candidate questions",
        description: "Bring at least two questions you want answered.",
      },
      {
        item_id: "confirm_logistics",
        label: "Confirm logistics",
        description: "Check the time, location, meeting link, and participants.",
      },
      {
        item_id: "review_technical_foundations",
        label: "Review technical foundations",
        description: "Refresh the core skills and tradeoffs likely to come up.",
      },
    ],
    focus_prompts: ["Clarify the technical bar and expected tradeoffs."],
    suggested_questions: ["What does success look like in the first 90 days?"],
    readiness: {
      completed_steps: 0,
      total_steps: 5,
      ready_for_interview: false,
      missing_actions: [
        "Research the company and role",
        "Prepare evidence stories",
        "Prepare candidate questions",
        "Confirm logistics",
        "Review technical foundations",
      ],
    },
  },
  created_at: "2026-08-10T13:00:00Z",
  updated_at: "2026-08-10T13:00:00Z",
  version: 1,
  allowed_statuses: ["COMPLETED", "CANCELED"],
};

const summary = {
  total_tracked: 16,
  active_pursuits: 8,
  drafts: 2,
  accepted: 1,
  rejected: 3,
  withdrawn: 1,
  archived: 1,
};

const rates = {
  submitted_count: 13,
  response_count: 8,
  response_rate: 8 / 13,
  interview_count: 4,
  interview_rate: 4 / 13,
  offer_count: 2,
  offer_rate: 2 / 13,
  acceptance_count: 1,
  acceptance_rate: 1 / 13,
};

const trend = [
  { week_start: "2026-07-20", count: 2 },
  { week_start: "2026-07-27", count: 3 },
  { week_start: "2026-08-03", count: 2 },
  { week_start: "2026-08-10", count: 1 },
];

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
    body: JSON.stringify(body),
  });
}

export async function installDeterministicApi(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "hireflux.demo-session.v1",
      JSON.stringify({
        access_token: "browser.demo.session.token.that.is.long.enough",
        token_type: "Bearer",
        expires_at: "2099-08-14T18:00:00Z",
      }),
    );
    if (window.localStorage.getItem("hireflux-color-theme") === null) {
      window.localStorage.setItem("hireflux-color-theme", "dark");
    }
  });

  await page.route("http://localhost:8000/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:4173",
          "access-control-allow-headers": "authorization,content-type",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
      return;
    }
    if (path === "/api/v1/me") {
      await json(route, {
        user_id: "browser-test-user",
        name: "Demo Recruiter",
        email: "demo@example.invalid",
        role: "STANDARD_USER",
        created_at: "2026-08-10T13:00:00Z",
        last_login_at: "2026-08-13T13:00:00Z",
      });
      return;
    }
    if (path === "/api/v1/settings") {
      await json(route, {
        time_zone: "UTC",
        default_follow_up_days: 7,
        default_application_view: "ACTIVE",
        default_dashboard_range: "30d",
        theme: "DARK",
        created_at: "2026-08-10T13:00:00Z",
        updated_at: "2026-08-10T13:00:00Z",
        version: 1,
      });
      return;
    }
    if (path === "/api/v1/dashboard") {
      await json(route, {
        range: url.searchParams.get("range") ?? "30d",
        generated_at: "2026-08-13T14:00:00Z",
        summary,
        rates,
        actions: [
          {
            kind: "FOLLOW_UP_OVERDUE",
            application_id: applicationId,
            company_name: application.company_name,
            job_title: application.job_title,
            due_date: "2026-08-12",
            priority: "HIGH",
            label: "Complete overdue follow-up",
          },
          {
            kind: "INTERVIEW_SOON",
            application_id: secondApplication.application_id,
            company_name: secondApplication.company_name,
            job_title: secondApplication.job_title,
            due_at: "2026-08-15T15:00:00Z",
            priority: "MEDIUM",
            label: "Prepare for interview",
          },
        ],
        upcoming_interviews: [interview],
        recent_applications: [application, secondApplication],
        submission_trend: trend,
        status_breakdown: [
          { status: "DRAFT", count: 2 },
          { status: "APPLIED", count: 3 },
          { status: "INTERVIEW", count: 2 },
          { status: "ACCEPTED", count: 1 },
        ],
      });
      return;
    }
    if (path === "/api/v1/analytics") {
      await json(route, {
        range: url.searchParams.get("range") ?? "90d",
        filters: { status: null, source: null, work_mode: null },
        generated_at: "2026-08-13T14:00:00Z",
        summary,
        rates,
        status_breakdown: [
          { status: "DRAFT", count: 2 },
          { status: "APPLIED", count: 3 },
          { status: "INTERVIEW", count: 2 },
          { status: "ACCEPTED", count: 1 },
        ],
        submission_trend: trend,
        funnel: [
          { stage: "SUBMITTED", count: 13, rate: 1 },
          { stage: "RESPONSE", count: 8, rate: 8 / 13 },
          { stage: "INTERVIEW", count: 4, rate: 4 / 13 },
          { stage: "OFFER", count: 2, rate: 2 / 13 },
          { stage: "ACCEPTED", count: 1, rate: 1 / 13 },
        ],
        stage_aging: [
          { bucket: "0-7", count: 2 },
          { bucket: "8-14", count: 3 },
          { bucket: "15-30", count: 2 },
          { bucket: "31+", count: 1 },
        ],
        source_performance: [
          {
            source: "REFERRAL",
            submitted_count: 3,
            response_count: 2,
            response_rate: 2 / 3,
            interview_count: 1,
            interview_rate: 1 / 3,
            offer_count: 1,
            offer_rate: 1 / 3,
            sample_sufficient: true,
          },
          {
            source: "LINKEDIN",
            submitted_count: 2,
            response_count: 1,
            response_rate: 0.5,
            interview_count: 1,
            interview_rate: 0.5,
            offer_count: 0,
            offer_rate: 0,
            sample_sufficient: false,
          },
        ],
        work_mode_breakdown: [
          { work_mode: "REMOTE", count: 6 },
          { work_mode: "HYBRID", count: 5 },
          { work_mode: "ONSITE", count: 2 },
        ],
        average_days_to_first_response: 3.2,
        no_response_count: 5,
        disclaimer: "These analytics describe this fictional demo workspace and are not career predictions.",
      });
      return;
    }
    if (path === "/api/v1/interviews") {
      await json(route, { items: [interview], next_cursor: null });
      return;
    }
    if (path === `/api/v1/applications/${applicationId}`) {
      await json(route, application);
      return;
    }
    if (path.endsWith("/activity")) {
      await json(route, {
        items: [
          {
            activity_id: "33333333-3333-4333-8333-333333333333",
            application_id: applicationId,
            activity_type: "APPLICATION_CREATED",
            summary: "Application created as Applied.",
            metadata: null,
            created_at: "2026-08-08T13:00:00Z",
          },
        ],
        next_cursor: null,
      });
      return;
    }
    if (path.endsWith("/notes")) {
      await json(route, {
        items: [
          {
            note_id: "55555555-5555-4555-8555-555555555555",
            application_id: applicationId,
            content: "Review design-system decisions and prepare accessibility examples.",
            created_at: "2026-08-11T13:00:00Z",
            updated_at: "2026-08-11T13:00:00Z",
            version: 1,
          },
        ],
        next_cursor: null,
      });
      return;
    }
    if (path.endsWith("/interviews")) {
      await json(route, { items: [interview], next_cursor: null });
      return;
    }
    if (path === "/api/v1/applications") {
      await json(route, { items: [application, secondApplication], next_cursor: null });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: `No fixture for ${path}` } }),
    });
  });
}
