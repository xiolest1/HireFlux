import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { getDemoSession } from "../auth/sessionStore";
import { renderApp } from "../test/renderApp";
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
        name: "Keep every opportunity moving forward.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Start a demo workspace to explore the page."),
    ).toBeVisible();
  });

  it("launches an isolated demo and authenticates subsequent API requests", async () => {
    let authorization: string | null = null;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () =>
        HttpResponse.json(issuedSession, { status: 201 }),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { user } = renderApp("/", { withSession: false });
    await user.click(screen.getByRole("button", { name: "Explore the Demo" }));

    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();
    expect(authorization).toBe(`Bearer ${issuedSession.access_token}`);
    expect(getDemoSession()?.access_token).toBe(issuedSession.access_token);
  });

  it("confirms reset and replaces the current workspace", async () => {
    server.use(
      http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () =>
        HttpResponse.json(issuedSession, { status: 201 }),
      ),
    );
    const { user } = renderApp();
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(screen.getByRole("alertdialog", { name: "Reset this demo?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset workspace" }));

    expect(await screen.findByText("Demo workspace reset.")).toBeVisible();
    expect(getDemoSession()?.access_token).toBe(issuedSession.access_token);
  });

  it("contains focus in the reset dialog and restores it when closed", async () => {
    const { user } = renderApp();
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();

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
