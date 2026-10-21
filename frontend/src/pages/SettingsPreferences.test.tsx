import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../test/renderApp";
import { testSettings } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";
import { clearManualTimeZonePreference, hasManualTimeZonePreference } from "../auth/timeZonePreference";
import { WorkspaceSessionProvider } from "../auth/WorkspaceSessionProvider";
import { WorkspaceSessionController } from "../auth/workspaceSessionController";
import { createDemoAdapter } from "../auth/sessionAdapters";
import { saveDemoSession } from "../auth/sessionStore";
import { useWorkspaceSession } from "../auth/workspaceSessionContext";
import { useSettings, useUpdateSettings } from "../features/resources/queries";
import type { UpdateSettingsRequest } from "../api/resources";
import type { AdapterWorkspace, SessionAdapter } from "../auth/sessionAdapters";
import type { WorkspaceBootstrap } from "../api/workspaceBootstrap";
import { testUser } from "../test/fixtures";

beforeEach(() => {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ timeZone: "UTC" } as Intl.ResolvedDateTimeFormatOptions);
});

describe("Settings preference changes", () => {
  it("sends only changed fields without turning an unrelated save into a manual timezone", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...testSettings, ...body, version: 2 });
    }));
    const { user } = renderApp("/settings");
    await screen.findByLabelText("Default dashboard range");
    clearManualTimeZonePreference();
    await user.selectOptions(screen.getByLabelText("Default dashboard range"), "90d");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByText("Preferences saved for this demo workspace.");
    expect(body).toEqual({ expected_version: 1, default_dashboard_range: "90d" });
    expect(hasManualTimeZonePreference()).toBe(false);
  });

  it("preserves edits on 409 and lets the owner refresh server preferences before a bounded save", async () => {
    const bodies: Record<string, unknown>[] = [];
    let refreshed = false;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json({
        ...testSettings, version: refreshed ? 2 : 1, theme: refreshed ? "LIGHT" : testSettings.theme,
      })),
      http.patch(`${API_ORIGIN}/api/v1/settings`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        bodies.push(body);
        if (bodies.length === 1) return HttpResponse.json({ error: { code: "CONFLICT", message: "These preferences changed. Review and retry.", request_id: "settings-conflict" } }, { status: 409 });
        return HttpResponse.json({ ...testSettings, theme: "LIGHT", ...body, version: 3 });
      }),
    );
    const { user } = renderApp("/settings");
    await user.selectOptions(await screen.findByLabelText("Default dashboard range"), "90d");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByRole("heading", { name: "Preferences could not be saved" });
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
    expect(screen.getByText(/Your edits are still here/)).toBeVisible();
    expect(bodies).toHaveLength(1);
    refreshed = true;
    await user.click(screen.getByRole("button", { name: "Refresh saved preferences" }));
    await waitFor(() => expect(screen.getByLabelText("Color theme")).toHaveValue("LIGHT"));
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByText("Preferences saved for this demo workspace.");
    expect(bodies).toEqual([
      { expected_version: 1, default_dashboard_range: "90d" },
      { expected_version: 2, default_dashboard_range: "90d" },
    ]);
  });
});

function MutationProbe({ request }: { request: UpdateSettingsRequest }) {
  const settings = useSettings();
  const mutation = useUpdateSettings();
  return <><button disabled={!settings.data} onClick={() => mutation.mutate(request)}>Save probe</button><span role="status">{mutation.isSuccess ? "saved" : mutation.isError ? "failed" : "waiting"}</span></>;
}

function ScopedProbe({ request }: { request: UpdateSettingsRequest }) {
  const { state } = useWorkspaceSession();
  return <MutationProbe key={state.scope.generation} request={request} />;
}

async function renderProbe(request: UpdateSettingsRequest) {
  saveDemoSession({ access_token: "synthetic.demo.settings.token.long.enough", token_type: "Bearer", expires_at: "2099-01-01T00:00:00Z" });
  const controller = new WorkspaceSessionController(createDemoAdapter());
  render(<WorkspaceSessionProvider controller={controller}><ScopedProbe request={request} /></WorkspaceSessionProvider>);
  await waitFor(() => expect(screen.getByRole("button", { name: "Save probe" })).toBeEnabled());
  clearManualTimeZonePreference();
  return controller;
}

describe("manual demo timezone evidence", () => {
  it.each([
    { title: "a real successful zone change", zone: "Asia/Tokyo", version: 2, marked: true },
    { title: "an unchanged zone alongside another field", zone: testSettings.time_zone, version: 2, marked: false },
    { title: "a no-op version response", zone: "Asia/Tokyo", version: 1, marked: false },
  ])("marks only $title", async ({ zone, version, marked }) => {
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json({ ...testSettings, time_zone: zone, theme: "LIGHT", version })));
    const controller = await renderProbe({ expected_version: 1, time_zone: zone, theme: "LIGHT" });
    expect(controller.getSnapshot().status).toBe("ready");
    expect(controller.getSnapshot().queryClient.getQueryData(["settings"])).toMatchObject({ time_zone: testSettings.time_zone });
    fireEvent.click(screen.getByRole("button", { name: "Save probe" }));
    await screen.findByText("saved");
    expect(hasManualTimeZonePreference()).toBe(marked);
  });

  it("does not mark a failed zone change", async () => {
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json({ error: { code: "CONFLICT", message: "Conflict" } }, { status: 409 })));
    await renderProbe({ expected_version: 1, time_zone: "Asia/Tokyo" });
    fireEvent.click(screen.getByRole("button", { name: "Save probe" }));
    await screen.findByText("failed");
    expect(hasManualTimeZonePreference()).toBe(false);
  });

  it("ignores a successful old-session zone write after identity exit", async () => {
    let finish: (() => void) | undefined;
    let requested = false;
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, async () => {
      requested = true;
      await new Promise<void>((resolve) => { finish = resolve; });
      return HttpResponse.json({ ...testSettings, time_zone: "Asia/Tokyo", version: 2 });
    }));
    const controller = await renderProbe({ expected_version: 1, time_zone: "Asia/Tokyo" });
    fireEvent.click(screen.getByRole("button", { name: "Save probe" }));
    await waitFor(() => expect(requested).toBe(true));
    act(() => { controller.leave({ discard: true }); });
    await act(async () => { finish?.(); });
    expect(hasManualTimeZonePreference()).toBe(false);
    expect(controller.getSnapshot().queryClient.getQueryData(["settings"])).toBeUndefined();
  });
});

function persistentSettingsController(staging: boolean, kind: "PERSISTENT" | "LOCAL" = "PERSISTENT") {
  const bootstrap: WorkspaceBootstrap = {
    state: "ACTIVE", identity_kind: kind, bootstrap_version: 1,
    created_at: testSettings.created_at, updated_at: testSettings.updated_at,
    profile: { ...testUser, user_id: kind === "PERSISTENT" ? "CaseSensitive-Opaque-Subject" : "00000000-0000-4000-8000-000000000001", name: "Verified Provider Name", email: "verified@example.com", last_login_at: null },
    settings: { ...testSettings, time_zone: "Asia/Tokyo" },
  };
  const workspace: AdapterWorkspace = { lifetime: "durable", identityKind: kind, authorization: kind === "PERSISTENT" ? "Bearer synthetic-account-test-only" : null, bootstrap };
  const adapter: SessionAdapter = {
    id: "settings-account-fixture", lifetime: "durable", restore: () => workspace,
    activate: async () => workspace, persist: () => {}, clear: () => {}, valid: () => true,
  };
  const controller = new WorkspaceSessionController(adapter);
  Object.defineProperty(controller, "authenticationConfiguration", { get: () => ({
    version: 1, environment: staging ? "staging" : "test", capabilities: ["cognito"],
    account_data_policy: staging ? "disposable_staging" : "local_development", account_management_enabled: false,
  }) });
  return controller;
}

describe("persistent Settings presentation", () => {
  it.each([true, false])("shows provider identity without demo or LOCAL claims; staging=%s", async (staging) => {
    let settingsWrites = 0;
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, () => { settingsWrites++; return HttpResponse.json(testSettings); }));
    renderApp("/settings", { controller: persistentSettingsController(staging), autoDetectTimeZone: true });
    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue("Verified Provider Name");
    const page = within(screen.getByRole("main"));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveValue("verified@example.com");
    expect(screen.getByText("Verified email address · managed by your account provider.")).toBeVisible();
    expect(screen.getByText("Persistent account")).toBeVisible();
    expect(screen.getByText("Retained across sign-outs")).toBeVisible();
    expect(screen.getByText(/Account deletion is currently unavailable/)).toBeVisible();
    expect(page.queryByText("Local development workspace")).not.toBeInTheDocument();
    expect(screen.queryByText(/This is not a real account login/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /personal account preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save profile preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete account/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify identity for JSON export" })).toBeVisible();
    expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Tokyo");
    expect(settingsWrites).toBe(0);
    if (staging) expect(screen.getByText(/For owner-supervised staging evaluation, use fictional application data only/)).toBeVisible();
    else expect(screen.queryByText(/For owner-supervised staging evaluation, use fictional application data only/)).not.toBeInTheDocument();
  });

  it("keeps LOCAL development identity distinct from a provider account", async () => {
    renderApp("/settings", { controller: persistentSettingsController(false, "LOCAL") });
    await screen.findByRole("textbox", { name: "Name" });
    expect(within(screen.getByRole("main")).getByText("Local development workspace")).toBeVisible();
    expect(screen.getByText(/This is not a real account login/)).toBeVisible();
    expect(screen.queryByText("Verified email address · managed by your account provider.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Account deletion is currently unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/For owner-supervised staging evaluation/)).not.toBeInTheDocument();
  });
});
