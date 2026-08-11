import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("ApplicationListPage", () => {
  it("binds requests to the selected status, including Archived", async () => {
    let requestedStatus: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({
          items:
            requestedStatus === "ARCHIVED"
              ? [makeApplication({ status: "ARCHIVED", allowed_transitions: ["APPLIED"] })]
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
