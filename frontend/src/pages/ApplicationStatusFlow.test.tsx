import { delay, http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("application status flow", () => {
  it("uses accessible layout skeletons for the detail page and lazy resources", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, async () => {
        await delay(300);
        return HttpResponse.json(application);
      }),
      http.get(
        `${API_ORIGIN}/api/v1/applications/:applicationId/notes`,
        async () => {
          await delay(300);
          return HttpResponse.json({ items: [], next_cursor: null });
        },
      ),
    );

    const { user } = renderApp(`/applications/${application.application_id}`);
    expect(
      await screen.findByRole(
        "status",
        { name: "Loading application…" },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(await screen.findByRole("heading", { name: application.job_title })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Notes" }));
    expect(
      await screen.findByRole("status", { name: "Loading notes…" }),
    ).toBeVisible();
    expect(await screen.findByText("No notes yet")).toBeVisible();
  });

  it("keeps detail tabs in the URL, supports arrow keys, and loads panels on demand", async () => {
    const application = makeApplication();
    let notesRequests = 0;
    let interviewRequests = 0;
    let activityRequests = 0;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, () => {
        notesRequests += 1;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/interviews`, () => {
        interviewRequests += 1;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/activity`, () => {
        activityRequests += 1;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { user, router } = renderApp(
      `/applications/${application.application_id}`,
    );
    expect(await screen.findByRole("heading", { name: "Frontend Engineer" })).toBeVisible();
    expect(notesRequests).toBe(0);
    expect(interviewRequests).toBe(0);
    expect(activityRequests).toBe(0);

    const notesTab = screen.getByRole("tab", { name: "Notes" });
    await user.click(notesTab);
    expect(await screen.findByText("No notes yet")).toBeVisible();
    expect(notesRequests).toBe(1);
    expect(router.state.location.search).toBe("?tab=notes");

    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("No interviews recorded")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Interviews" })).toHaveFocus();
    expect(interviewRequests).toBe(1);
    expect(activityRequests).toBe(0);
    expect(router.state.location.search).toBe("?tab=interviews");
  });

  it("allows a rejected application to be corrected to Offer", async () => {
    const initial = makeApplication({
      status: "REJECTED",
      version: 4,
      allowed_transitions: ["OFFER", "ARCHIVED"],
    });
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(initial),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/status`,
        async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeApplication({
              status: "OFFER",
              version: 5,
              allowed_transitions: ["REJECTED", "ARCHIVED"],
            }),
          );
        },
      ),
    );

    const { user, queryClient } = renderApp(
      "/applications/11111111-1111-4111-8111-111111111111",
    );
    const dashboardKey = ["dashboard", "30d"] as const;
    const analyticsKey = ["analytics", { range: "30d" }] as const;
    queryClient.setQueryData(dashboardKey, { seeded: true });
    queryClient.setQueryData(analyticsKey, { seeded: true });
    expect(
      await screen.findByRole("heading", { name: "Frontend Engineer" }),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("New status"), "OFFER");
    await user.click(screen.getByRole("button", { name: "Move to Offer" }));

    expect(await screen.findByText("Status changed to Offer.")).toBeVisible();
    expect(requestBody).toEqual({ status: "OFFER", expected_version: 4 });
    expect(queryClient.getQueryState(dashboardKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true);
  });

  it("archives and restores to the exact backend-provided prior status", async () => {
    const initial = makeApplication({
      status: "APPLIED",
      version: 1,
      allowed_transitions: ["INTERVIEW", "ARCHIVED"],
    });
    const requests: Array<Record<string, unknown>> = [];

    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(initial),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/status`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          requests.push(body);
          if (body.status === "ARCHIVED") {
            return HttpResponse.json(
              makeApplication({
                status: "ARCHIVED",
                version: 2,
                allowed_transitions: ["APPLIED"],
              }),
            );
          }
          return HttpResponse.json(
            makeApplication({
              status: "APPLIED",
              version: 3,
              allowed_transitions: ["INTERVIEW", "ARCHIVED"],
            }),
          );
        },
      ),
    );

    const { user } = renderApp(
      "/applications/11111111-1111-4111-8111-111111111111",
    );
    expect(
      await screen.findByRole("heading", { name: "Frontend Engineer" }),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("New status"), "ARCHIVED");
    await user.click(screen.getByRole("button", { name: "Archive application" }));

    expect(await screen.findByText("This application is archived.")).toBeVisible();
    expect(screen.getByRole("option", { name: "Restore to Applied" })).toBeVisible();

    await user.selectOptions(screen.getByLabelText("New status"), "APPLIED");
    await user.click(screen.getByRole("button", { name: "Restore to Applied" }));

    expect(await screen.findByText("Status changed to Applied.")).toBeVisible();
    expect(requests).toEqual([
      { status: "ARCHIVED", expected_version: 1 },
      { status: "APPLIED", expected_version: 2 },
    ]);
  });

  it("asks for an applied date before restoring an invalid archived later-stage record", async () => {
    const initial = makeApplication({
      status: "ARCHIVED",
      applied_date: null,
      allowed_transitions: ["INTERVIEW"],
    });
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(initial),
      ),
      http.post(
        `${API_ORIGIN}/api/v1/applications/:applicationId/status`,
        async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeApplication({
              status: "INTERVIEW",
              applied_date: "2026-08-10",
              version: 2,
              allowed_transitions: ["OFFER", "ARCHIVED"],
            }),
          );
        },
      ),
    );

    const { user } = renderApp(
      "/applications/11111111-1111-4111-8111-111111111111",
    );
    expect(
      await screen.findByRole("heading", { name: "Frontend Engineer" }),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("New status"), "INTERVIEW");
    expect(screen.getByLabelText("New status")).toHaveValue("INTERVIEW");
    expect(screen.getByLabelText(/Applied date/)).toBeVisible();
    await user.type(screen.getByLabelText(/Applied date/), "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Restore to Interview" }));

    expect(await screen.findByText("Status changed to Interview.")).toBeVisible();
    expect(requestBody).toEqual({
      status: "INTERVIEW",
      expected_version: 1,
      applied_date: "2026-08-10",
    });
  });
});
