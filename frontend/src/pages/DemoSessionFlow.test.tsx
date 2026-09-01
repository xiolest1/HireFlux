import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { getDemoSession } from "../auth/sessionStore";
import { hasManualTimeZonePreference } from "../auth/timeZonePreference";
import { renderApp } from "../test/renderApp";
import { testDashboard, testSettings } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";

const issuedSession = {
  access_token: "new.demo.session.token.value.123456789",
  token_type: "Bearer",
  expires_at: "2099-08-12T12:00:00Z",
};

describe("demo workspace flow", () => {
  it("redirects a protected deep link to the public landing page", async () => {
    renderApp("/applications/new", { withSession: false });

    expect(
      await screen.findByRole("heading", {
        name: "Keep every opportunity connected to what comes next.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Start a demo workspace to explore the page."),
    ).toBeVisible();
    expect(
      screen.getByText(/Follow one coherent workflow across applications, interviews, notes, and analytics/),
    ).toBeVisible();
    expect(screen.queryByText(/Sixteen fictional opportunities/i)).toBeNull();
  });

  it("launches an isolated demo and authenticates subsequent API requests", async () => {
    let authorization: string | null = null;
    let idempotencyKey: string | null = null;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
        idempotencyKey = request.headers.get("Idempotency-Key");
        return HttpResponse.json(issuedSession, { status: 201 });
      }),
      http.get(`${API_ORIGIN}/api/v1/dashboard`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({
          range: "30d",
          generated_at: "2026-08-12T13:00:00Z",
          summary: { total_tracked: 16, active_pursuits: 7, drafts: 2, accepted: 1, rejected: 3, withdrawn: 1, archived: 1 },
          rates: { submitted_count: 13, response_count: 8, response_rate: 0.615, interview_count: 4, interview_rate: 0.308, offer_count: 2, offer_rate: 0.154, acceptance_count: 1, acceptance_rate: 0.077 },
          actions: [], upcoming_interviews: [], recent_applications: [], submission_trend: [], status_breakdown: [],
        });
      }),
    );

    const { user } = renderApp("/", { withSession: false });
    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(authorization).toBe(`Bearer ${issuedSession.access_token}`);
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(getDemoSession()?.access_token).toBe(issuedSession.access_token);
  });

  it("preserves the landing-page theme when entering a SYSTEM-preference demo", async () => {
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () =>
        HttpResponse.json(issuedSession, { status: 201 }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, theme: "SYSTEM" }),
      ),
    );

    const { user } = renderApp("/", { withSession: false });
    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(document.documentElement).not.toHaveClass("dark");

    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
  });

  it("confirms reset and replaces the current workspace", async () => {
    const idempotencyKeys: string[] = [];
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
        idempotencyKeys.push(request.headers.get("Idempotency-Key") ?? "");
        return HttpResponse.json(issuedSession, { status: 201 });
      }),
    );
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    window.sessionStorage.setItem("hireflux-search-tour", '{"dismissed":true}');
    window.sessionStorage.setItem("hireflux-recruiter-guide", '{"dismissed":true}');

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(screen.getByRole("alertdialog", { name: "Reset this demo?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));

    expect(await screen.findByText("Demo workspace reset.")).toBeVisible();
    expect(getDemoSession()?.access_token).toBe(issuedSession.access_token);
    expect(window.sessionStorage.getItem("hireflux-search-tour")).toBeNull();
    expect(window.sessionStorage.getItem("hireflux-recruiter-guide")).toBeNull();
    expect(hasManualTimeZonePreference()).toBe(false);

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));
    await screen.findByText("Demo workspace reset.");

    expect(idempotencyKeys).toHaveLength(2);
    expect(idempotencyKeys[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
  });

  it("preserves reset state and replaces a server-confirmed failed operation key", async () => {
    const idempotencyKeys: string[] = [];
    let attempts = 0;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
        idempotencyKeys.push(request.headers.get("Idempotency-Key") ?? "");
        attempts += 1;
        if (attempts > 1) return HttpResponse.json(issuedSession, { status: 201 });
        return HttpResponse.json(
          {
            error: {
              code: "RESET_FAILED",
              message: "The demo service is unavailable.",
              request_id: "reset-test",
            },
          },
          { status: 503 },
        );
      }),
    );
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent(
      "Unable to reset demo. Your existing demo workspace is still available. The demo service is unavailable.",
    );
    expect(error).toHaveFocus();
    expect(screen.getByRole("alertdialog", { name: "Reset this demo?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(hasManualTimeZonePreference()).toBe(true);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Demo workspace reset.")).toBeVisible();
    expect(idempotencyKeys).toHaveLength(2);
    expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
    expect(hasManualTimeZonePreference()).toBe(false);
  });

  it("detects and saves the browser time zone for the replacement workspace", async () => {
    let timeZoneUpdate: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () =>
        HttpResponse.json(issuedSession, { status: 201 }),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, time_zone: "UTC" }),
      ),
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        timeZoneUpdate = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...testSettings, ...timeZoneUpdate, version: 2 });
      }),
    );
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        timeZone: "America/Los_Angeles",
      } as Intl.ResolvedDateTimeFormatOptions);

    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(timeZoneUpdate).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));
    expect(await screen.findByText("Demo workspace reset.")).toBeVisible();
    await waitFor(() =>
      expect(timeZoneUpdate).toMatchObject({
        expected_version: 1,
        time_zone: "America/Los_Angeles",
      }),
    );
    resolvedOptions.mockRestore();
  });

  it("reuses one demo-start key after a lost response", async () => {
    const idempotencyKeys: string[] = [];
    let attempts = 0;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
        idempotencyKeys.push(request.headers.get("Idempotency-Key") ?? "");
        attempts += 1;
        if (attempts === 1) return HttpResponse.error();
        return HttpResponse.json(issuedSession, { status: 201 });
      }),
    );

    const { user } = renderApp("/", { withSession: false });
    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));
    expect(await screen.findByText(/HireFlux could not reach the API/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(idempotencyKeys).toHaveLength(2);
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  });

  it("reuses one demo-start key while the reserved workspace is provisioning", async () => {
    const idempotencyKeys: string[] = [];
    let attempts = 0;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
        idempotencyKeys.push(request.headers.get("Idempotency-Key") ?? "");
        attempts += 1;
        if (attempts > 1) return HttpResponse.json(issuedSession, { status: 201 });
        return HttpResponse.json(
          {
            error: {
              code: "DEMO_PROVISIONING_IN_PROGRESS",
              message: "Demo workspace provisioning is still in progress.",
              request_id: "provisioning-test",
            },
          },
          { status: 409 },
        );
      }),
    );

    const { user } = renderApp("/", { withSession: false });
    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));
    expect(await screen.findByText(/still in progress/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(idempotencyKeys).toHaveLength(2);
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  });

  it("abandons a failed reset key when the user closes the operation", async () => {
    const idempotencyKeys: string[] = [];
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
        idempotencyKeys.push(request.headers.get("Idempotency-Key") ?? "");
        return HttpResponse.json(
          {
            error: {
              code: "RESET_FAILED",
              message: "The demo service is unavailable.",
              request_id: "reset-abandon-test",
            },
          },
          { status: 503 },
        );
      }),
    );

    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reset demo");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reset demo");
    expect(idempotencyKeys).toHaveLength(2);
    expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
  });

  it("hides and clears the prior workspace while reset is creating a replacement", async () => {
    const oldDashboard = {
      ...testDashboard,
      summary: { ...testDashboard.summary, total_tracked: 17, drafts: 3 },
    };
    const newDashboard = {
      ...testDashboard,
      summary: { ...testDashboard.summary, total_tracked: 16, drafts: 2 },
    };
    let dashboardAuthorization: string | null = null;
    const releaseReset: { current: (() => void) | undefined } = { current: undefined };
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, async () => {
        await new Promise<void>((resolve) => {
          releaseReset.current = resolve;
        });
        return HttpResponse.json(issuedSession, { status: 201 });
      }),
      http.get(`${API_ORIGIN}/api/v1/dashboard`, ({ request }) => {
        dashboardAuthorization = request.headers.get("authorization");
        return HttpResponse.json(newDashboard);
      }),
    );

    const { user, queryClient } = renderApp("/dashboard");
    const dashboardKey = ["dashboard", "30d"] as const;
    const initialTotal = await screen.findByText("Total tracked");
    expect(within(initialTotal.parentElement!).getByText("16")).toBeVisible();
    queryClient.setQueryData(dashboardKey, oldDashboard);
    await waitFor(() =>
      expect(
        within(screen.getByText("Total tracked").parentElement!).getByText("17"),
      ).toBeVisible(),
    );

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));

    expect(screen.getByRole("alertdialog", { name: "Reset this demo?" })).toBeVisible();
    expect(screen.getByText("Preparing a fresh demo workspace...")).toBeVisible();
    expect(screen.queryByText("17")).not.toBeInTheDocument();
    expect(queryClient.getQueryData(dashboardKey)).toBeUndefined();

    await waitFor(() => expect(releaseReset.current).toEqual(expect.any(Function)));
    releaseReset.current?.();
    await screen.findByText("Demo workspace reset.");
    const totalTracked = (await screen.findByText("Total tracked")).parentElement!;
    await waitFor(() =>
      expect(within(totalTracked).getByText("16")).toBeVisible(),
    );
    await waitFor(() => {
      expect(queryClient.getQueryData(dashboardKey)).toEqual(newDashboard);
      expect(screen.queryByText("17")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("17")).not.toBeInTheDocument();
    expect(dashboardAuthorization).toBe(`Bearer ${issuedSession.access_token}`);
  });

  it("contains focus in the reset dialog and restores it when closed", async () => {
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();

    const resetTrigger = screen.getByRole("button", { name: "Reset demo" });
    await user.click(resetTrigger);
    const resetWorkspace = screen.getByRole("button", { name: "Reset workspace" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    await waitFor(() => expect(resetWorkspace).toHaveFocus());
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(resetWorkspace).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog", { name: "Reset this demo?" })).toBeNull();
    expect(resetTrigger).toHaveFocus();
  });
});
