import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication, testSettings } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("ApplicationListPage", () => {
  it("provides a direct edit action on each application card", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [application], next_cursor: null }),
      ),
    );

    renderApp();

    const editLink = await screen.findByRole("link", {
      name: "Edit Frontend Engineer application",
    });
    expect(editLink).toHaveAttribute(
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

    await user.selectOptions(screen.getByLabelText("Filter by status"), "ARCHIVED");

    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedStatus).toBe("ARCHIVED");
    expect(requestedView).toBe("ARCHIVED");

    await user.selectOptions(screen.getByLabelText("Filter by status"), "REJECTED");

    await waitFor(() => {
      expect(requestedStatus).toBe("REJECTED");
      expect(requestedView).toBe("ALL");
    });
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

    await user.selectOptions(screen.getByLabelText("Application view"), "ALL");

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
    expect(screen.getByText("2 applications loaded")).toBeVisible();
  });
});
