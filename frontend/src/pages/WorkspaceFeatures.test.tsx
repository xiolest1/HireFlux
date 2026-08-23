import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "../test/renderApp";
import {
  makeApplication,
  makeInterview,
  testDashboard,
  testSettings,
  testUser,
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

  it("persists and dismisses the recruiter guide within the demo session", async () => {
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Three ways to explore HireFlux" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss recruiter tour" }));
    expect(screen.queryByRole("heading", { name: "Three ways to explore HireFlux" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("hireflux-recruiter-guide")).toContain('"dismissed":true');
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
          insights: [{ code: "BUILD_SAMPLE", tone: "INFO", title: "Build a stronger sample", description: "Track more applications before judging rates.", evidence: "This view contains 2 submitted applications.", action: { kind: "ADD_APPLICATION", label: "Add application", parameters: {} } }],
          disclaimer: "This dataset is descriptive, not predictive.",
        });
      }),
    );

    const { user } = renderApp("/analytics?range=30d&source=REFERRAL");
    expect(await screen.findByRole("heading", { name: "Outcome snapshot" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Search health" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Build a stronger sample" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Suggested action: Add application" })).toHaveAttribute(
      "href",
      "/applications/new",
    );
    expect(screen.getByRole("heading", { name: "Compared with the previous period" })).toBeVisible();
    expect(screen.getAllByText("+50 pp")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Follow-up coverage" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review active applications" })).toHaveAttribute(
      "href",
      "/applications?view=ACTIVE",
    );
    expect(screen.getByText("Small sample")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Work mode breakdown" })).toBeVisible();
    expect(screen.getByText("Hybrid", { selector: "span" })).toBeVisible();
    expect(screen.getByText("This dataset is descriptive, not predictive.")).toBeVisible();
    expect(query.get("range")).toBe("30d");
    expect(query.get("source")).toBe("REFERRAL");

    await user.click(screen.getByRole("tab", { name: "Pipeline" }));
    expect(
      await screen.findByRole("heading", {
        name: "Applications by time in their current stage",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/active applications in Applied, Screening, Interview, or Offer/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View applications aged 0–7 days (1 application)" }),
    ).toHaveAttribute("href", "/applications?view=ACTIVE&stage_age=0-7");
    expect(screen.getAllByText("No applications in this range")).toHaveLength(3);
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
          source_performance: [{ source: "REFERRAL", submitted_count: 2, response_count: 1, response_rate: 0.5, interview_count: 1, interview_rate: 0.5, offer_count: 0, offer_rate: 0, sample_sufficient: false }],
          work_mode_breakdown: [{ work_mode: "HYBRID", count: 2 }],
          average_days_to_first_response: 3.5,
          no_response_count: 1,
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
          insights: [{ code: "BUILD_SAMPLE", tone: "INFO", title: "Build a stronger sample", description: "Track more applications before judging rates.", evidence: "This view contains 2 submitted applications.", action: { kind: "ADD_APPLICATION", label: "Add application", parameters: {} } }],
          disclaimer: "This dataset is descriptive, not predictive.",
        }),
      ),
    );
    const { user, router } = renderApp("/analytics?range=90d");
    expect(await screen.findByRole("heading", { name: "Outcome snapshot" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Sources" }));
    expect(await screen.findByRole("heading", { name: "Source performance" })).toBeVisible();
    expect(router.state.location.search).toContain("section=sources");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Source"), "REFERRAL");
    expect(router.state.location.search).not.toContain("source=REFERRAL");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(router.state.location.search).toContain("source=REFERRAL"));
    expect(screen.getByRole("button", { name: "Remove Source: Referral" })).toBeVisible();
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
    expect(await screen.findByRole("heading", { name: "Preferences" })).toBeVisible();
    await user.selectOptions(await screen.findByLabelText("Default dashboard range"), "90d");
    await user.selectOptions(screen.getByLabelText("Color theme"), "LIGHT");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByText("Preferences saved for this demo workspace.")).toBeVisible();
    expect(body).toMatchObject({ expected_version: 1, default_dashboard_range: "90d", theme: "LIGHT" });
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
      .mockReturnValue({ timeZone: browserTimeZone } as Intl.ResolvedDateTimeFormatOptions);

    renderApp("/settings", { autoDetectTimeZone: true });
    expect(await screen.findByRole("heading", { name: "Preferences" })).toBeVisible();
    await waitFor(() => {
      expect(body).toMatchObject({ expected_version: 1, time_zone: browserTimeZone });
    });
    expect(screen.getByLabelText("Time zone")).toHaveValue(browserTimeZone);
    resolvedOptions.mockRestore();
  });

  it("renders the unified settings and profile page without legacy sections", async () => {
    const { user } = renderApp("/settings?section=account");
    const save = await screen.findByRole("button", { name: "Save preferences" });
    expect(save).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Temporary by design" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "What a registered account could unlock" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Settings sections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Account preview" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Default dashboard range"), "90d");
    expect(save).toBeEnabled();

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Jordan Morgan");
    await user.click(screen.getByRole("button", { name: "Save profile preview" }));
    expect(await screen.findByText("Profile preview updated locally. The demo identity is unchanged.")).toBeVisible();
    expect(name).toHaveValue("Jordan Morgan");
    expect(screen.getByLabelText("Email address")).toBeDisabled();
  });

  it("downloads an owner-scoped workspace export from the account preview", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/me/export`, () =>
        HttpResponse.json({
          export_version: 1,
          exported_at: "2026-08-22T13:00:00Z",
          profile: testUser,
          settings: testSettings,
          applications: [],
          activities: [],
          notes: [],
          interviews: [],
          counts: { applications: 0, activities: 0, notes: 0, interviews: 0 },
        }),
      ),
    );
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const { user } = renderApp("/settings");
    expect(await screen.findByRole("heading", { name: "Your data, under your control" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Download JSON" }));
    expect(await screen.findByText("Export downloaded. This file remains on your device only.")).toBeVisible();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test");
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it("keeps recruiter role local and blocks email notifications", async () => {
    const { user } = renderApp("/settings");
    expect(await screen.findByRole("heading", { name: "Role & access preview" })).toBeVisible();
    const recruiterRole = screen.getByRole("radio", { name: "Recruiter" });
    await user.click(recruiterRole);
    expect(recruiterRole).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Preview only · authorization unchanged")).toBeVisible();

    const digest = screen.getByRole("checkbox", { name: /Weekly search digest/ });
    expect(digest).toBeDisabled();
    expect(screen.getByText(/Notification preferences are intentionally blocked/)).toBeVisible();
    expect(screen.getByText(/Unavailable in this demo/)).toBeVisible();
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

  it("preserves dirty settings when a refreshed server value changes another field", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...testSettings, theme: "LIGHT", version: 2 });
      }),
    );

    const { user, queryClient } = renderApp("/settings");
    const dashboardRange = await screen.findByLabelText("Default dashboard range");
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeVisible();
    await user.selectOptions(dashboardRange, "90d");
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));

    await waitFor(() => expect(body).toMatchObject({ expected_version: 1, theme: "LIGHT" }));
    await waitFor(() => expect(queryClient.getQueryData(["settings"])).toMatchObject({ theme: "LIGHT" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
      expect(screen.getByLabelText("Color theme")).toHaveValue("LIGHT");
    });
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
  });

  it("shows upcoming interviews in the saved workspace time zone", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({ items: [makeInterview()], next_cursor: null }),
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

  it("groups upcoming interviews by the saved calendar day", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
        HttpResponse.json({
          items: [
            makeInterview({ interview_id: "44444444-4444-4444-8444-444444444444" }),
            makeInterview({
              interview_id: "55555555-5555-4555-8555-555555555555",
              job_title: "Design Systems Engineer",
              scheduled_at: "2026-08-15T18:00:00Z",
            }),
          ],
          next_cursor: null,
        }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, time_zone: "America/Los_Angeles" }),
      ),
    );

    renderApp("/interviews");
    expect(await screen.findByRole("heading", { name: /Friday, August 14/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /Saturday, August 15/ })).toBeVisible();
    expect(screen.getAllByText("1 conversation", { selector: "p" })).toHaveLength(2);
  });

  it("loads the next page of upcoming interviews", async () => {
    const cursors: Array<string | null> = [];
    server.use(
      http.get(`${API_ORIGIN}/api/v1/interviews`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return cursor
          ? HttpResponse.json({
              items: [
                makeInterview({
                  interview_id: "66666666-6666-4666-8666-666666666666",
                  job_title: "Second Interview",
                }),
              ],
              next_cursor: null,
            })
          : HttpResponse.json({
              items: [makeInterview()],
              next_cursor: "signed-next-cursor",
            });
      }),
    );

    const { user } = renderApp("/interviews");
    expect(await screen.findByRole("heading", { name: "Frontend Engineer" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Load more interviews" }));

    expect(await screen.findByRole("heading", { name: "Second Interview" })).toBeVisible();
    expect(cursors).toEqual([null, "signed-next-cursor"]);
    expect(screen.queryByRole("button", { name: "Load more interviews" })).not.toBeInTheDocument();
  });

  it("manages application notes and schedules interviews without client-owned fields", async () => {
    const application = makeApplication();
    const notes: Array<Record<string, unknown>> = [];
    const interviews: Array<Record<string, unknown>> = [];
    let noteBody: Record<string, unknown> | null = null;
    let interviewBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(application)),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, () => HttpResponse.json({ items: notes, next_cursor: null })),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, async ({ request }) => {
        noteBody = (await request.json()) as Record<string, unknown>;
        const note = { note_id: "55555555-5555-4555-8555-555555555555", application_id: application.application_id, content: noteBody.content, created_at: "2026-08-12T13:00:00Z", updated_at: "2026-08-12T13:00:00Z", version: 1 };
        notes.push(note);
        return HttpResponse.json(note, { status: 201 });
      }),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/interviews`, () => HttpResponse.json({ items: interviews, next_cursor: null })),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/interviews`, async ({ request }) => {
        interviewBody = (await request.json()) as Record<string, unknown>;
        const interview = makeInterview({ interview_type: "FINAL", scheduled_at: String(interviewBody.scheduled_at) });
        interviews.push(interview);
        return HttpResponse.json(interview, { status: 201 });
      }),
    );

    const { user } = renderApp(`/applications/${application.application_id}`);
    expect(await screen.findByRole("heading", { name: "Frontend Engineer" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Notes" }));
    await user.click(await screen.findByRole("button", { name: "Add note" }));
    await user.type(screen.getByLabelText("New note"), "Ask about the platform roadmap.");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("Ask about the platform roadmap.")).toBeVisible();
    expect(noteBody).toEqual({ content: "Ask about the platform roadmap." });

    await user.click(screen.getByRole("tab", { name: "Interviews" }));
    await user.click(await screen.findByRole("button", { name: "Schedule interview" }));
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
