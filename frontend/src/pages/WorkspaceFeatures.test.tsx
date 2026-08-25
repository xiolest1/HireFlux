import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "../test/renderApp";
import type { Analytics } from "../api/workspace";
import {
  makeApplication,
  makeInterview,
  makeWorkspaceInterview,
  testDashboard,
  testSettings,
} from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";

function makeProgressAnalytics(range: "30d" | "90d" | "all" = "30d"): Analytics {
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
    source_period: { label: "Selected range", current_start: "2026-07-13", current_end: "2026-08-12", previous_start: "2026-06-12", previous_end: "2026-07-12" },
    source_summary: { submitted_count: 13, sufficient_for_strategy: true, top_volume: null, strongest_response: null, recent_movement: null, concentration: { flagged: false, source: null, application_share: 0, threshold: 0.5, submitted_count: 13 } },
    work_mode_breakdown: [],
    average_days_to_first_response: 3.5,
    no_response_count: 5,
    period_comparison: comparisonAvailable ? {
      available: true,
      current_start: "2026-07-13",
      current_end: "2026-08-12",
      previous_start: "2026-06-12",
      previous_end: "2026-07-12",
      current: { submitted_count: 8, response_rate: 0.5, interview_rate: 0.25, offer_rate: 0.125, acceptance_rate: 0, average_days_to_first_response: 3.5 },
      previous: { submitted_count: 5, response_rate: 0.3, interview_rate: 0.2, offer_rate: 0, acceptance_rate: 0, average_days_to_first_response: 4 },
      deltas: { submitted_count: 3, response_rate: 0.2, interview_rate: 0.05, offer_rate: 0.125, acceptance_rate: 0, average_days_to_first_response: -0.5 },
    } : { available: false, current_start: null, current_end: null, previous_start: null, previous_end: null, current: null, previous: null, deltas: null },
    follow_up_coverage: { active_count: 4, scheduled_count: 2, coverage_rate: 0.5, overdue_count: 1, due_today_count: 1, missing_count: 1 },
    insights: [{ code: "FOLLOW_UP_ATTENTION", category: "follow_up", semantic_type: "action", tone: "ACTION_NEEDED", title: "1 follow-up is overdue", description: "1 other active application does not have a next step scheduled.", evidence_summary: "1 overdue · 1 missing a next step", evidence: "1 follow-up overdue and 1 without a next step scheduled across 4 active applications.", evidence_strength: "STRONG", evidence_label: null, priority: 100, action: { kind: "VIEW_APPLICATIONS", label: "Review follow-ups", parameters: { view: "ACTIVE", follow_up: "NEEDS_ATTENTION" } } }],
    disclaimer: "This dataset is descriptive, not predictive.",
  };
}

function interviewContextHandlers(interviews = [makeInterview()]) {
  return [
    http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
      HttpResponse.json(makeApplication({ status: "INTERVIEW" })),
    ),
    http.get(
      `${API_ORIGIN}/api/v1/applications/:applicationId/interviews`,
      () => HttpResponse.json({ items: interviews, next_cursor: null }),
    ),
  ];
}

describe("workspace milestone features", () => {
  it("answers the core dashboard questions and completes a due follow-up", async () => {
    const application = makeApplication({
      version: 3,
      follow_up_date: "2026-08-11",
    });
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () =>
        HttpResponse.json({
          ...testDashboard,
          actions: [
            {
              kind: "FOLLOW_UP_OVERDUE",
              application_id: application.application_id,
              company_name: application.company_name,
              job_title: application.job_title,
              due_date: "2026-08-11",
              priority: "HIGH",
              label: "Complete overdue follow-up",
            },
            {
              kind: "INTERVIEW_SOON",
              application_id: application.application_id,
              company_name: application.company_name,
              job_title: application.job_title,
              due_at: "2026-08-14T01:00:00Z",
              priority: "HIGH",
              label: "Prepare for upcoming interview",
            },
          ],
          recent_applications: [application],
        }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({
          ...testSettings,
          time_zone: "America/Los_Angeles",
        }),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/follow-up/complete`,
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...application,
            follow_up_date: null,
            version: 4,
          });
        },
      ),
    );

    const { user, queryClient } = renderApp("/dashboard");
    const analyticsKey = ["analytics", { range: "30d" }] as const;
    queryClient.setQueryData(analyticsKey, { seeded: true });
    expect(
      await screen.findByRole("heading", {
        name: "How many jobs am I pursuing?",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "What needs my attention today?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "How successful has my search been?",
      }),
    ).toBeVisible();
    expect(screen.getByText("8 of 13 submitted applications")).toBeVisible();
    expect(
      screen.getByText(/Complete overdue follow-up.*Aug 11, 2026/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /more overdue/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Prepare for upcoming interview.*Aug 13, 2026, 6:00 PM/),
    ).toBeVisible();

    const collapseActionCenter = screen.getByRole("button", {
      name: "Collapse action center",
    });
    expect(collapseActionCenter).toHaveAttribute("aria-expanded", "true");
    expect(collapseActionCenter).toHaveAttribute(
      "aria-controls",
      "action-center-content",
    );
    await user.click(collapseActionCenter);
    expect(
      screen.getByRole("button", { name: "Expand action center" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByText("2 actions · 1 overdue · 0 today · 1 upcoming"),
    ).toBeVisible();
    expect(document.getElementById("action-center-content")).toHaveAttribute(
      "hidden",
    );
    expect(
      screen.queryByRole("button", { name: "Complete" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Expand action center" }),
    );
    expect(screen.getByRole("button", { name: "Complete" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(await screen.findByText("Follow-up completed.")).toBeVisible();
    expect(body).toEqual({ expected_version: 3 });
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true);
  });

  it("adapts Home for an early, calm search without inventing urgency", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () =>
        HttpResponse.json({
          ...testDashboard,
          summary: {
            ...testDashboard.summary,
            total_tracked: 2,
            active_pursuits: 2,
          },
          rates: { ...testDashboard.rates, submitted_count: 2 },
          actions: [],
          upcoming_interviews: [],
          recent_applications: [],
          submission_trend: testDashboard.submission_trend.map((point) => ({
            ...point,
            count: 0,
          })),
        }),
      ),
    );

    renderApp("/dashboard");
    expect(await screen.findByText("Building your foundation")).toBeVisible();
    expect(
      screen.getByText(
        "Nothing needs immediate attention. You can continue without creating urgency.",
      ),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Add an application" })[0],
    ).toHaveAttribute("href", "/applications/new");
    expect(
      screen.getByText(
        "There is no recent application activity to catch up on yet.",
      ),
    ).toBeVisible();
  });

  it("loads an analytical progress brief only after it is opened", async () => {
    let analyticsRequests = 0;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/analytics`, () => {
        analyticsRequests += 1;
        return HttpResponse.json(makeProgressAnalytics());
      }),
    );

    const { user } = renderApp("/dashboard");
    await screen.findByRole("heading", {
      name: "How successful has my search been?",
    });
    expect(analyticsRequests).toBe(0);
    expect(
      screen.queryByText("What the recent data is showing"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("View supporting progress details"));

    expect(
      await screen.findByText("What the recent data is showing"),
    ).toBeVisible();
    expect(analyticsRequests).toBe(1);
    expect(screen.getByText("+3 from previous period")).toBeVisible();
    expect(screen.getByText("+20 pp from previous period")).toBeVisible();
    expect(screen.getByText("+5 pp from previous period")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "1 follow-up is overdue" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Suggested action: Review follow-ups" }),
    ).toHaveAttribute(
      "href",
      "/applications?view=ACTIVE&follow_up=NEEDS_ATTENTION",
    );
    expect(
      screen.getByText("1 overdue · 1 due today · 1 missing a next step"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Analytics" }),
    ).toHaveAttribute("href", "/analytics?range=30d");

    const progressDisclosure = screen.getByText(
      "View supporting progress details",
    );
    await user.click(progressDisclosure);
    expect(
      screen.queryByText("What the recent data is showing"),
    ).not.toBeInTheDocument();
    progressDisclosure.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText("What the recent data is showing"),
    ).toBeVisible();
  });

  it("explains all-time progress and allows an analytics retry", async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/analytics`, ({ request }) => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            {
              error: {
                code: "UNEXPECTED",
                message: "Analytics is temporarily unavailable.",
                request_id: "request-123",
              },
            },
            { status: 503 },
          );
        }
        const range = new URL(request.url).searchParams.get("range");
        return HttpResponse.json(
          makeProgressAnalytics(range === "all" ? "all" : "30d"),
        );
      }),
    );

    const { user } = renderApp("/dashboard");
    await screen.findByRole("heading", {
      name: "How successful has my search been?",
    });
    await user.selectOptions(screen.getByLabelText("Summary range"), "all");
    await user.click(screen.getByText("View supporting progress details"));

    expect(
      await screen.findByRole("heading", {
        name: "Progress details could not be loaded",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText("Complete history, not a period comparison"),
    ).toBeVisible();
    expect(attempts).toBe(2);
    expect(
      screen.getByRole("link", { name: "Open Analytics" }),
    ).toHaveAttribute("href", "/analytics?range=all");
  });

  it("keeps large action groups compact while revealing every action on demand", async () => {
    const action = (
      index: number,
      kind: "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_TODAY" | "INTERVIEW_SOON",
    ) => ({
      kind,
      application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      company_name: `Company ${index + 1}`,
      job_title: `${kind} role ${index + 1}`,
      due_date: kind === "INTERVIEW_SOON" ? null : "2026-08-11",
      due_at: kind === "INTERVIEW_SOON" ? "2026-08-14T15:00:00Z" : null,
      priority: kind === "FOLLOW_UP_OVERDUE" ? "HIGH" : "MEDIUM",
      label:
        kind === "FOLLOW_UP_OVERDUE"
          ? "Complete overdue follow-up"
          : kind === "FOLLOW_UP_TODAY"
            ? "Follow up today"
            : "Prepare for upcoming interview",
    });
    const actions = [
      ...Array.from({ length: 9 }, (_, index) =>
        action(index, "FOLLOW_UP_OVERDUE"),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        action(index + 9, "FOLLOW_UP_TODAY"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        action(index + 13, "INTERVIEW_SOON"),
      ),
    ];
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () =>
        HttpResponse.json({ ...testDashboard, actions }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json(testSettings),
      ),
    );

    const { user } = renderApp("/dashboard");
    expect(
      await screen.findByRole("heading", {
        name: "What needs my attention today?",
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Expand action center" }),
    );
    expect(
      screen.getByRole("heading", { name: /Overdue \(9\)/ }),
    ).toBeVisible();
    expect(screen.getByText("Showing 3 of 9")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "FOLLOW_UP_OVERDUE role 1" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "FOLLOW_UP_OVERDUE role 3" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "FOLLOW_UP_OVERDUE role 4" }),
    ).not.toBeInTheDocument();

    const showMoreOverdue = screen.getByRole("button", {
      name: "Show 6 more overdue actions",
    });
    expect(showMoreOverdue).toHaveAttribute("aria-expanded", "false");
    expect(showMoreOverdue).toHaveAttribute(
      "aria-controls",
      "attention-overdue-items",
    );
    showMoreOverdue.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: "Show fewer overdue actions" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Showing 9 of 9")).toBeVisible();
    const ninthLink = screen.getByRole("link", {
      name: "FOLLOW_UP_OVERDUE role 9",
    });
    expect(ninthLink).toBeVisible();

    const ninthCard = ninthLink.closest("li");
    expect(ninthCard).not.toBeNull();
    await user.click(
      within(ninthCard as HTMLElement).getByRole("button", {
        name: "Reschedule",
      }),
    );
    await user.type(screen.getByLabelText("New follow-up date"), "2026-08-20");
    await user.click(
      screen.getByRole("button", { name: "Show fewer overdue actions" }),
    );
    expect(
      screen.queryByLabelText("New follow-up date"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show 6 more overdue actions" }),
    );
    expect(screen.getByLabelText("New follow-up date")).toHaveValue(
      "2026-08-20",
    );

    expect(screen.getByText("Showing 3 of 4")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Show 1 more today action" }),
    ).toBeVisible();
    expect(screen.getByText("Showing 3 of 5")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Show 2 more upcoming actions" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Collapse action center" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Expand action center" }),
    );
    expect(
      screen.getByRole("link", { name: "FOLLOW_UP_OVERDUE role 9" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Show fewer overdue actions" }),
    );
    expect(
      screen.queryByRole("link", { name: "FOLLOW_UP_OVERDUE role 9" }),
    ).not.toBeInTheDocument();
  });

  it("remembers the Action Center per workspace and preserves a reschedule draft", async () => {
    const application = makeApplication({ follow_up_date: "2026-08-11" });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () =>
        HttpResponse.json({
          ...testDashboard,
          actions: [
            {
              kind: "FOLLOW_UP_OVERDUE",
              application_id: application.application_id,
              company_name: application.company_name,
              job_title: application.job_title,
              due_date: "2026-08-11",
              priority: "HIGH",
              label: "Complete overdue follow-up",
            },
          ],
        }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json(testSettings),
      ),
    );

    const firstRender = renderApp("/dashboard");
    const reschedule = await screen.findByRole("button", {
      name: "Reschedule",
    });
    await firstRender.user.click(reschedule);
    const date = screen.getByLabelText("New follow-up date");
    await firstRender.user.type(date, "2026-08-20");
    await firstRender.user.click(
      screen.getByRole("button", { name: "Collapse action center" }),
    );
    expect(document.getElementById("action-center-content")).toHaveAttribute(
      "hidden",
    );
    expect(screen.getByLabelText("New follow-up date")).toHaveValue(
      "2026-08-20",
    );
    expect(
      window.sessionStorage.getItem("hireflux-action-center.v1"),
    ).toContain('"collapsed":true');
    await firstRender.user.click(
      screen.getByRole("button", { name: "Expand action center" }),
    );
    expect(screen.getByLabelText("New follow-up date")).toHaveValue(
      "2026-08-20",
    );
    await firstRender.user.click(
      screen.getByRole("button", { name: "Collapse action center" }),
    );

    firstRender.unmount();
    const sameWorkspace = renderApp("/dashboard");
    expect(
      await screen.findByRole("button", { name: "Expand action center" }),
    ).toBeVisible();
    sameWorkspace.unmount();

    renderApp("/dashboard", {
      session: {
        access_token: "different.demo.session.token.value.123456789",
        token_type: "Bearer",
        expires_at: "2099-08-11T12:00:00Z",
      },
    });
    expect(
      await screen.findByRole("button", { name: "Collapse action center" }),
    ).toBeVisible();
  });

  it("migrates, persists, and dismisses the candidate search tour", async () => {
    window.sessionStorage.setItem(
      "hireflux-recruiter-guide",
      JSON.stringify({
        status: true,
        engagement: false,
        analytics: false,
        dismissed: false,
      }),
    );
    const { user } = renderApp("/dashboard");
    expect(
      await screen.findByRole("heading", {
        name: "Three ways to explore HireFlux",
      }),
    ).toBeVisible();
    expect(screen.getByText("Search tour · 1/3")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Dismiss search tour" }),
    );
    expect(
      screen.queryByRole("heading", { name: "Three ways to explore HireFlux" }),
    ).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("hireflux-search-tour")).toContain(
      '"dismissed":true',
    );
    expect(window.sessionStorage.getItem("hireflux-search-tour")).toContain(
      '"status":true',
    );
    expect(
      window.sessionStorage.getItem("hireflux-recruiter-guide"),
    ).toBeNull();
  });

  it("binds analytics filters to the API and labels small samples", async () => {
    let query = new URLSearchParams();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/analytics`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({
          range: "30d",
          filters: { status: null, source: "REFERRAL", work_mode: null },
          generated_at: "2026-08-12T13:00:00Z",
          summary: testDashboard.summary,
          rates: testDashboard.rates,
          status_breakdown: testDashboard.status_breakdown,
          submission_trend: testDashboard.submission_trend,
          funnel: [{ stage: "SUBMITTED", count: 2, rate: 1 }],
          stage_aging: [{ bucket: "0-7", count: 1 }],
          source_performance: [
            {
              source: "REFERRAL",
              submitted_count: 2,
              response_count: 1,
              response_rate: 0.5,
              interview_count: 1,
              interview_rate: 0.5,
              offer_count: 0,
              offer_rate: 0,
              acceptance_count: 0,
              acceptance_rate: 0,
              sample_sufficient: false,
              application_share: 1,
              response_rate_delta_vs_overall: 0,
              interview_rate_delta_vs_overall: 0,
              recent: {
                submitted_count: 2,
                response_count: 1,
                response_rate: 0.5,
                interview_count: 1,
                interview_rate: 0.5,
                offer_count: 0,
                offer_rate: 0,
                previous_submitted_count: 1,
                previous_response_rate: 0,
                previous_interview_rate: 0,
                response_rate_delta: 0.5,
                interview_rate_delta: 0.5,
              },
              recent_sample_sufficient: false,
              signal: "LIMITED_DATA",
              guidance:
                "Track at least three submitted applications before comparing this source with confidence.",
            },
          ],
          source_period: {
            label: "Selected range",
            current_start: "2026-07-23",
            current_end: "2026-08-22",
            previous_start: "2026-06-22",
            previous_end: "2026-07-22",
          },
          source_summary: {
            submitted_count: 2,
            sufficient_for_strategy: false,
            top_volume: {
              source: "REFERRAL",
              submitted_count: 2,
              application_share: 1,
              response_rate: 0.5,
              response_rate_delta_vs_overall: 0,
            },
            strongest_response: null,
            recent_movement: null,
            concentration: {
              flagged: true,
              source: "REFERRAL",
              application_share: 1,
              threshold: 0.5,
              submitted_count: 2,
            },
          },
          work_mode_breakdown: [{ work_mode: "HYBRID", count: 2 }],
          average_days_to_first_response: 3.5,
          no_response_count: 1,
          period_comparison: {
            available: true,
            current_start: "2026-07-23",
            current_end: "2026-08-22",
            previous_start: "2026-06-22",
            previous_end: "2026-07-22",
            current: {
              submitted_count: 2,
              response_rate: 0.5,
              interview_rate: 0.5,
              offer_rate: 0,
              acceptance_rate: 0,
              average_days_to_first_response: 3.5,
            },
            previous: {
              submitted_count: 1,
              response_rate: 0,
              interview_rate: 0,
              offer_rate: 0,
              acceptance_rate: 0,
              average_days_to_first_response: null,
            },
            deltas: {
              submitted_count: 1,
              response_rate: 0.5,
              interview_rate: 0.5,
              offer_rate: 0,
              acceptance_rate: 0,
              average_days_to_first_response: null,
            },
          },
          follow_up_coverage: {
            active_count: 1,
            scheduled_count: 0,
            coverage_rate: 0,
            overdue_count: 0,
            due_today_count: 0,
            missing_count: 1,
          },
          insights: [
            {
              code: "FOLLOW_UP_ATTENTION",
              category: "follow_up",
              semantic_type: "action",
              tone: "ACTION_NEEDED",
              title: "1 follow-up is overdue",
              description:
                "1 other active application does not have a next step scheduled.",
              evidence_summary: "1 overdue · 1 missing a next step",
              evidence:
                "1 follow-up overdue and 1 without a next step scheduled across 2 active applications.",
              evidence_strength: "STRONG",
              evidence_label: null,
              priority: 100,
              action: {
                kind: "VIEW_APPLICATIONS",
                label: "Review follow-ups",
                parameters: { view: "ACTIVE", follow_up: "NEEDS_ATTENTION" },
              },
            },
            {
              code: "BUILD_SAMPLE",
              category: "response",
              semantic_type: "observation",
              tone: "INFO",
              title: "Search Health is still building your picture",
              description: "Track more applications before judging rates.",
              evidence_summary: "2 submitted · trends begin at 5",
              evidence: "This view contains 2 submitted applications.",
              evidence_strength: "LIMITED",
              evidence_label: "Early signal",
              priority: 20,
              action: {
                kind: "ADD_APPLICATION",
                label: "Add application",
                parameters: {},
              },
            },
          ],
          disclaimer: "This dataset is descriptive, not predictive.",
        });
      }),
    );

    const { user } = renderApp("/analytics?range=30d&source=REFERRAL");
    expect(
      await screen.findByRole("heading", { name: "Your search at a glance" }),
    ).toBeVisible();
    expect(screen.getByText("Action needed")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "1 follow-up is overdue" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: "Search Health is still building your picture",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Suggested action: Review follow-ups" }),
    ).toHaveAttribute(
      "href",
      "/applications?view=ACTIVE&follow_up=NEEDS_ATTENTION",
    );
    expect(screen.getByText("7", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("62%", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("31%", { selector: "dd" })).toBeVisible();
    expect(
      screen.getByText(
        "2 submissions in this period — 1 more than the previous period.",
      ),
    ).toBeVisible();
    const allInsights = screen.getByRole("button", {
      name: "View all insights (2)",
    });
    expect(allInsights).toHaveAttribute("aria-expanded", "false");
    await user.click(allInsights);
    expect(
      screen.getByRole("heading", {
        name: "Search Health is still building your picture",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Suggested action: Add application" }),
    ).toHaveAttribute("href", "/applications/new");
    const whyButton = screen.getByRole("button", {
      name: "Why you're seeing this: 1 follow-up is overdue",
    });
    expect(whyButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByText(/1 follow-up overdue and 1 without a next step/),
    ).not.toBeVisible();
    whyButton.focus();
    await user.keyboard("{Enter}");
    expect(whyButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/1 follow-up overdue and 1 without a next step/),
    ).toBeVisible();
    const outcomes = screen.getByRole("button", {
      name: /Outcomes and conversion/,
    });
    const activity = screen.getByRole("button", {
      name: /Activity and change/,
    });
    const followUp = screen.getByRole("button", {
      name: /Follow-up readiness/,
    });
    const workPreferences = screen.getByRole("button", {
      name: /Work preferences/,
    });
    for (const disclosure of [outcomes, activity, followUp, workPreferences]) {
      expect(disclosure).toHaveAttribute("aria-expanded", "false");
    }
    expect(
      screen.queryByRole("heading", {
        name: "Compared with the previous period",
      }),
    ).not.toBeInTheDocument();
    await user.click(outcomes);
    await user.click(activity);
    expect(outcomes).toHaveAttribute("aria-expanded", "true");
    expect(activity).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Average first response")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Compared with the previous period",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("+50 pp")).toHaveLength(2);
    await user.click(followUp);
    expect(
      screen.getByRole("link", { name: "Review active applications" }),
    ).toHaveAttribute("href", "/applications?view=ACTIVE");
    expect(screen.getByText("Small sample")).toBeVisible();
    await user.click(workPreferences);
    expect(screen.getByText("Hybrid")).toBeVisible();
    expect(
      screen.getByText("This dataset is descriptive, not predictive."),
    ).toBeVisible();
    expect(query.get("range")).toBe("30d");
    expect(query.get("source")).toBe("REFERRAL");

    await user.click(screen.getByRole("tab", { name: "Pipeline" }));
    expect(
      await screen.findByRole("heading", {
        name: "Manage your application pipeline",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Date range")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show stage")).toHaveValue("APPLIED");
    expect(screen.getAllByText("4 days in this stage")[0]).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Move…" })[0]).toBeVisible();
  });

  it("stages analytics filters and keeps URL-backed sections", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/analytics`, ({ request }) =>
        HttpResponse.json({
          range: new URL(request.url).searchParams.get("range") ?? "90d",
          filters: { status: null, source: null, work_mode: null },
          generated_at: "2026-08-12T13:00:00Z",
          summary: testDashboard.summary,
          rates: testDashboard.rates,
          status_breakdown: testDashboard.status_breakdown,
          submission_trend: testDashboard.submission_trend,
          funnel: [{ stage: "SUBMITTED", count: 2, rate: 1 }],
          stage_aging: [{ bucket: "0-7", count: 1 }],
          source_performance: [
            {
              source: "REFERRAL",
              submitted_count: 2,
              response_count: 1,
              response_rate: 0.5,
              interview_count: 1,
              interview_rate: 0.5,
              offer_count: 0,
              offer_rate: 0,
              sample_sufficient: false,
              application_share: 1,
              response_rate_delta_vs_overall: 0,
              interview_rate_delta_vs_overall: 0,
              recent: {
                submitted_count: 2,
                response_count: 1,
                response_rate: 0.5,
                interview_count: 1,
                interview_rate: 0.5,
                offer_count: 0,
                offer_rate: 0,
                previous_submitted_count: 1,
                previous_response_rate: 0,
                previous_interview_rate: 0,
                response_rate_delta: 0.5,
                interview_rate_delta: 0.5,
              },
              recent_sample_sufficient: false,
              signal: "LIMITED_DATA",
              guidance:
                "Track at least three submitted applications before comparing this source with confidence.",
            },
          ],
          source_period: {
            label: "Selected range",
            current_start: "2026-07-23",
            current_end: "2026-08-22",
            previous_start: "2026-06-22",
            previous_end: "2026-07-22",
          },
          source_summary: {
            submitted_count: 2,
            sufficient_for_strategy: false,
            top_volume: {
              source: "REFERRAL",
              submitted_count: 2,
              application_share: 1,
              response_rate: 0.5,
              response_rate_delta_vs_overall: 0,
            },
            strongest_response: null,
            recent_movement: null,
            concentration: {
              flagged: true,
              source: "REFERRAL",
              application_share: 1,
              threshold: 0.5,
              submitted_count: 2,
            },
          },
          work_mode_breakdown: [{ work_mode: "HYBRID", count: 2 }],
          average_days_to_first_response: 3.5,
          no_response_count: 1,
          period_comparison: {
            available: true,
            current_start: "2026-07-23",
            current_end: "2026-08-22",
            previous_start: "2026-06-22",
            previous_end: "2026-07-22",
            current: {
              submitted_count: 2,
              response_rate: 0.5,
              interview_rate: 0.5,
              offer_rate: 0,
              acceptance_rate: 0,
              average_days_to_first_response: 3.5,
            },
            previous: {
              submitted_count: 1,
              response_rate: 0,
              interview_rate: 0,
              offer_rate: 0,
              acceptance_rate: 0,
              average_days_to_first_response: null,
            },
            deltas: {
              submitted_count: 1,
              response_rate: 0.5,
              interview_rate: 0.5,
              offer_rate: 0,
              acceptance_rate: 0,
              average_days_to_first_response: null,
            },
          },
          follow_up_coverage: {
            active_count: 1,
            scheduled_count: 0,
            coverage_rate: 0,
            overdue_count: 0,
            due_today_count: 0,
            missing_count: 1,
          },
          insights: [
            {
              code: "BUILD_SAMPLE",
              category: "response",
              semantic_type: "observation",
              tone: "INFO",
              title: "Search Health is still building your picture",
              description: "Track more applications before judging rates.",
              evidence_summary: "2 submitted · trends begin at 5",
              evidence: "This view contains 2 submitted applications.",
              evidence_strength: "LIMITED",
              evidence_label: "Early signal",
              priority: 20,
              action: {
                kind: "ADD_APPLICATION",
                label: "Add application",
                parameters: {},
              },
            },
          ],
          disclaimer: "This dataset is descriptive, not predictive.",
        }),
      ),
    );
    const { user, router } = renderApp("/analytics?range=90d");
    expect(
      await screen.findByRole("heading", { name: "Your search at a glance" }),
    ).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Sources" }));
    expect(
      await screen.findByRole("heading", { name: "Source strategy" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Source strategy at a glance" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "View applications" })[0],
    ).toHaveAttribute("href", "/applications?view=ALL&source=REFERRAL");
    expect(router.state.location.search).toContain("section=sources");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Source"), "REFERRAL");
    expect(router.state.location.search).not.toContain("source=REFERRAL");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() =>
      expect(router.state.location.search).toContain("source=REFERRAL"),
    );
    expect(
      screen.getByRole("button", { name: "Remove Source: Referral" }),
    ).toBeVisible();
  });

  it("persists demo preferences with optimistic versioning", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...testSettings, ...body, version: 2 });
      }),
    );
    const { user } = renderApp("/settings");
    expect(
      await screen.findByRole("heading", { name: "Preferences" }),
    ).toBeVisible();
    await user.selectOptions(
      await screen.findByLabelText("Default dashboard range"),
      "90d",
    );
    await user.selectOptions(screen.getByLabelText("Color theme"), "LIGHT");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(
      await screen.findByText("Preferences saved for this demo workspace."),
    ).toBeVisible();
    expect(body).toMatchObject({
      expected_version: 1,
      default_dashboard_range: "90d",
      theme: "LIGHT",
    });
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("automatically persists the browser time zone for a new workspace", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, time_zone: "America/Chicago" }),
      ),
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...testSettings, ...body, version: 2 });
      }),
    );

    const browserTimeZone = "America/Los_Angeles";
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        timeZone: browserTimeZone,
      } as Intl.ResolvedDateTimeFormatOptions);

    renderApp("/settings", { autoDetectTimeZone: true });
    expect(
      await screen.findByRole("heading", { name: "Preferences" }),
    ).toBeVisible();
    await waitFor(() => {
      expect(body).toMatchObject({
        expected_version: 1,
        time_zone: browserTimeZone,
      });
    });
    expect(screen.getByLabelText("Time zone")).toHaveValue(browserTimeZone);
    resolvedOptions.mockRestore();
  });

  it("renders the unified settings and profile page without legacy sections", async () => {
    const { user } = renderApp("/settings?section=account");
    const save = await screen.findByRole("button", {
      name: "Save preferences",
    });
    expect(save).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Temporary by design" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Explore a candidate-owned account control center",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Settings sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Account preview" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Default dashboard range"),
      "90d",
    );
    expect(save).toBeEnabled();

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Jordan Morgan");
    await user.click(
      screen.getByRole("button", { name: "Save profile preview" }),
    );
    expect(
      await screen.findByText(
        "Profile preview updated locally. The demo identity is unchanged.",
      ),
    ).toBeVisible();
    expect(name).toHaveValue("Jordan Morgan");
    expect(screen.getByLabelText("Email address")).toBeDisabled();
  });

  it("downloads sample applications as CSV and hides account portability in the demo", async () => {
    server.use(
      http.get(
        `${API_ORIGIN}/api/v1/me/applications/export`,
        () =>
          new HttpResponse(
            "Company,Job Title,Status\r\nExport Labs,Engineer,DRAFT\r\n",
            {
              headers: {
                "Content-Type": "text/csv",
                "Content-Disposition":
                  'attachment; filename="hireflux-applications-2026-08-23.csv"',
              },
            },
          ),
      ),
    );
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const { user } = renderApp("/settings");
    expect(
      await screen.findByRole("heading", { name: "Data & privacy" }),
    ).toBeVisible();
    expect(screen.getByText("Export sample applications")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Export JSON" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(
      await screen.findByText(
        "Applications exported. The CSV file remains on your device only.",
      ),
    ).toBeVisible();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test");
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it("keeps the candidate workflow and provides safe interactive account previews", async () => {
    const { user } = renderApp("/settings");
    const workflowHeading = await screen.findByRole("heading", {
      name: "Your candidate workflow",
    });
    expect(workflowHeading).toBeVisible();
    const workflow = workflowHeading.closest("section");
    expect(workflow).not.toBeNull();
    if (!workflow)
      throw new Error("Candidate workflow section was not rendered.");
    expect(
      within(workflow).getByRole("link", { name: /Applications/ }),
    ).toHaveAttribute("href", "/applications");
    expect(
      within(workflow).getByRole("link", { name: /Interviews & notes/ }),
    ).toHaveAttribute("href", "/interviews");
    expect(
      within(workflow).getByRole("link", { name: /Analytics/ }),
    ).toHaveAttribute("href", "/analytics");
    expect(
      screen.queryByRole("radiogroup", { name: "Preview role" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Recruiter")).not.toBeInTheDocument();
    expect(screen.queryByText("Hiring manager")).not.toBeInTheDocument();
    expect(screen.queryByText("Administrator")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What would carry over?" }),
    ).toBeVisible();
    expect(screen.getByText("Applications and stages")).toBeVisible();
    expect(screen.getAllByText("Simulated preview").length).toBeGreaterThan(0);

    const digest = screen.getByRole("checkbox", {
      name: /Weekly search digest/,
    });
    expect(digest).toBeEnabled();
    expect(digest).not.toBeChecked();
    await user.click(digest);
    expect(digest).toBeChecked();
    expect(
      await screen.findByText(
        /Preview preferences saved for this demo workspace/,
      ),
    ).toBeVisible();
    expect(
      window.sessionStorage.getItem("hireflux-account-preview.v1"),
    ).toContain('"digest":true');
    expect(screen.getByText(/safe simulations only/)).toBeVisible();
  });

  it("previews account protection accessibly and restores its trigger", async () => {
    const { user } = renderApp("/settings");
    const trigger = await screen.findByRole("button", {
      name: "Explore account protection",
    });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Account protection" });
    expect(dialog).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByText("Simulated active sessions")).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Preview MFA setup" }),
    );
    expect(
      within(dialog).getByText(
        /No authenticator secret or persistent session was created/,
      ),
    ).toBeVisible();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Account protection" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("scopes simulated notification preferences to the current demo workspace", async () => {
    const first = renderApp("/settings");
    const digest = await screen.findByRole("checkbox", {
      name: /Weekly search digest/,
    });
    await first.user.click(digest);
    expect(digest).toBeChecked();
    first.unmount();

    const sameWorkspace = renderApp("/settings");
    expect(
      await screen.findByRole("checkbox", { name: /Weekly search digest/ }),
    ).toBeChecked();
    sameWorkspace.unmount();

    renderApp("/settings", {
      session: {
        access_token: "different.settings.preview.session.token.123456789",
        token_type: "Bearer",
        expires_at: "2099-08-11T12:00:00Z",
      },
    });
    expect(
      await screen.findByRole("checkbox", { name: /Weekly search digest/ }),
    ).not.toBeChecked();
  });

  it("persists header theme changes into authenticated workspace settings", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ...testSettings,
          theme: body.theme,
          version: 2,
        });
      }),
    );

    const { user } = renderApp("/dashboard");
    const toggle = await screen.findByRole("button", {
      name: "Switch to light mode",
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);

    await waitFor(() =>
      expect(body).toMatchObject({ expected_version: 1, theme: "LIGHT" }),
    );
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeVisible();
  });

  it("preserves dirty settings when a refreshed server value changes another field", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ...testSettings,
          theme: "LIGHT",
          version: 2,
        });
      }),
    );

    const { user, queryClient } = renderApp("/settings");
    const dashboardRange = await screen.findByLabelText(
      "Default dashboard range",
    );
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeVisible();
    await user.selectOptions(dashboardRange, "90d");
    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    await waitFor(() =>
      expect(body).toMatchObject({ expected_version: 1, theme: "LIGHT" }),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(["settings"])).toMatchObject({
        theme: "LIGHT",
      }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Default dashboard range")).toHaveValue(
        "90d",
      );
      expect(screen.getByLabelText("Color theme")).toHaveValue("LIGHT");
    });
    expect(
      screen.getByRole("button", { name: "Save preferences" }),
    ).toBeEnabled();
  });

  it("shows the selected interview in the saved workspace time zone and preserves its deep link", async () => {
    server.use(
      ...interviewContextHandlers(),
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({
          items: [makeWorkspaceInterview()],
          next_cursor: null,
        }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({
          ...testSettings,
          time_zone: "America/Los_Angeles",
        }),
      ),
    );

    renderApp("/interviews?interview=44444444-4444-4444-8444-444444444444");
    expect(
      await screen.findByRole("heading", { name: "Northstar Labs" }),
    ).toBeVisible();
    expect(screen.getByText("Aug 14, 2026, 8:00 AM")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Northstar Labs, Technical screen/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("link", { name: /Open full application/ }),
    ).toHaveAttribute(
      "href",
      "/applications/11111111-1111-4111-8111-111111111111?section=interviews&interview=44444444-4444-4444-8444-444444444444",
    );
  });

  it("groups the schedule by candidate chronology and switches the selected workspace", async () => {
    const today = new Date();
    today.setUTCHours(15, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);
    const secondId = "55555555-5555-4555-8555-555555555555";
    const items = [
      makeWorkspaceInterview({ scheduled_at: today.toISOString() }),
      makeWorkspaceInterview({
        interview_id: secondId,
        company_name: "Second Studio",
        job_title: "Design Systems Engineer",
        scheduled_at: tomorrow.toISOString(),
        interview_type: "HIRING_MANAGER",
      }),
    ];
    server.use(
      ...interviewContextHandlers(items),
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items, next_cursor: null }),
      ),
    );

    const { user } = renderApp("/interviews");
    expect(
      await screen.findByRole("heading", { name: "Your schedule" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tomorrow" })).toBeVisible();
    const second = screen.getByRole("button", {
      name: /Second Studio, Hiring manager/,
    });
    second.focus();
    await user.keyboard("{Enter}");
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: "Second Studio" }),
    ).toBeVisible();
  });

  it("presents preparation and multiple rounds as one interview journey", async () => {
    const completedRound = makeInterview({
      interview_id: "33333333-3333-4333-8333-333333333333",
      interview_type: "RECRUITER_CALL",
      status: "COMPLETED",
      scheduled_at: "2026-08-10T15:00:00Z",
      allowed_statuses: [],
    });
    const selectedRound = makeWorkspaceInterview({
      context: {
        application_status: "INTERVIEW",
        follow_up_date: null,
        follow_up_state: "NONE",
        workflow_state: "PREPARE",
        next_action: "PREPARE",
      },
    });
    server.use(
      ...interviewContextHandlers([completedRound, selectedRound]),
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items: [selectedRound], next_cursor: null }),
      ),
    );

    const { user } = renderApp("/interviews");
    expect(
      await screen.findByText(
        "Your next priority is preparing for Northstar Labs.",
      ),
    ).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Continue preparation" })[0],
    ).toBeVisible();
    expect(await screen.findByText("Round 2 of 2")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Interview process" }),
    ).toBeVisible();
    expect(screen.getByText("Round 1 · Recruiter call")).toBeVisible();
    await user.click(
      screen.getAllByRole("button", { name: "Continue preparation" })[0],
    );
    expect(
      screen.getByRole("dialog", { name: "Interview preparation" }),
    ).toBeVisible();
  });

  it("invalidates every dependent interview view after preparation changes", async () => {
    const selectedRound = makeWorkspaceInterview();
    let updateBody: Record<string, unknown> | null = null;
    server.use(
      ...interviewContextHandlers([selectedRound]),
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items: [selectedRound], next_cursor: null }),
      ),
      http.patch(
        `${API_ORIGIN}/api/v1/applications/:applicationId/interviews/:interviewId/workspace`,
        async ({ request }) => {
          updateBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeInterview({ version: 2, preparation_notes: "Architecture examples" }),
          );
        },
      ),
    );

    const { user, queryClient } = renderApp("/interviews");
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(
      (await screen.findAllByRole("button", { name: "Continue preparation" }))[0],
    );
    await user.type(
      screen.getByRole("textbox", {
        name: "Evidence stories and preparation notes",
      }),
      "Architecture examples",
    );
    await user.click(screen.getByRole("button", { name: "Save preparation" }));

    expect(await screen.findByText("Interview preparation saved.")).toBeVisible();
    expect(updateBody).toMatchObject({
      expected_version: 1,
      preparation_notes: "Architecture examples",
      debrief_complete: false,
    });
    for (const queryKey of [
      ["applications", selectedRound.application_id, "interviews", "rounds"],
      ["interviews", "upcoming"],
      ["interviews", "workspace"],
      ["applications", "detail", selectedRound.application_id, "activity"],
      ["dashboard"],
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
  });

  it("loads more chronology without replacing the selected interview", async () => {
    const cursors: Array<string | null> = [];
    server.use(
      ...interviewContextHandlers(),
      http.get(`${API_ORIGIN}/api/v1/interviews`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return cursor
          ? HttpResponse.json({
              items: [
                makeWorkspaceInterview({
                  interview_id: "66666666-6666-4666-8666-666666666666",
                  company_name: "Second Company",
                }),
              ],
              next_cursor: null,
            })
          : HttpResponse.json({
              items: [makeWorkspaceInterview()],
              next_cursor: "signed-next-cursor",
            });
      }),
    );

    const { user } = renderApp("/interviews");
    expect(
      await screen.findByRole("heading", { name: "Northstar Labs" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Load more schedule" }),
    );
    expect(
      await screen.findByRole("button", { name: /Second Company/ }),
    ).toBeVisible();
    expect(cursors).toEqual([null, "signed-next-cursor"]);
    expect(
      screen.getByRole("heading", { name: "Northstar Labs" }),
    ).toBeVisible();
  });

  it("adapts imminent and destructive actions without hiding safe cancellation", async () => {
    const imminent = makeWorkspaceInterview({
      context: {
        application_status: "INTERVIEW",
        follow_up_date: null,
        follow_up_state: "NONE",
        workflow_state: "IMMINENT",
        next_action: "JOIN_MEETING",
      },
    });
    server.use(
      ...interviewContextHandlers([imminent]),
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items: [imminent], next_cursor: null }),
      ),
    );
    const { user } = renderApp("/interviews");
    expect(
      await screen.findByText("Your interview is coming up soon"),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Join meeting/ })[0],
    ).toHaveAttribute("target", "_blank");
    await user.click(screen.getByText("More interview actions"));
    await user.click(screen.getByRole("button", { name: "Cancel interview" }));
    expect(screen.getByText("Cancel this interview?")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep interview" }));
    expect(
      screen.queryByText("Cancel this interview?"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel interview" }),
    ).toHaveFocus();
  });

  it("keeps completed debriefs and canceled rounds in expandable history", async () => {
    const completed = makeWorkspaceInterview({
      status: "COMPLETED",
      debrief_completed_at: "2026-08-14T18:00:00Z",
      allowed_statuses: [],
      context: {
        application_status: "INTERVIEW",
        follow_up_date: "2026-08-30",
        follow_up_state: "UPCOMING",
        workflow_state: "HISTORY",
        next_action: "OPEN_APPLICATION",
      },
    });
    const canceled = makeWorkspaceInterview({
      interview_id: "55555555-5555-4555-8555-555555555555",
      status: "CANCELED",
      allowed_statuses: [],
      context: {
        application_status: "REJECTED",
        follow_up_date: null,
        follow_up_state: "NONE",
        workflow_state: "CANCELED",
        next_action: "OPEN_APPLICATION",
      },
    });
    server.use(
      ...interviewContextHandlers([completed, canceled]),
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items: [completed, canceled], next_cursor: null }),
      ),
    );

    renderApp("/interviews");
    expect(await screen.findByText(/Nothing is upcoming/)).toBeVisible();
    const historySummary = screen
      .getByText(/Past interviews/)
      .closest("summary");
    expect(historySummary).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /Northstar Labs.*Completed/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Northstar Labs.*Canceled/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Debrief complete" }),
    ).toBeVisible();
  });

  it("manages application notes and schedules interviews without client-owned fields", async () => {
    const application = makeApplication();
    const notes: Array<Record<string, unknown>> = [];
    const interviews: Array<Record<string, unknown>> = [];
    let noteBody: Record<string, unknown> | null = null;
    let interviewBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, () =>
        HttpResponse.json({ items: notes, next_cursor: null }),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes/preview`, () =>
        HttpResponse.json({ items: notes.slice(-2).reverse(), total_count: notes.length }),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/notes`,
        async ({ request }) => {
          noteBody = (await request.json()) as Record<string, unknown>;
          const note = {
            note_id: "55555555-5555-4555-8555-555555555555",
            application_id: application.application_id,
            content: noteBody.content,
            created_at: "2026-08-12T13:00:00Z",
            updated_at: "2026-08-12T13:00:00Z",
            version: 1,
          };
          notes.push(note);
          return HttpResponse.json(note, { status: 201 });
        },
      ),
      http.get(
        `${API_ORIGIN}/api/v1/applications/:applicationId/interviews`,
        () => HttpResponse.json({ items: interviews, next_cursor: null }),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/interviews`,
        async ({ request }) => {
          interviewBody = (await request.json()) as Record<string, unknown>;
          const interview = makeInterview({
            interview_type: "FINAL",
            scheduled_at: String(interviewBody.scheduled_at),
          });
          interviews.push(interview);
          return HttpResponse.json(interview, { status: 201 });
        },
      ),
    );

    const { user } = renderApp(`/applications/${application.application_id}`);
    expect(
      await screen.findByRole("heading", { name: "Frontend Engineer" }),
    ).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Add note" }));
    await user.type(
      screen.getByLabelText("New note"),
      "Ask about the platform roadmap.",
    );
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(
      await screen.findByText("Ask about the platform roadmap."),
    ).toBeVisible();
    expect(noteBody).toEqual({ content: "Ask about the platform roadmap." });

    await user.click(
      await screen.findByRole("button", { name: "Schedule interview" }),
    );
    await user.selectOptions(screen.getByLabelText("Interview type"), "FINAL");
    fireEvent.change(screen.getByLabelText(/Date and time/), {
      target: { value: "2026-08-20T10:00" },
    });
    await user.type(screen.getByLabelText(/Location/), "Video call");
    await user.click(
      screen.getByRole("button", { name: "Schedule interview" }),
    );
    expect(await screen.findByText("Interview scheduled.")).toBeVisible();
    expect(interviewBody).toMatchObject({
      interview_type: "FINAL",
      duration_minutes: 60,
      location: "Video call",
    });
    expect(interviewBody).not.toHaveProperty("owner_user_id");
    expect(interviewBody).not.toHaveProperty("status");
  });
});
