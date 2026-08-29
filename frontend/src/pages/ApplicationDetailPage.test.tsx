import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("ApplicationDetailPage opportunity handoff", () => {
  it("consumes a primary-action intent once and restores focus on close", async () => {
    const application = makeApplication({
      follow_up_date: "2026-08-29",
      next_step_responsibility: "CANDIDATE",
      next_step_note: "Send portfolio",
      allowed_transitions: ["SCREENING", "REJECTED", "ARCHIVED"],
    });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
    );

    const { user, router } = renderApp({
      pathname: `/applications/${application.application_id}`,
      state: {
        applicationsOrigin: {
          returnTo: "/applications?view=ACTIVE&source=REFERRAL",
          intent: "RUN_PRIMARY_ACTION",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Manage next step" }),
    ).toBeVisible();
    expect(router.state.location.state).toEqual({
      applicationsOrigin: {
        returnTo: "/applications?view=ACTIVE&source=REFERRAL",
      },
    });
    expect(
      screen.getByRole("link", { name: "Back to applications" }),
    ).toHaveAttribute(
      "href",
      "/applications?view=ACTIVE&source=REFERRAL",
    );

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Manage next step" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Review next step" })).toHaveFocus();
  });

  it("keeps primary and secondary actions only in What’s next", async () => {
    const application = makeApplication({
      allowed_transitions: ["SCREENING", "REJECTED", "ARCHIVED"],
    });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
    );

    renderApp(`/applications/${application.application_id}`);

    expect(
      await screen.findByRole("heading", { name: "Keep this opportunity moving" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Move to Screening" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Review next step" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "More opportunity actions" })).toBeVisible();
  });

  it("places the opportunity action and journey before mobile section navigation", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
    );

    const { user } = renderApp(`/applications/${application.application_id}`);
    const nextAction = await screen.findByRole("heading", {
      name: "Keep this opportunity moving",
    });
    const journey = screen.getByRole("heading", { name: "Journey" });
    const jump = screen.getByRole("button", {
      name: "Jump to supporting sections",
    });

    expect(
      nextAction.compareDocumentPosition(journey) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      journey.compareDocumentPosition(jump) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(jump).toHaveAttribute("aria-expanded", "false");
    await user.click(jump);
    expect(jump).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("mobile-section-links")).toBeVisible();
  });

  it("rejects unsafe return state and uses the Applications fallback", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
    );

    renderApp({
      pathname: `/applications/${application.application_id}`,
      state: {
        applicationsOrigin: { returnTo: "https://example.com/applications" },
      },
    });

    expect(
      await screen.findByRole("link", { name: "Back to applications" }),
    ).toHaveAttribute("href", "/applications");
  });
});
