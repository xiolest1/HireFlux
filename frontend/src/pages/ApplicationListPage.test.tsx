import { delay, http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication, testSettings } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("ApplicationListPage", () => {
  it("preserves the Search Health follow-up deep link in requests and filter controls", async () => {
    let requestedFollowUp: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedFollowUp = new URL(request.url).searchParams.get("follow_up");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { user } = renderApp("/applications?view=ACTIVE&follow_up=NEEDS_ATTENTION");
    expect(
      await screen.findByRole(
        "button",
        { name: "Remove Follow-up: Needs attention filter" },
        { timeout: 3_000 },
      ),
    ).toBeVisible();
    expect(requestedFollowUp).toBe("NEEDS_ATTENTION");

    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(screen.getByLabelText("Follow-up planning")).toHaveValue("NEEDS_ATTENTION");
  });
  it("uses an accessible card-shaped skeleton for the initial load", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, async () => {
        await delay(300);
        return HttpResponse.json({ items: [makeApplication()], next_cursor: null });
      }),
    );

    renderApp();

    expect(
      await screen.findByRole("status", { name: "Loading applications…" }),
    ).toBeVisible();
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
  });

  it("provides a direct manage action on each application card", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [application], next_cursor: null }),
      ),
    );

    renderApp();

    const manageLink = await screen.findByRole("link", {
      name: "Manage Frontend Engineer application",
    });
    expect(manageLink).toHaveAttribute(
      "href",
      `/applications/${application.application_id}`,
    );
  });

  it("shows card update timestamps in the saved workspace time zone", async () => {
    const application = makeApplication({ updated_at: "2026-08-14T01:00:00Z" });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [application], next_cursor: null }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, time_zone: "America/Los_Angeles" }),
      ),
    );

    renderApp();

    expect(
      await screen.findByText("Updated Aug 13, 2026, 6:00 PM"),
    ).toBeVisible();
  });

  it("binds requests to the selected status, including Archived", async () => {
    let requestedStatus: string | null = null;
    let requestedView: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        const search = new URL(request.url).searchParams;
        requestedStatus = search.get("status");
        requestedView = search.get("view");
        return HttpResponse.json({
          items:
            requestedStatus === "ARCHIVED" || requestedStatus === "REJECTED"
              ? [
                  makeApplication({
                    status: requestedStatus,
                    allowed_transitions:
                      requestedStatus === "ARCHIVED" ? ["APPLIED"] : ["ARCHIVED"],
                  }),
                ]
              : [],
          next_cursor: null,
        });
      }),
    );

    const { user } = renderApp();
    expect(await screen.findByText("No applications yet")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Filter by status"), "ARCHIVED");
    expect(requestedStatus).toBeNull();
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedStatus).toBe("ARCHIVED");
    expect(requestedView).toBe("ARCHIVED");

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.selectOptions(screen.getByLabelText("Filter by status"), "REJECTED");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(requestedStatus).toBe("REJECTED");
      expect(requestedView).toBe("ALL");
    });
  });

  it("preserves an exact stage-age drill-down and exposes a removable filter", async () => {
    let requestedStageAge: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedStageAge = new URL(request.url).searchParams.get("stage_age");
        return HttpResponse.json({ items: [makeApplication()], next_cursor: null });
      }),
    );

    const { user, router } = renderApp(
      "/applications?view=ACTIVE&stage_age=15-30",
    );
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedStageAge).toBe("15-30");
    expect(
      screen.getByRole("button", { name: "Remove Stage age: 15–30 days filter" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Remove Stage age: 15–30 days filter" }),
    );
    await waitFor(() => expect(router.state.location.search).not.toContain("stage_age"));
  });

  it("adds a stage-age filter from the application filter drawer", async () => {
    let requestedStageAge: string | null = null;
    let requestedView: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        const search = new URL(request.url).searchParams;
        requestedStageAge = search.get("stage_age");
        requestedView = search.get("view");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { user } = renderApp("/applications?view=ACTIVE");
    expect(await screen.findByText("No applications yet")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Time in current stage"), "31+");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(requestedStageAge).toBe("31+");
      expect(requestedView).toBe("ACTIVE");
    });
  });

  it("removes stage-age from a non-active shared URL before requesting data", async () => {
    let requestedStageAge: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedStageAge = new URL(request.url).searchParams.get("stage_age");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { router } = renderApp("/applications?view=ALL&stage_age=15-30");

    expect(await screen.findByText("No applications yet")).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe("?view=ALL"));
    expect(requestedStageAge).toBeNull();
  });

  it("asks the server for the whole selected view without filtering the page locally", async () => {
    let requestedView: string | null = null;
    const archived = makeApplication({
      status: "ARCHIVED",
      allowed_transitions: ["APPLIED"],
    });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedView = new URL(request.url).searchParams.get("view");
        return HttpResponse.json({
          items: requestedView === "ALL" ? [archived] : [],
          next_cursor: null,
        });
      }),
    );

    const { user } = renderApp();
    expect(await screen.findByText("No applications yet")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedView).toBe("ALL");
  });

  it("deduplicates an application repeated across cursor pages", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (!cursor) {
          return HttpResponse.json({
            items: [makeApplication({ job_title: "Original title" })],
            next_cursor: "next-page",
          });
        }
        return HttpResponse.json({
          items: [
            makeApplication({ job_title: "Updated title", version: 2 }),
            makeApplication({
              application_id: "33333333-3333-4333-8333-333333333333",
              company_name: "Second Company",
              job_title: "Second role",
            }),
          ],
          next_cursor: null,
        });
      }),
    );

    const { user } = renderApp();
    expect(await screen.findByRole("link", { name: "Original title" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("link", { name: "Updated title" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Second role" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Original title" })).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "2 applications loaded"),
    ).toBeVisible();
  });

  it("keeps layout choice in the URL and exposes a semantic desktop table", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [makeApplication()], next_cursor: null }),
      ),
    );

    const { user, router } = renderApp();
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "List view" }));

    expect(router.state.location.search).toContain("layout=list");
    expect(screen.getByRole("table", { name: "Applications in compact list view" })).toBeInTheDocument();
  });

  it("traps filter focus and restores it after Escape", async () => {
    const { user } = renderApp();
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();
    const trigger = screen.getByRole("button", { name: "Filters" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Application filters" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close panel" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Application filters" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
