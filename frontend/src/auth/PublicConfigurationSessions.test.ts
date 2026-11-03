import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { ApiError } from "../api/client";
import type { AuthConfiguration } from "../api/authConfiguration";
import { API_ORIGIN, server } from "../test/server";
import { testSettings, testUser } from "../test/fixtures";
import { CognitoSessionAdapter } from "./cognitoSessionAdapter";
import { configuredSessionAdapter } from "./sessionAdapters";
import { loadDemoSession, saveDemoSession } from "./sessionStore";
import { StaleSessionError, WorkspaceSessionController, type ControllerOptions } from "./workspaceSessionController";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";

const SELECTED = "hireflux.selected-workspace.v1";
const demo = { access_token: "fictional.demo.credential.for.local.tests", token_type: "Bearer" as const, expires_at: "2099-08-11T12:00:00Z" };
const configuration: AuthConfiguration = {
  version: 1, environment: "test", capabilities: ["demo", "cognito"],
  account_data_policy: "local_development", account_management_enabled: false,
  cognito: { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY", client_id: "testonlyclient",
    domain: STAGING_COGNITO_ORIGIN, scopes: ["openid", "email", "profile"], self_registration_enabled: false },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const controllers: WorkspaceSessionController[] = [];
function controller(options: ControllerOptions) {
  const value = new WorkspaceSessionController(undefined, undefined, options);
  controllers.push(value);
  return value;
}
function factory() {
  return vi.fn<NonNullable<ControllerOptions["accountFactory"]>>((config, failed, refreshing) => {
    const account = new CognitoSessionAdapter(config, failed, refreshing);
    vi.spyOn(account, "restore").mockResolvedValue(null);
    vi.spyOn(account, "callback").mockRejectedValue(new Error("Callback must not run."));
    vi.spyOn(account, "activate").mockRejectedValue(new Error("Bootstrap must not run."));
    vi.spyOn(account, "clear");
    return account;
  });
}
beforeEach(() => {
  vi.stubEnv("VITE_WORKSPACE_MODE", "demo");
  vi.stubGlobal("BroadcastChannel", undefined);
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  controllers.splice(0).forEach((value) => value.disposeIfUnused());
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("configuration admission for managed workspace sessions", () => {
  it.each(["AUTH_CONFIGURATION_INVALID", "AUTH_CONFIGURATION_UNAVAILABLE"])("blocks stored Demo and Personal sessions, activation and callbacks on %s", async (code) => {
    const load = vi.fn(async () => { throw new ApiError(code, "Synthetic unavailable configuration."); });
    const accounts = factory();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    for (const selected of ["demo", "cognito"]) {
      window.sessionStorage.setItem(SELECTED, selected);
      saveDemoSession(demo);
      window.sessionStorage.setItem("hireflux.cognito.user.v1", "synthetic-stored-user");
      const value = controller({ loadConfiguration: load, accountFactory: accounts });
      expect(value.demoEntryAvailable).toBe(false);
      await expect(value.activate()).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
      await value.initialize();
      expect(value.getSnapshot()).toMatchObject({ status: "error", operation: "configuration" });
      expect(value.demoEntryAvailable).toBe(false);
      expect(value.accountEntryAvailable).toBe(false);
      await expect(value.activateDemo()).rejects.toMatchObject({ code });
      await expect(value.activate(true)).rejects.toMatchObject({ code });
      await expect(value.retryAccountBootstrap()).rejects.toMatchObject({ code });
      await expect(value.completeOAuthCallback(`${window.location.origin}/auth/callback?code=fixture&state=fixture`)).rejects.toBeInstanceOf(ApiError);
      expect(value.getSnapshot().status).not.toBe("ready");
    }
    expect(accounts).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not read stored Demo into a ready session until configuration succeeds", async () => {
    saveDemoSession(demo);
    const pending = deferred<AuthConfiguration>();
    const value = controller({ loadConfiguration: () => pending.promise, accountFactory: factory() });
    const initialization = value.initialize();
    expect(value.getSnapshot().status).toBe("initializing");
    expect(value.demoEntryAvailable).toBe(false);
    pending.resolve(configuration);
    await initialization;
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { identityKind: "DEMO", demo } });
    expect(value.demoEntryAvailable).toBe(true);
  });

  it("restores the selected Personal workspace only after configuration, without restoring Demo", async () => {
    window.sessionStorage.setItem(SELECTED, "cognito");
    saveDemoSession(demo);
    const pending = deferred<AuthConfiguration>(), accounts = factory();
    accounts.mockImplementation((config, failed, refreshing) => {
      const account = new CognitoSessionAdapter(config, failed, refreshing);
      vi.spyOn(account, "restore").mockResolvedValue({ lifetime: "durable", identityKind: "PERSISTENT", authorization: null, credentials: account,
        bootstrap: { state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1,
          created_at: testUser.created_at, updated_at: testUser.created_at, profile: testUser, settings: testSettings } });
      return account;
    });
    const value = controller({ loadConfiguration: () => pending.promise, accountFactory: accounts });
    const initialization = value.initialize();
    expect(accounts).not.toHaveBeenCalled();
    pending.resolve(configuration); await initialization;
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { identityKind: "PERSISTENT" } });
    expect(accounts.mock.results[0].value.restore).toHaveBeenCalledOnce();
  });

  it("keeps Demo available when trusted metadata loads but provider session setup fails", async () => {
    saveDemoSession(demo);
    const value = controller({ loadConfiguration: async () => configuration,
      accountFactory: () => { throw new Error("Synthetic provider setup failure."); } });
    await value.initialize();
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { identityKind: "DEMO" } });
    expect(value.authenticationConfigurationError).toBeUndefined();
    expect(value.accountEntryAvailable).toBe(false);
    expect(value.demoEntryAvailable).toBe(true);
  });

  it("does not fall back to stored Demo after a provider restore outage, but permits deliberate Demo entry", async () => {
    window.sessionStorage.setItem(SELECTED, "cognito"); saveDemoSession(demo);
    const accounts = factory();
    accounts.mockImplementation((config, failed, refreshing) => {
      const account = new CognitoSessionAdapter(config, failed, refreshing);
      vi.spyOn(account, "restore").mockRejectedValue(new ApiError("OAUTH_PROVIDER_UNAVAILABLE", "Synthetic provider outage."));
      return account;
    });
    let issues = 0;
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () => { issues++; return HttpResponse.json(demo, { status: 201 }); }));
    const value = controller({ loadConfiguration: async () => configuration, accountFactory: accounts });
    await value.initialize();
    expect(value.getSnapshot()).toMatchObject({ status: "error", operation: "account" });
    expect(issues).toBe(0); expect(value.demoEntryAvailable).toBe(true);
    const old = value.getSnapshot(); old.queryClient.setQueryData(["private-personal-fixture"], { private: true });
    await value.activateDemo();
    expect(old.scope.isCurrent()).toBe(false);
    expect(old.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(value.getSnapshot()).toMatchObject({ status: "ready", workspace: { identityKind: "DEMO" } });
    expect(issues).toBe(1);
  });

  it("fences a pending Demo response when configuration is retried and fails", async () => {
    const issued = deferred<void>(), started = deferred<void>();
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, async () => { started.resolve(); await issued.promise; return HttpResponse.json(demo, { status: 201 }); }));
    const load = vi.fn<() => Promise<AuthConfiguration>>().mockResolvedValueOnce(configuration)
      .mockRejectedValueOnce(new ApiError("AUTH_CONFIGURATION_UNAVAILABLE", "Synthetic config outage."));
    const value = controller({ loadConfiguration: load, accountFactory: factory() });
    await value.initialize();
    const activation = value.activateDemo();
    const rejected = expect(activation).rejects.toBeInstanceOf(StaleSessionError);
    await started.promise;
    const old = value.getSnapshot(); old.queryClient.setQueryData(["previous-private"], { private: true });
    await value.retryAuthenticationConfiguration();
    expect(old.scope.isCurrent()).toBe(false);
    expect(old.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(value.demoEntryAvailable).toBe(false); expect(value.accountEntryAvailable).toBe(false);
    issued.resolve(); await rejected;
    expect(value.getSnapshot().status).toBe("anonymous"); expect(loadDemoSession().session).toBeNull();
    await expect(value.activate()).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
  });

  it("requires deliberate entry after retry succeeds, discarding a retired provider and stored state", async () => {
    saveDemoSession(demo);
    const load = vi.fn<() => Promise<AuthConfiguration>>().mockResolvedValueOnce(configuration)
      .mockResolvedValueOnce({ ...configuration, capabilities: ["demo"], cognito: undefined });
    const accounts = factory(); const value = controller({ loadConfiguration: load, accountFactory: accounts });
    await value.initialize();
    expect(value.getSnapshot().status).toBe("ready");
    await value.retryAuthenticationConfiguration();
    expect(value.getSnapshot().status).toBe("anonymous");
    expect(value.accountEntryAvailable).toBe(false); expect(value.demoEntryAvailable).toBe(true);
    expect(loadDemoSession().session).toBeNull();
    expect(accounts.mock.results[0].value.clear).toHaveBeenCalled();
    await expect(value.beginSignIn()).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    expect(value.getSnapshot().status).toBe("error");
  });

  it("shares one pending configuration read when retry is clicked during initial loading", async () => {
    const pending = deferred<AuthConfiguration>(), load = vi.fn(() => pending.promise);
    const value = controller({ loadConfiguration: load, accountFactory: factory() });
    const initialization = value.initialize(), retry = value.retryAuthenticationConfiguration();
    pending.resolve(configuration); await initialization; await retry;
    expect(load).toHaveBeenCalledOnce(); expect(value.getSnapshot().status).toBe("anonymous");
  });

  it("preserves a dirty workspace until configuration retry explicitly discards edits", async () => {
    saveDemoSession(demo);
    const load = vi.fn(async () => configuration);
    const value = controller({ loadConfiguration: load, accountFactory: factory() });
    await value.initialize();
    const old = value.getSnapshot(); value.registerUnsaved(old.scope);
    await value.retryAuthenticationConfiguration();
    expect(value.getSnapshot()).toBe(old); expect(old.scope.isCurrent()).toBe(true);
    expect(load).toHaveBeenCalledOnce(); expect(value.hasUnsavedChanges).toBe(true);
    await value.retryAuthenticationConfiguration({ discard: true });
    expect(old.scope.isCurrent()).toBe(false); expect(value.hasUnsavedChanges).toBe(false);
    expect(value.getSnapshot().status).toBe("anonymous"); expect(load).toHaveBeenCalledTimes(2);
  });

  it("rejects the local durable adapter on a public site even in a development build", () => {
    vi.stubGlobal("window", { location: { origin: "https://unbound.example.invalid" } });
    expect(() => configuredSessionAdapter("local", true)).toThrow(ApiError);
  });
});
