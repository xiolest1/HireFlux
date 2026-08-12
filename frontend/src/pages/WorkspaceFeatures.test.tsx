import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";
import {
  makeApplication,
  makeInterview,
  testDashboard,
  testSettings,
} from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";

describe("workspace milestone features", () => {
  it("answers the core dashboard questions and completes a due follow-up", async () => {
    const application = makeApplication({ version: 3, follow_up_date: "2026-08-11" });
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
        HttpResponse.json({ ...testSettings, time_zone: "America/Los_Angeles" }),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/follow-up/complete`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...application, follow_up_date: null, version: 4 });
      }),
    );

    const { user, queryClient } = renderApp("/dashboard");
    const analyticsKey = ["analytics", { range: "30d" }] as const;
    queryClient.setQueryData(analyticsKey, { seeded: true });
    expect(await screen.findByRole("heading", { name: "How many jobs am I pursuing?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "What needs my attention today?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "How successful has my search been?" })).toBeVisible();
    expect(screen.getByText("8 of 13 submitted applications")).toBeVisible();
    expect(screen.getByText(/Complete overdue follow-up.*Aug 11, 2026/)).toBeVisible();
    expect(
      screen.getByText(/Prepare for upcoming interview.*Aug 13, 2026, 6:00 PM/),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(await screen.findByText("Follow-up completed.")).toBeVisible();
    expect(body).toEqual({ expected_version: 3 });
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true);
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
          source_performance: [{ source: "REFERRAL", submitted_count: 2, response_count: 1, response_rate: 0.5, interview_count: 1, interview_rate: 0.5, offer_count: 0, offer_rate: 0, acceptance_count: 0, acceptance_rate: 0, sample_sufficient: false }],
          work_mode_breakdown: [{ work_mode: "HYBRID", count: 2 }],
          average_days_to_first_response: 3.5,
          no_response_count: 1,
          disclaimer: "This dataset is descriptive, not predictive.",
        });
      }),
    );

    renderApp("/analytics?range=30d&source=REFERRAL");
    expect(await screen.findByRole("heading", { name: "Outcome snapshot" })).toBeVisible();
    expect(screen.getByText("Small sample")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Work mode breakdown" })).toBeVisible();
    expect(screen.getByText("Hybrid", { selector: "span" })).toBeVisible();
    expect(screen.getByText("This dataset is descriptive, not predictive.")).toBeVisible();
    expect(query.get("range")).toBe("30d");
    expect(query.get("source")).toBe("REFERRAL");
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
    expect(await screen.findByRole("heading", { name: "Demo preferences" })).toBeVisible();
    await user.selectOptions(await screen.findByLabelText("Default dashboard range"), "90d");
    await user.selectOptions(screen.getByLabelText("Color theme"), "LIGHT");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByText("Preferences saved for this demo workspace.")).toBeVisible();
    expect(body).toMatchObject({ expected_version: 1, default_dashboard_range: "90d", theme: "LIGHT" });
    expect(document.documentElement).not.toHaveClass("dark");
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
    const toggle = await screen.findByRole("button", { name: "Switch to light mode" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);

    await waitFor(() =>
      expect(body).toMatchObject({ expected_version: 1, theme: "LIGHT" }),
    );
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  });

  it("shows upcoming interviews in the saved workspace time zone", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items: [makeInterview()] }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, time_zone: "America/Los_Angeles" }),
      ),
    );
    renderApp("/interviews");
    expect(await screen.findByRole("heading", { name: "Frontend Engineer" })).toBeVisible();
    expect(await screen.findByText("Aug 14, 2026, 8:00 AM")).toBeVisible();
    expect(screen.getByText("Technical screen")).toBeVisible();
    expect(screen.getByRole("link", { name: "View application" })).toHaveAttribute("href", "/applications/11111111-1111-4111-8111-111111111111");
  });

  it("manages application notes and schedules interviews without client-owned fields", async () => {
    const application = makeApplication();
    const notes: Array<Record<string, unknown>> = [];
    const interviews: Array<Record<string, unknown>> = [];
    let noteBody: Record<string, unknown> | null = null;
    let interviewBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(application)),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, () => HttpResponse.json({ items: notes })),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, async ({ request }) => {
        noteBody = (await request.json()) as Record<string, unknown>;
        const note = { note_id: "55555555-5555-4555-8555-555555555555", application_id: application.application_id, content: noteBody.content, created_at: "2026-08-12T13:00:00Z", updated_at: "2026-08-12T13:00:00Z", version: 1 };
        notes.push(note);
        return HttpResponse.json(note, { status: 201 });
      }),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/interviews`, () => HttpResponse.json({ items: interviews })),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/interviews`, async ({ request }) => {
        interviewBody = (await request.json()) as Record<string, unknown>;
        const interview = makeInterview({ interview_type: "FINAL", scheduled_at: String(interviewBody.scheduled_at) });
        interviews.push(interview);
        return HttpResponse.json(interview, { status: 201 });
      }),
    );

    const { user } = renderApp(`/applications/${application.application_id}`);
    expect(await screen.findByRole("heading", { name: "Frontend Engineer" })).toBeVisible();
    await user.type(screen.getByLabelText("New note"), "Ask about the platform roadmap.");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByText("Ask about the platform roadmap.")).toBeVisible();
    expect(noteBody).toEqual({ content: "Ask about the platform roadmap." });

    await user.click(screen.getByRole("button", { name: "Schedule interview" }));
    await user.selectOptions(screen.getByLabelText("Interview type"), "FINAL");
    fireEvent.change(screen.getByLabelText(/Date and time/), { target: { value: "2026-08-20T10:00" } });
    await user.type(screen.getByLabelText(/Location/), "Video call");
    await user.click(screen.getByRole("button", { name: "Schedule interview" }));
    expect(await screen.findByText("Interview scheduled.")).toBeVisible();
    expect(interviewBody).toMatchObject({ interview_type: "FINAL", duration_minutes: 60, location: "Video call" });
    expect(interviewBody).not.toHaveProperty("owner_user_id");
    expect(interviewBody).not.toHaveProperty("status");
  });
});
