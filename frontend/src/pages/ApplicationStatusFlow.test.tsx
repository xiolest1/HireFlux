import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("application status flow", () => {
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
});
