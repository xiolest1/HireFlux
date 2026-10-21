import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSettings, testUser } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";
import type { AuthConfiguration } from "../api/authConfiguration";
import { acquireSessionOwnership } from "./cognitoCoordination";
import { WorkspaceSessionController } from "./workspaceSessionController";
import { COGNITO_SENSITIVE_INTENT_KEY } from "./cognitoSessionStore";
import { StaleSessionError } from "./sessionGeneration";

vi.mock("./cognitoCoordination", () => ({ acquireSessionOwnership: vi.fn(), observeAccountLogout: () => () => {}, broadcastAccountLogout: vi.fn() }));
const config: AuthConfiguration = {
  version: 1, environment: "test", capabilities: ["demo", "cognito"],
  account_data_policy: "local_development", account_management_enabled: true,
  cognito: { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY", client_id: "publictestclient",
    domain: "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com", scopes: ["openid", "email", "profile"], self_registration_enabled: false },
};
const provider = config.cognito!;
const subject = "Sensitive-Account-A";
const profile = { ...testUser, user_id: subject, last_login_at: null };
const bootstrap = { state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1, created_at: testUser.created_at, updated_at: testUser.created_at, profile, settings: testSettings };
const terminal = { state: "DELETED", deletion_started_at: "2026-10-20T00:00:00Z", deletion_completed_at: "2026-10-20T00:00:01Z", retryable_failure: false, provider_finalization: "COMPLETE", provider_finalized_at: "2026-10-20T00:00:02Z" };
const controllers: WorkspaceSessionController[] = [];
function jwt(claims: object) {
  const encode = (part: object) => btoa(JSON.stringify(part)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.synthetic-signature`;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubEnv("VITE_WORKSPACE_MODE", "demo");
  vi.mocked(acquireSessionOwnership).mockResolvedValue({ status: "owned", release: vi.fn() });
  window.history.replaceState(null, "", "/");
});
afterEach(() => { controllers.forEach((c) => c.disposeIfUnused()); controllers.length = 0; vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function session() {
  const navigate = vi.fn();
  const controller = new WorkspaceSessionController(undefined, undefined, { loadConfiguration: async () => config, navigateExternal: navigate });
  controllers.push(controller);
  const counts = { code: 0, bootstrap: 0, deletion: 0, export: 0, demo: 0 };
  let responseSubject = subject;
  let staleAuth = false;
  let tokenFailure = false;
  const response = () => {
    const now = Math.floor(Date.now() / 1000);
    const url = new URL(navigate.mock.calls.at(-1)![0]);
    const common = { iss: provider.issuer, sub: responseSubject, iat: now, exp: now + 3600, auth_time: staleAuth ? now - 1000 : now };
    return { access_token: jwt({ ...common, client_id: provider.client_id, username: responseSubject, token_use: "access", scope: "openid email profile" }),
      id_token: jwt({ ...common, aud: provider.client_id, token_use: "id", nonce: url.searchParams.get("nonce") }),
      token_type: "Bearer", refresh_token: `fictional-refresh-${counts.code}`, expires_in: 3600, scope: "openid email profile" };
  };
  server.use(
    http.post(provider.domain + "/oauth2/token", () => { counts.code++; return tokenFailure ? HttpResponse.error() : HttpResponse.json(response()); }),
    http.post(API_ORIGIN + "/api/v1/me/bootstrap", () => { counts.bootstrap++; return HttpResponse.json(bootstrap); }),
    http.delete(API_ORIGIN + "/api/v1/me", async ({ request }) => { counts.deletion++; expect(await request.json()).toEqual({ confirmation: "DELETE_MY_ACCOUNT" }); return HttpResponse.json(terminal); }),
    http.get(API_ORIGIN + "/api/v1/me/export", () => { counts.export++; return HttpResponse.error(); }),
    http.post(API_ORIGIN + "/api/v1/demo-sessions", () => { counts.demo++; return HttpResponse.error(); }),
  );
  const callback = () => window.location.origin + "/auth/callback?code=synthetic-code&state=" + new URL(navigate.mock.calls.at(-1)![0]).searchParams.get("state");
  await controller.initialize();
  await controller.beginSignIn();
  await controller.completeOAuthCallback(callback());
  expect(controller.getSnapshot().status).toBe("ready");
  return { controller, counts, callback, response, navigate, otherUser: () => { responseSubject = "Sensitive-Account-B"; }, oldAuthentication: () => { staleAuth = true; }, outage: () => { tokenFailure = true; } };
}

describe("same-account sensitive operation authorization", () => {
  it("requires confirmation/dirty-form consent, binds a fresh transaction and rejects wrong operation or replay", async () => {
    const s = await session();
    const before = s.controller.getSnapshot();
    const unregister = s.controller.registerUnsaved(before.scope);
    expect(await s.controller.beginSensitiveOperation("export")).toBe(false);
    expect(before.scope.isCurrent()).toBe(true);
    unregister();
    await expect(s.controller.beginSensitiveOperation("delete", "wrong")).rejects.toMatchObject({ code: "ACCOUNT_CONFIRMATION_REQUIRED" });
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    expect(before.scope.isCurrent()).toBe(false);
    expect(new URL(s.navigate.mock.calls.at(-1)![0]).searchParams.get("prompt")).toBe("login");
    const intent = JSON.parse(sessionStorage.getItem(COGNITO_SENSITIVE_INTENT_KEY)!);
    expect(intent).toMatchObject({ operation: "delete", subject, confirmed: true, originalGeneration: before.scope.generation });
    await s.controller.completeOAuthCallback(s.callback());
    expect(s.controller.getSnapshot().status).toBe("account-management");
    expect(s.counts.bootstrap).toBe(1); // Sensitive return never bootstraps a frozen workspace.
    await expect(s.controller.performSensitiveExport()).rejects.toMatchObject({ code: "SENSITIVE_INTENT_INVALID" });
    await s.controller.performAccountDeletion();
    expect(s.counts.deletion).toBe(1);
    expect(s.controller.getSnapshot()).toMatchObject({ status: "account-management", completed: true, deletion: { provider_finalization: "COMPLETE" } });
    expect(sessionStorage.getItem("hireflux.cognito.user.v1")).toBeNull();
    expect(sessionStorage.getItem(COGNITO_SENSITIVE_INTENT_KEY)).toBeNull();
    await expect(s.controller.performAccountDeletion()).rejects.toMatchObject({ code: "SENSITIVE_INTENT_INVALID" });
    expect(s.counts.deletion).toBe(1);
  });

  it("rejects a different reauthenticated subject before credentials are stored or either account is touched", async () => {
    const s = await session();
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    s.otherUser();
    await expect(s.controller.completeOAuthCallback(s.callback())).rejects.toMatchObject({ code: "OAUTH_SESSION_INVALID" });
    expect(s.counts).toMatchObject({ deletion: 0, export: 0, demo: 0, bootstrap: 1 });
    expect(sessionStorage.getItem("hireflux.cognito.user.v1")).toBeNull();
    expect(sessionStorage.getItem(COGNITO_SENSITIVE_INTENT_KEY)).toBeNull();
  });

  it.each(["expired", "wrong-client", "wrong-operation"])("denies %s intent without executing a sensitive request", async (kind) => {
    const s = await session();
    await s.controller.beginSensitiveOperation("export");
    const intent = JSON.parse(sessionStorage.getItem(COGNITO_SENSITIVE_INTENT_KEY)!);
    if (kind === "expired") intent.createdAt -= 300_001;
    if (kind === "wrong-client") intent.clientId = "otherclient";
    if (kind === "wrong-operation") intent.operation = "foreign";
    sessionStorage.setItem(COGNITO_SENSITIVE_INTENT_KEY, JSON.stringify(intent));
    await expect(s.controller.completeOAuthCallback(s.callback())).rejects.toMatchObject({ code: "SENSITIVE_INTENT_INVALID" });
    expect(s.counts).toMatchObject({ code: 1, deletion: 0, export: 0, demo: 0 });
  });

  it.each(["cancel", "new-login"])("denies a superseded %s intent and callback", async (kind) => {
    const s = await session();
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    const old = s.callback();
    if (kind === "cancel") s.controller.leave();
    else await s.controller.beginSignIn();
    await expect(s.controller.completeOAuthCallback(old)).rejects.toBeDefined();
    expect(s.counts.deletion).toBe(0);
  });

  it("fences logout during a delayed sensitive callback before any credential write", async () => {
    const s = await session();
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    const seen = deferred<void>(); const delayed = deferred<Response>();
    server.use(http.post(provider.domain + "/oauth2/token", async () => { seen.resolve(); return delayed.promise; }));
    const completion = s.controller.completeOAuthCallback(s.callback());
    const rejected = expect(completion).rejects.toBeInstanceOf(StaleSessionError);
    await seen.promise;
    const response = s.response();
    await s.controller.signOut();
    delayed.resolve(HttpResponse.json(response));
    await rejected;
    expect(sessionStorage.getItem("hireflux.cognito.user.v1")).toBeNull();
    expect(sessionStorage.getItem(COGNITO_SENSITIVE_INTENT_KEY)).toBeNull();
    expect(s.counts.deletion).toBe(0);
  });

  it.each(["old-auth", "provider-outage"])("refuses %s without treating token refresh/failed login as fresh authorization", async (kind) => {
    const s = await session();
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    if (kind === "old-auth") s.oldAuthentication(); else s.outage();
    await expect(s.controller.completeOAuthCallback(s.callback())).rejects.toBeDefined();
    expect(s.counts).toMatchObject({ deletion: 0, export: 0, demo: 0 });
  });

  it("does not replay an export or delete after unknown network outcomes", async () => {
    const s = await session();
    await s.controller.beginSensitiveOperation("export");
    await s.controller.completeOAuthCallback(s.callback());
    await expect(s.controller.performSensitiveExport()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(s.controller.performSensitiveExport()).rejects.toMatchObject({ code: "SENSITIVE_INTENT_INVALID" });
    expect(s.counts.export).toBe(1);
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    await s.controller.completeOAuthCallback(s.callback());
    let requests = 0;
    server.use(http.delete(API_ORIGIN + "/api/v1/me", () => { requests++; return HttpResponse.error(); }));
    await expect(s.controller.performAccountDeletion()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(s.controller.performAccountDeletion()).rejects.toMatchObject({ code: "SENSITIVE_INTENT_INVALID" });
    expect(requests).toBe(1);
  });

  it.each(["active", "complete", "review"])("reads %s after an unknown delete without replay and clears terminal credentials", async (outcome) => {
    const s = await session();
    await s.controller.beginSensitiveOperation("delete", "DELETE_MY_ACCOUNT");
    await s.controller.completeOAuthCallback(s.callback());
    let requests = 0;
    server.use(
      http.delete(API_ORIGIN + "/api/v1/me", () => { requests++; return HttpResponse.error(); }),
      http.get(API_ORIGIN + "/api/v1/me/deletion", () => HttpResponse.json(outcome === "active"
        ? { state: "ACTIVE", deletion_started_at: null, deletion_completed_at: null, retryable_failure: false }
        : outcome === "complete" ? terminal
          : { ...terminal, provider_finalization: "REVIEW_REQUIRED", provider_finalized_at: undefined })),
    );
    await expect(s.controller.performAccountDeletion()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await s.controller.reviewAccountDeletion();
    expect(requests).toBe(1);
    expect(s.controller.getSnapshot()).toMatchObject({ status: "account-management", consumed: true,
      deletion: { state: outcome === "active" ? "ACTIVE" : "DELETED" } });
    if (outcome !== "active") expect(sessionStorage.getItem("hireflux.cognito.user.v1")).toBeNull();
    await expect(s.controller.performAccountDeletion()).rejects.toMatchObject({ code: "SENSITIVE_INTENT_INVALID" });
  });
});
