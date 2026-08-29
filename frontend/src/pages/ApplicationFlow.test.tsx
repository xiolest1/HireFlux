import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication, makeActivity } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { applicationCreateRouteState } from "../features/applications/createNavigation";

const dashboardKey = ["dashboard", "30d"] as const;
const analyticsKey = ["analytics", { range: "30d" }] as const;

describe("application critical flow", () => {
  it("advances from Company to Role with Enter", async () => {
    const { user } = renderApp("/applications/new");
    const company = await screen.findByLabelText(/Company/);

    await user.type(company, "Acme{Enter}");

    expect(screen.getByLabelText(/Role/)).toHaveFocus();
  });

  it("opens More details and focuses a hidden invalid control", async () => {
    const { user } = renderApp("/applications/new");
    const optionalLabel = await screen.findByText("More details");
    const optionalDetails = optionalLabel.closest("details");
    expect(optionalDetails).not.toHaveAttribute("open");

    await user.type(screen.getByLabelText(/Company/), "Acme");
    await user.type(screen.getByLabelText(/Role/), "Platform Engineer");

    await user.click(optionalLabel.closest("summary") as HTMLElement);
    expect(optionalDetails).toHaveAttribute("open");
    const description = screen.getByLabelText(/Job description/);
    fireEvent.change(description, {
      target: { value: "x".repeat(5001) },
    });
    await user.click(optionalLabel.closest("summary") as HTMLElement);
    expect(optionalDetails).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    expect(await screen.findByText("Description must be 5000 characters or fewer.")).toBeVisible();
    await waitFor(() => expect(description).toHaveFocus());
    expect(optionalDetails).toHaveAttribute("open");
    expect(screen.queryByText("Review the highlighted fields.")).toBeNull();
  });

  it("adapts and preserves the applied date while switching stages", async () => {
    const { user } = renderApp("/applications/new");
    await screen.findByLabelText(/Company/);

    await user.click(screen.getByLabelText("Interviewing"));
    const appliedDate = screen.getByLabelText(/Applied on/);
    expect(appliedDate).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Today" }));
    const today = (appliedDate as HTMLInputElement).value;
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await user.click(screen.getByLabelText("Saved"));
    expect(screen.queryByLabelText(/Applied on/)).toBeNull();
    await user.click(screen.getByLabelText("Applied"));
    expect(screen.getByLabelText(/Applied on/)).toHaveValue(today);
  });

  it("warns before abandoning an unfinished quick capture", async () => {
    const { user } = renderApp("/applications/new");
    await user.type(await screen.findByLabelText(/Company/), "Unfinished Co");
    const backLink = screen.getByRole("link", { name: "Back to applications" });
    await user.click(backLink);

    expect(
      screen.getByRole("alertdialog", {
        name: "Leave without adding this application?",
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(backLink).toHaveFocus();
    expect(screen.getByLabelText(/Company/)).toHaveValue("Unfinished Co");
  });

  it("uses natural source and remote-location labels in More details", async () => {
    const { user } = renderApp("/applications/new");
    await user.click((await screen.findByText("More details")).closest("summary") as HTMLElement);

    await user.selectOptions(
      screen.getByLabelText("Where did you find this job?"),
      "RECRUITER",
    );
    expect(screen.getByLabelText(/Recruiter name/)).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Work arrangement"), "REMOTE");
    expect(screen.getByLabelText(/Location restriction/)).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText("Where did you find this job?"),
      "COMPANY_WEBSITE",
    );
    expect(screen.queryByLabelText(/Recruiter name/)).toBeNull();
  });

  it("validates and creates an applied application without client-owned fields", async () => {
    let postedBody: Record<string, unknown> | null = null;
    let postCount = 0;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/applications`, async ({ request }) => {
        postCount += 1;
        postedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeApplication({
            company_name: String(postedBody.company_name),
            job_title: String(postedBody.job_title),
            status: "APPLIED",
            applied_date: String(postedBody.applied_date),
          }),
          { status: 201 },
        );
      }),
      http.get(
        `${API_ORIGIN}/api/v1/applications/:applicationId/activity`,
        () => HttpResponse.json({ items: [makeActivity()], next_cursor: null }),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () =>
        HttpResponse.json({
          generated_at: "2026-08-27T14:00:00Z",
          groups: {
            needs_action: { total_count: 0, items: [], next_cursor: null },
            moving_forward: { total_count: 0, items: [], next_cursor: null },
            waiting: { total_count: 0, items: [], next_cursor: null },
          },
        }),
      ),
    );

    const { user, queryClient } = renderApp();
    queryClient.setQueryData(dashboardKey, { seeded: true });
    queryClient.setQueryData(analyticsKey, { seeded: true });
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();

    await user.click(screen.getAllByRole("link", { name: "Add application" })[0]);
    await user.click(await screen.findByRole("button", { name: "Add application" }));

    expect(await screen.findByText("Company name is required.")).toBeVisible();
    expect(screen.getByText("Job title is required.")).toBeVisible();
    expect(postCount).toBe(0);

    await user.type(screen.getByLabelText(/Company/), "Beacon Works");
    await user.type(screen.getByLabelText(/Role/), "Product Engineer");
    await user.click(screen.getByLabelText("Applied"));
    const appliedDate = screen.getByLabelText(/Applied on/);
    expect(appliedDate).not.toHaveValue("");
    await user.clear(appliedDate);
    await user.type(appliedDate, "2026-08-09");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();
    expect(screen.getByText("Product Engineer at Beacon Works was added.")).toBeVisible();
    expect(postCount).toBe(1);
    expect(postedBody).toMatchObject({
      company_name: "Beacon Works",
      job_title: "Product Engineer",
      status: "APPLIED",
      applied_date: "2026-08-09",
      work_mode: null,
    });
    expect(postedBody).not.toHaveProperty("follow_up_date");
    expect(postedBody).not.toHaveProperty("role_family");
    expect(postedBody).not.toHaveProperty("owner_user_id");
    expect(postedBody).not.toHaveProperty("version");
    expect(queryClient.getQueryState(dashboardKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true);
  });

  it("shows duplicate advice without blocking creation when lookup later fails", async () => {
    const candidate = makeApplication({
      company_name: "Beacon Works",
      job_title: "Product Engineer",
    });
    let lookupCount = 0;
    let createCount = 0;
    server.use(
      http.post(
        `${API_ORIGIN}/api/v1/applications/duplicate-candidates`,
        () => {
          lookupCount += 1;
          if (lookupCount > 1) {
            return HttpResponse.json(
              { error: { code: "UNAVAILABLE", message: "Try later", request_id: "request-1" } },
              { status: 503 },
            );
          }
          return HttpResponse.json({
            candidates: [
              {
                application_id: candidate.application_id,
                company_name: candidate.company_name,
                job_title: candidate.job_title,
                status: candidate.status,
                applied_date: candidate.applied_date,
                created_at: candidate.created_at,
                confidence: "HIGH",
                matched_on: ["COMPANY", "TITLE"],
              },
            ],
          });
        },
      ),
      http.post(`${API_ORIGIN}/api/v1/applications`, async ({ request }) => {
        createCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeApplication({
            company_name: String(body.company_name),
            job_title: String(body.job_title),
          }),
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/applications/new");
    await user.type(await screen.findByLabelText(/Company/), "Beacon Works");
    await user.type(screen.getByLabelText(/Role/), "Product Engineer");

    expect(await screen.findByText("You may already be tracking this role", {}, { timeout: 1500 })).toBeVisible();
    const match = screen.getByRole("link", { name: /Product Engineer at Beacon Works/ });
    expect(match).toHaveAttribute("target", "_blank");

    await user.type(screen.getByLabelText(/Role/), " II");
    expect(screen.queryByText("You may already be tracking this role")).toBeNull();
    await waitFor(() => expect(lookupCount).toBe(2), { timeout: 1500 });
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add application" }));

    expect(createCount).toBe(1);
    expect(await screen.findByText(/The form is ready for another opportunity/)).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText(/Company/)).toHaveFocus());
    expect(screen.getByLabelText(/Company/)).toHaveValue("");
  });

  it("cancels an obsolete duplicate lookup so a stale response cannot replace newer advice", async () => {
    const oldCandidate = makeApplication({
      application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      company_name: "Race Co",
      job_title: "Old Role",
    });
    const currentCandidate = makeApplication({
      application_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      company_name: "Race Co",
      job_title: "Current Role",
    });
    let oldRequestStarted = false;
    let oldRequestAborted = false;
    server.use(
      http.post(
        `${API_ORIGIN}/api/v1/applications/duplicate-candidates`,
        async ({ request }) => {
          const body = (await request.json()) as { job_title?: string };
          if (body.job_title === "Old Role") {
            oldRequestStarted = true;
            request.signal.addEventListener("abort", () => {
              oldRequestAborted = true;
            });
            await new Promise((resolve) => window.setTimeout(resolve, 900));
            return HttpResponse.json({
              candidates: [duplicateCandidate(oldCandidate)],
            });
          }
          return HttpResponse.json({
            candidates: [duplicateCandidate(currentCandidate)],
          });
        },
      ),
    );
    const { user } = renderApp("/applications/new");
    await user.type(await screen.findByLabelText(/Company/), "Race Co");
    const role = screen.getByLabelText(/Role/);
    await user.type(role, "Old Role");
    await waitFor(() => expect(oldRequestStarted).toBe(true), { timeout: 1500 });

    await user.clear(role);
    await user.type(role, "Current Role");
    expect(
      await screen.findByRole("link", { name: /Current Role at Race Co/ }, { timeout: 1500 }),
    ).toBeVisible();
    await waitFor(() => expect(oldRequestAborted).toBe(true));
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    expect(screen.queryByRole("link", { name: /Old Role at Race Co/ })).toBeNull();
  });

  it("returns to the filtered Applications context with a reliable summary and highlight", async () => {
    const created = makeApplication({
      company_name: "Context Co",
      job_title: "Context Engineer",
      status: "INTERVIEW",
      applied_date: "2026-08-01",
    });
    server.use(
      http.post(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json(created, { status: 201 }),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [created], next_cursor: null }),
      ),
    );
    const returnTo = "/applications?view=active&status=INTERVIEW";
    const { user, router } = renderApp({
      pathname: "/applications/new",
      state: applicationCreateRouteState(
        "applications",
        "/applications",
        "?view=active&layout=list&status=INTERVIEW",
      ),
    });
    await user.type(await screen.findByLabelText(/Company/), "Context Co");
    await user.type(screen.getByLabelText(/Role/), "Context Engineer");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    await waitFor(() => expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(returnTo));
    expect(await screen.findByText("Context Engineer at Context Co was added.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View application" })).toHaveAttribute(
      "href",
      `/applications/${created.application_id}`,
    );
    const contextLink = await screen.findByRole("link", { name: "Context Engineer" });
    expect(contextLink.closest("li")).toHaveClass("bg-surface-selected");
  });

  it("returns a Dashboard-origin creation to Dashboard with a View link", async () => {
    const created = makeApplication({ company_name: "Dashboard Co", job_title: "Designer" });
    server.use(
      http.post(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json(created, { status: 201 }),
      ),
    );
    const { user, router } = renderApp({
      pathname: "/applications/new",
      state: applicationCreateRouteState("dashboard", "/dashboard", ""),
    });
    await user.type(await screen.findByLabelText(/Company/), "Dashboard Co");
    await user.type(screen.getByLabelText(/Role/), "Designer");
    await user.click(screen.getByRole("button", { name: "Add application" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(await screen.findByText("Designer at Dashboard Co was added.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View application" })).toHaveAttribute(
      "href",
      `/applications/${created.application_id}`,
    );
  });

  it("edits details with the current version and never sends status", async () => {
    const application = makeApplication({ version: 7 });
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.patch(
        `${API_ORIGIN}/api/v1/applications/:applicationId`,
        async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeApplication({
              company_name: String(patchBody.company_name),
              version: 8,
            }),
          );
        },
      ),
    );

    const { user, queryClient } = renderApp(
      "/applications/11111111-1111-4111-8111-111111111111/edit",
    );
    queryClient.setQueryData(dashboardKey, { seeded: true });
    queryClient.setQueryData(analyticsKey, { seeded: true });
    const nestedInterviewsKey = [
      "applications",
      application.application_id,
      "interviews",
    ] as const;
    const globalInterviewsKey = ["interviews", "upcoming"] as const;
    queryClient.setQueryData(nestedInterviewsKey, { seeded: true });
    queryClient.setQueryData(globalInterviewsKey, { seeded: true });
    const companyInput = await screen.findByLabelText(/Company name/);
    await user.clear(companyInput);
    await user.type(companyInput, "Updated Company");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Application details updated.")).toBeVisible();
    expect(screen.getByText("Updated Company")).toBeVisible();
    expect(patchBody).toMatchObject({
      company_name: "Updated Company",
      expected_version: 7,
    });
    expect(patchBody).not.toHaveProperty("status");
    expect(patchBody).not.toHaveProperty("owner_user_id");
    expect(queryClient.getQueryState(dashboardKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(nestedInterviewsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(globalInterviewsKey)?.isInvalidated).toBe(true);
  });

  it("warns before abandoning an edited form", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(makeApplication()),
      ),
    );
    const { user } = renderApp(
      "/applications/11111111-1111-4111-8111-111111111111/edit",
    );
    const companyInput = await screen.findByLabelText(/Company name/);
    await user.type(companyInput, " changed");
    const backLink = screen.getByRole("link", { name: /Back to application/ });
    await user.click(backLink);

    expect(
      screen.getByRole("alertdialog", { name: "Leave without saving?" }),
    ).toBeVisible();
    const keepEditing = screen.getByRole("button", { name: "Keep editing" });
    const leavePage = screen.getByRole("button", { name: "Leave page" });
    await waitFor(() => expect(keepEditing).toHaveFocus());
    await user.tab();
    expect(leavePage).toHaveFocus();
    await user.tab();
    expect(keepEditing).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog", { name: "Leave without saving?" })).toBeNull();
    expect(backLink).toHaveFocus();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  it("focuses the canonical next-step planner from an interview journey link", async () => {
    const application = makeApplication({ status: "INTERVIEW" });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
    );

    renderApp(
      `/applications/${application.application_id}/edit?focus=follow_up`,
    );
    const nextStep = await screen.findByRole("radio", {
      name: "I need to do something",
    });
    await waitFor(() => expect(nextStep).toHaveFocus());
  });

  it("records candidate responsibility and check-back timing through the canonical command", async () => {
    const application = makeApplication({ status: "INTERVIEW", version: 4 });
    let postedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/next-step`,
        async ({ request }) => {
          postedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...application,
            version: 5,
            next_step_responsibility: "CANDIDATE",
            next_step_note: "Send the requested portfolio examples.",
            follow_up_date: "2026-08-28",
          });
        },
      ),
    );

    const { user } = renderApp(
      `/applications/${application.application_id}/edit?focus=follow_up`,
    );
    await user.click(await screen.findByRole("radio", { name: "I need to do something" }));
    await user.type(
      screen.getByLabelText(/What do you need to do/),
      "Send the requested portfolio examples.",
    );
    await user.type(
      screen.getByLabelText(/When should this return to your attention/),
      "2026-08-28",
    );
    await user.click(screen.getByRole("button", { name: "Save next step" }));

    await waitFor(() =>
      expect(postedBody).toEqual({
        expected_version: 4,
        next_step_responsibility: "CANDIDATE",
        next_step_note: "Send the requested portfolio examples.",
        follow_up_date: "2026-08-28",
      }),
    );
  });
});

function duplicateCandidate(application: ReturnType<typeof makeApplication>) {
  return {
    application_id: application.application_id,
    company_name: application.company_name,
    job_title: application.job_title,
    status: application.status,
    applied_date: application.applied_date,
    created_at: application.created_at,
    confidence: "HIGH",
    matched_on: ["COMPANY", "TITLE"],
  };
}
