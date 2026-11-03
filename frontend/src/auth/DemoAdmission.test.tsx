import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { AuthConfiguration } from "../api/authConfiguration";
import { ApiError } from "../api/client";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";
import { API_ORIGIN, server } from "../test/server";
import { testSettings, testUser } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { CognitoSessionAdapter } from "./cognitoSessionAdapter";
import { createDemoAdapter } from "./sessionAdapters";
import { loadDemoSession, saveDemoSession } from "./sessionStore";
import { WorkspaceSessionController } from "./workspaceSessionController";

const demo = { access_token: "fictional.demo.session.for.admission.tests", token_type: "Bearer" as const, expires_at: "2099-08-11T12:00:00Z" };
const configuration: AuthConfiguration = {
  version: 1, environment: "test", capabilities: ["demo", "cognito"],
  account_data_policy: "local_development", account_management_enabled: false,
  cognito: { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY", client_id: "testonlyclient",
    domain: STAGING_COGNITO_ORIGIN, scopes: ["openid", "email", "profile"], self_registration_enabled: false },
};
const controllers: WorkspaceSessionController[] = [];
function controller() {
  const value = new WorkspaceSessionController(createDemoAdapter());
  controllers.push(value);
  return value;
}
function denial(code: string, status = 429, details?: unknown) {
  return HttpResponse.json({ error: { code, message: code === "DEMO_ISSUANCE_PAUSED"
    ? "New demo workspaces are paused. Existing workspaces remain available."
    : code === "DEMO_QUOTA_EXHAUSTED" ? "Demo creation is temporarily at its limit. Try again later."
    : "Demo admission could not be confirmed. Retry with the same request.",
  request_id: "synthetic-admission-reference", ...(details === undefined ? {} : { details }) } }, { status });
}
afterEach(() => {
  controllers.splice(0).forEach((value) => value.disposeIfUnused());
  vi.restoreAllMocks();
});

describe("Demo admission failures and explicit recovery", () => {
  it.each(["DEMO_ISSUANCE_PAUSED", "DEMO_QUOTA_EXHAUSTED"])("keeps a valid original Demo after reset is denied by %s", async (code) => {
    saveDemoSession(demo);
    const value = controller(); await value.initialize();
    const old = value.getSnapshot(); old.queryClient.setQueryData(["old-private-fixture"], { private: true });
    let attempts = 0;
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
      attempts++;
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("idempotency-key")).toBeTruthy();
      return denial(code, 429, code === "DEMO_QUOTA_EXHAUSTED" ? { retry_after_seconds: 60 } : undefined);
    }));
    await expect(value.activate(true)).rejects.toMatchObject({ code, status: 429 });
    const state = value.getSnapshot();
    expect(state).toMatchObject({ status: "ready", workspace: { demo }, error: { code } });
    expect(old.scope.isCurrent()).toBe(false);
    expect(old.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(loadDemoSession().session).toEqual(demo);
    expect(await state.scope.credential()).toMatchObject({ authorization: `Bearer ${demo.access_token}` });
    // A denied reset does not schedule another POST or extend the original deadline.
    await Promise.resolve(); await Promise.resolve();
    expect(attempts).toBe(1);
  });

  it.each(["DEMO_ADMISSION_UNCERTAIN", "DEMO_ADMISSION_UNAVAILABLE", "DEMO_PROVISIONING_IN_PROGRESS"])("keeps one idempotency key for explicit retry of %s", async (code) => {
    const value = controller(); await value.initialize();
    const keys: (string | null)[] = [];
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
      keys.push(request.headers.get("idempotency-key"));
      return keys.length === 1 ? denial(code, code === "DEMO_PROVISIONING_IN_PROGRESS" ? 409 : 503)
        : HttpResponse.json(demo, { status: 201 });
    }));
    await expect(value.activate()).rejects.toMatchObject({ code });
    expect(value.getSnapshot().status).toBe("error");
    expect(loadDemoSession().session).toBeNull();
    await Promise.resolve(); await Promise.resolve(); expect(keys).toHaveLength(1);
    await value.activate();
    expect(keys).toHaveLength(2); expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]);
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { demo } });
  });

  it("keeps the uncertain reset key while restoring the still-valid previous Demo", async () => {
    saveDemoSession(demo);
    const value = controller(); await value.initialize();
    const keys: (string | null)[] = [];
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
      keys.push(request.headers.get("idempotency-key")); return denial("DEMO_ADMISSION_UNCERTAIN", 503);
    }));
    await expect(value.activate(true)).rejects.toMatchObject({ code: "DEMO_ADMISSION_UNCERTAIN" });
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { demo } });
    await expect(value.activate(true)).rejects.toMatchObject({ code: "DEMO_ADMISSION_UNCERTAIN" });
    expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
    expect(loadDemoSession().session).toEqual(demo);
  });

  it("keeps the same key when reconciliation becomes unavailable after an uncertain response", async () => {
    const value = controller(); await value.initialize();
    const keys: (string | null)[] = [];
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
      keys.push(request.headers.get("idempotency-key"));
      if (keys.length === 1) return denial("DEMO_ADMISSION_UNCERTAIN", 503);
      if (keys.length === 2) return denial("DEMO_ADMISSION_UNAVAILABLE", 503);
      return HttpResponse.json(demo, { status: 201 });
    }));
    await expect(value.activate()).rejects.toMatchObject({ code: "DEMO_ADMISSION_UNCERTAIN" });
    await expect(value.activate()).rejects.toMatchObject({ code: "DEMO_ADMISSION_UNAVAILABLE" });
    expect(keys).toHaveLength(2);
    await value.activate();
    expect(keys).toHaveLength(3); expect(keys[0]).toBeTruthy();
    expect(new Set(keys).size).toBe(1);
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { demo } });
  });

  it("does not restore an old Demo that expires while a denied reset is pending", async () => {
    const expiresAt = Date.now() + 1000;
    saveDemoSession({ ...demo, expires_at: new Date(expiresAt).toISOString() });
    const value = controller(); await value.initialize();
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () => {
      vi.spyOn(Date, "now").mockReturnValue(expiresAt + 1); return denial("DEMO_ISSUANCE_PAUSED");
    }));
    await expect(value.activate(true)).rejects.toMatchObject({ code: "DEMO_ISSUANCE_PAUSED" });
    expect(value.getSnapshot().status).toBe("error");
    expect(loadDemoSession().session).toBeNull();
  });

  it("renders the bounded denial message and retries only after another deliberate click", async () => {
    let attempts = 0;
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () => { attempts++; return denial("DEMO_QUOTA_EXHAUSTED", 429, { retry_after_seconds: 60 }); }));
    const value = controller();
    const { user } = renderApp("/", { withSession: false, controller: value });
    const button = (await screen.findAllByRole("button", { name: "Explore the Demo" }))[0];
    await user.click(button);
    expect(await screen.findByText("Demo creation is temporarily at its limit. Try again later.")).toBeVisible();
    expect(screen.getByText("Reference: synthetic-admission-reference")).toBeVisible();
    expect(value.getSnapshot()).toMatchObject({ status: "error", error: { code: "DEMO_QUOTA_EXHAUSTED" } });
    expect(attempts).toBe(1); expect(loadDemoSession().session).toBeNull();
    await user.click(button); expect(attempts).toBe(2);
  });

  it("does not restore cleared Personal credentials after an explicitly chosen Demo is denied", async () => {
    window.sessionStorage.setItem("hireflux.selected-workspace.v1", "cognito");
    let account!: CognitoSessionAdapter;
    const value = new WorkspaceSessionController(undefined, undefined, {
      loadConfiguration: async () => configuration,
      accountFactory: (config, failed, refreshing) => {
        account = new CognitoSessionAdapter(config, failed, refreshing);
        vi.spyOn(account, "restore").mockResolvedValue({ lifetime: "durable", identityKind: "PERSISTENT", authorization: null, credentials: account,
          bootstrap: { state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1,
            created_at: testUser.created_at, updated_at: testUser.created_at, profile: testUser, settings: testSettings } });
        vi.spyOn(account, "clear"); return account;
      },
    });
    controllers.push(value); await value.initialize();
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { identityKind: "PERSISTENT" } });
    window.sessionStorage.setItem("hireflux.cognito.user.v1", "synthetic-personal-credential-state");
    const old = value.getSnapshot(); old.queryClient.setQueryData(["personal-private-fixture"], { private: true });
    let attempts = 0;
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, ({ request }) => {
      attempts++; expect(request.headers.get("authorization")).toBeNull(); return denial("DEMO_ISSUANCE_PAUSED");
    }));
    const unregister = value.registerUnsaved(old.scope);
    await expect(value.activateDemo()).rejects.toMatchObject({ code: "UNSAVED_CHANGES" });
    expect(old.scope.isCurrent()).toBe(true); expect(attempts).toBe(0); expect(account.clear).not.toHaveBeenCalled();
    unregister();
    await expect(value.activateDemo()).rejects.toBeInstanceOf(ApiError);
    expect(attempts).toBe(1); expect(account.clear).toHaveBeenCalled();
    expect(old.scope.isCurrent()).toBe(false); expect(old.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(value.getSnapshot()).toMatchObject({ status: "error", operation: "activate", error: { code: "DEMO_ISSUANCE_PAUSED" } });
    expect(window.sessionStorage.getItem("hireflux.cognito.user.v1")).toBeNull();
    expect(loadDemoSession().session).toBeNull();
    expect(await value.getSnapshot().scope.credential()).toMatchObject({ authorization: null });
  });
});
