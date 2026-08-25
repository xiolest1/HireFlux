import { delay, http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("adaptive application opportunity workspace", () => {
  it("uses an accessible detail skeleton and renders all workspace sections", async () => {
    const application = makeApplication();
    server.use(http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, async () => {
      await delay(150);
      return HttpResponse.json(application);
    }));
    renderApp(`/applications/${application.application_id}`);
    expect(await screen.findByRole("status", { name: "Loading application…" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: application.job_title })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Journey" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Opportunity details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Full activity" })).toBeVisible();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("translates legacy tabs and supports canonical same-page section links", async () => {
    const application = makeApplication();
    server.use(http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(application)));
    const { user, router } = renderApp(`/applications/${application.application_id}?tab=notes`);
    expect(await screen.findByRole("heading", { name: application.job_title })).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe("?section=notes"));
    await user.click(screen.getByRole("button", { name: "Interviews" }));
    expect(router.state.location.search).toBe("?section=interviews");
  });

  it("keeps the rejected-to-offer correction in More and sends the observed version", async () => {
    const initial = makeApplication({ status: "REJECTED", version: 4, allowed_transitions: ["OFFER", "ARCHIVED"] });
    let requestBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(initial)),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/status`, async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(makeApplication({ status: "OFFER", version: 5, allowed_transitions: ["REJECTED", "ARCHIVED"] }));
      }),
    );
    const { user } = renderApp(`/applications/${initial.application_id}`);
    expect(await screen.findByRole("heading", { name: initial.job_title })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "More opportunity actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Correct to Offer" }));
    expect(screen.getByRole("dialog", { name: "Move to Offer" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move to Offer" }));
    expect(await screen.findByText("Status changed to Offer.")).toBeVisible();
    expect(requestBody).toEqual({ status: "OFFER", expected_version: 4 });
  });

  it("confirms archive and restores only to the backend-provided status", async () => {
    const initial = makeApplication({ status: "APPLIED", version: 1, allowed_transitions: ["SCREENING", "ARCHIVED"] });
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(initial)),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/status`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        requests.push(body);
        return HttpResponse.json(body.status === "ARCHIVED"
          ? makeApplication({ status: "ARCHIVED", version: 2, allowed_transitions: ["APPLIED"] })
          : makeApplication({ status: "APPLIED", version: 3, allowed_transitions: ["SCREENING", "ARCHIVED"] }));
      }),
    );
    const { user } = renderApp(`/applications/${initial.application_id}`);
    await screen.findByRole("heading", { name: initial.job_title });
    await user.click(screen.getByRole("button", { name: "More opportunity actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive opportunity" }));
    expect(screen.getByRole("alertdialog", { name: "Archive this opportunity?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Archive opportunity" }));
    const restoreButtons = await screen.findAllByRole("button", { name: "Restore to applied" });
    await user.click(restoreButtons[0]);
    await user.click(screen.getByRole("button", { name: "Restore to Applied" }));
    expect(requests).toEqual([
      { status: "ARCHIVED", expected_version: 1 },
      { status: "APPLIED", expected_version: 2 },
    ]);
  });

  it("requests an applied date when restoring an archived later-stage record", async () => {
    const initial = makeApplication({ status: "ARCHIVED", applied_date: null, allowed_transitions: ["INTERVIEW"] });
    let requestBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(initial)),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/status`, async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(makeApplication({ status: "INTERVIEW", applied_date: "2026-08-10", version: 2, allowed_transitions: ["OFFER", "ARCHIVED"] }));
      }),
    );
    const { user } = renderApp(`/applications/${initial.application_id}`);
    const restoreButtons = await screen.findAllByRole("button", { name: "Restore to interview" });
    await user.click(restoreButtons[0]);
    expect(screen.getByLabelText(/Applied date/)).toBeVisible();
    await user.type(screen.getByLabelText(/Applied date/), "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Restore to Interview" }));
    expect(requestBody).toEqual({ status: "INTERVIEW", expected_version: 1, applied_date: "2026-08-10" });
  });
});
