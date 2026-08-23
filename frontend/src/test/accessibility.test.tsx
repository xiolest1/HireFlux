import axe from "axe-core";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { makeApplication, testDashboard } from "./fixtures";
import { renderApp } from "./renderApp";
import { API_ORIGIN, server } from "./server";

async function expectNoAxeViolations(root: Element | Document = document) {
  const result = await axe.run(root, {
    rules: {
      // JSDOM does not calculate rendered colors or layout. Contrast remains
      // covered by the browser suite where computed styles are available.
      "color-contrast": { enabled: false },
    },
  });
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

function useAnalyticsFixture() {
  server.use(
    http.get(`${API_ORIGIN}/api/v1/analytics`, () =>
      HttpResponse.json({
        range: "90d",
        filters: { status: null, source: null, work_mode: null },
        generated_at: "2026-08-12T13:00:00Z",
        summary: testDashboard.summary,
        rates: testDashboard.rates,
        status_breakdown: testDashboard.status_breakdown,
        submission_trend: testDashboard.submission_trend,
        funnel: [{ stage: "SUBMITTED", count: 13, rate: 1 }],
        stage_aging: [{ bucket: "0-7", count: 2 }],
        source_performance: [
          {
            source: "REFERRAL",
            submitted_count: 3,
            response_count: 2,
            response_rate: 2 / 3,
            interview_count: 1,
            interview_rate: 1 / 3,
            offer_count: 0,
            offer_rate: 0,
            acceptance_count: 0,
            acceptance_rate: 0,
            sample_sufficient: true,
          },
        ],
        work_mode_breakdown: [{ work_mode: "HYBRID", count: 3 }],
        average_days_to_first_response: 3.5,
        no_response_count: 5,
        period_comparison: {
          available: true,
          current_start: "2026-07-23",
          current_end: "2026-08-22",
          previous_start: "2026-06-22",
          previous_end: "2026-07-22",
          current: { submitted_count: 2, response_rate: 0.5, interview_rate: 0.5, offer_rate: 0, acceptance_rate: 0, average_days_to_first_response: 3.5 },
          previous: { submitted_count: 1, response_rate: 0, interview_rate: 0, offer_rate: 0, acceptance_rate: 0, average_days_to_first_response: null },
          deltas: { submitted_count: 1, response_rate: 0.5, interview_rate: 0.5, offer_rate: 0, acceptance_rate: 0, average_days_to_first_response: null },
        },
        follow_up_coverage: { active_count: 1, scheduled_count: 0, coverage_rate: 0, overdue_count: 0, due_today_count: 0, missing_count: 1 },
        insights: [{ code: "BUILD_SAMPLE", category: "response", semantic_type: "observation", tone: "INFO", title: "Search Health is still building your picture", description: "Track more applications before judging rates.", evidence: "This view contains 2 submitted applications.", priority: 20, action: { kind: "ADD_APPLICATION", label: "Add application", parameters: {} } }],
        disclaimer: "This demo dataset is descriptive, not predictive.",
      }),
    ),
  );
}

describe("principal route accessibility", () => {
  it.each([
    ["landing", "/", false, "Keep every opportunity moving forward."],
    ["dashboard", "/dashboard", true, "Welcome back"],
    ["applications", "/applications", true, "Applications"],
    ["interviews", "/interviews", true, "Interviews"],
    ["settings", "/settings", true, "Settings & profile"],
  ])("has no automated violations on the %s route", async (_name, route, withSession, heading) => {
    renderApp(route, { withSession });
    expect(await screen.findByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expectNoAxeViolations();
  });

  it("has no automated violations on Analytics", async () => {
    useAnalyticsFixture();
    renderApp("/analytics");
    expect(await screen.findByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expectNoAxeViolations();
  });

  it("has no automated violations in an application workspace", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/${application.application_id}`, () =>
        HttpResponse.json(application),
      ),
    );
    renderApp(`/applications/${application.application_id}`);
    expect(
      await screen.findByRole("heading", { name: application.job_title, level: 1 }),
    ).toBeVisible();
    await expectNoAxeViolations();
  });
});

describe("overlay accessibility", () => {
  it("keeps the filter drawer free of automated violations", async () => {
    const { user } = renderApp("/applications");
    await screen.findByRole("heading", { name: "Applications", level: 1 });
    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(await screen.findByRole("dialog", { name: "Application filters" })).toBeVisible();
    await expectNoAxeViolations();
  });

  it("keeps the workspace More sheet free of automated violations", async () => {
    const { user } = renderApp("/dashboard");
    await screen.findByRole("heading", { name: "Welcome back", level: 1 });
    await user.click(screen.getByRole("button", { name: "More navigation" }));
    expect(await screen.findByRole("dialog", { name: "Workspace" })).toBeVisible();
    await expectNoAxeViolations();
  });

  it("keeps the reset confirmation free of automated violations", async () => {
    const { user } = renderApp("/dashboard");
    await screen.findByRole("heading", { name: "Welcome back", level: 1 });
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(await screen.findByRole("alertdialog", { name: "Reset this demo?" })).toBeVisible();
    await expectNoAxeViolations();
  });

  it("keeps the responsive status sheet free of automated violations", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/${application.application_id}`, () =>
        HttpResponse.json(application),
      ),
    );
    const { user } = renderApp(`/applications/${application.application_id}`);
    await screen.findByRole("heading", { name: application.job_title, level: 1 });
    await user.click(screen.getByRole("button", { name: "Change application status" }));
    expect(await screen.findByRole("dialog", { name: "Manage status" })).toBeVisible();
    await expectNoAxeViolations();
  });

  it("keeps the interview editor drawer free of automated violations", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/${application.application_id}`, () =>
        HttpResponse.json(application),
      ),
    );
    const { user } = renderApp(
      `/applications/${application.application_id}?tab=interviews`,
    );
    await screen.findByRole("heading", { name: "Interviews", level: 2 });
    await user.click(screen.getByRole("button", { name: "Schedule interview" }));
    expect(await screen.findByRole("dialog", { name: "Schedule interview" })).toBeVisible();
    await expectNoAxeViolations();
  });
});
