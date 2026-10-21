import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { testSettings, testUser } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";
import { CognitoClient } from "./cognitoClient";
import { acquireSessionOwnership } from "./cognitoCoordination";
import { CognitoSessionAdapter } from "./cognitoSessionAdapter";
import { CognitoSessionStore } from "./cognitoSessionStore";
import { newSessionScope, StaleSessionError } from "./sessionGeneration";

vi.mock("./cognitoCoordination", () => ({ acquireSessionOwnership: vi.fn() }));

const config = {
  issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY",
  client_id: "testonlypublicclient",
  domain: "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com",
  scopes: ["openid", "email", "profile"],
};
const subject = "Adapter-Opaque-Subject-A";
const profile = { ...testUser, user_id: subject, last_login_at: null };
const bootstrap = {
  state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1,
  created_at: testUser.created_at, updated_at: testUser.created_at,
  profile, settings: testSettings,
};

function jwt(value: object): string {
  const encode = (part: object) => btoa(JSON.stringify(part)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${encode({ alg: "RS256", kid: "synthetic" })}.${encode(value)}.synthetic-test-signature`;
}
function payload(nonce: string, authTime: number, rotation = "original", userId = subject) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: jwt({ iss: config.issuer, sub: userId, client_id: config.client_id, token_use: "access",
      iat: now, exp: now + 3600, auth_time: authTime, scope: "openid email profile" }),
    id_token: jwt({ iss: config.issuer, sub: userId, aud: config.client_id, token_use: "id",
      iat: now, exp: now + 3600, auth_time: authTime, nonce }),
    refresh_token: `synthetic-refresh-${rotation}`, token_type: "Bearer", expires_in: 3600,
    scope: "openid email profile",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(acquireSessionOwnership).mockResolvedValue({ status: "owned", release: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function session(options: { bootstrapFailure?: boolean; memory?: boolean; bootstrapProfile?: object } = {}) {
  if (options.memory) vi.mocked(acquireSessionOwnership).mockResolvedValue({ status: "unsupported" });
  const failed = vi.fn();
  const refreshingChanged = vi.fn();
  const unauthorized = vi.fn();
  const client = new CognitoClient(config, new CognitoSessionStore());
  const revoke = vi.spyOn(client, "revoke");
  const adapter = new CognitoSessionAdapter(config, failed, refreshingChanged, client);
  const scope = newSessionScope(null, unauthorized, adapter);
  const url = await adapter.begin(scope, "/settings");
  const authorization = new URL(url);
  const nonce = authorization.searchParams.get("nonce")!;
  const authTime = Math.floor(Date.now() / 1000) - 30;
  let codeRequests = 0;
  let bootstrapRequests = 0;
  let failBootstrap = options.bootstrapFailure ?? false;
  server.use(
    http.post(config.domain + "/oauth2/token", async ({ request }) => {
      const body = new URLSearchParams(await request.text());
      expect(body.get("grant_type")).toBe("authorization_code");
      codeRequests++;
      return HttpResponse.json(payload(nonce, authTime));
    }),
    http.post(API_ORIGIN + "/api/v1/me/bootstrap", async ({ request }) => {
      bootstrapRequests++;
      expect(await request.json()).toEqual({});
      expect(request.headers.get("Authorization")).toMatch(/^Bearer /);
      if (failBootstrap) return HttpResponse.json({ error: {
        code: "PERSISTENCE_UNAVAILABLE", message: "The data store is temporarily unavailable.", request_id: "synthetic-bootstrap-retry",
      } }, { status: 503 });
      return HttpResponse.json({ ...bootstrap, profile: { ...profile, ...options.bootstrapProfile } });
    }),
  );
  const callback = `${window.location.origin}/auth/callback?code=synthetic-code&state=${authorization.searchParams.get("state")}`;
  const finish = () => adapter.callback(scope, callback);
  const counts = () => ({ codeRequests, bootstrapRequests });
  const recoverBootstrap = () => { failBootstrap = false; };
  return { adapter, client, scope, nonce, authTime, failed, refreshingChanged, unauthorized, revoke, finish, counts, recoverBootstrap };
}

function nearExpiry(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 3_541_000);
}

describe("Cognito adapter credential coordination and durable admission", () => {
  it("publishes only the verified persistent workspace after trusted bootstrap", async () => {
    const h = await session();
    expect(h.adapter.hasAccount()).toBe(false);
    const result = await h.finish();
    expect(result.returnPath).toBe("/settings");
    expect(result.workspace.identityKind).toBe("PERSISTENT");
    expect(result.workspace.bootstrap?.profile).toEqual(profile);
    expect(result.workspace.credentials).toBe(h.adapter);
    expect(h.counts()).toEqual({ codeRequests: 1, bootstrapRequests: 1 });
    expect(h.failed).not.toHaveBeenCalled();
  });

  it("single-flights simultaneous renewal and ignores old-revision 401s", async () => {
    const h = await session();
    const ready = await h.finish();
    const old = await h.scope.credential();
    nearExpiry();
    let refreshRequests = 0;
    const seen = deferred<void>();
    const response = deferred<Response>();
    server.use(http.post(config.domain + "/oauth2/token", async ({ request }) => {
      const body = new URLSearchParams(await request.text());
      expect(body.get("refresh_token")).toBe("synthetic-refresh-original");
      expect(body.get("grant_type")).toBe("refresh_token");
      refreshRequests++;
      seen.resolve();
      return await response.promise;
    }));
    const a = h.scope.credential();
    const b = h.scope.credential();
    const c = h.scope.credential();
    await seen.promise;
    expect(h.adapter.revision()).toBeGreaterThan(old.revision);
    h.scope.unauthorized("invalidated", old.revision);
    expect(h.unauthorized).not.toHaveBeenCalled();
    response.resolve(HttpResponse.json(payload(h.nonce, h.authTime, "rotated")));
    const leases = await Promise.all([a, b, c]);
    expect(refreshRequests).toBe(1);
    expect(leases[0]).toEqual(leases[1]);
    expect(leases[1]).toEqual(leases[2]);
    expect(leases[0].authorization).not.toBe(old.authorization);
    expect(h.adapter.captureRefreshToken()).toBe("synthetic-refresh-rotated");
    expect(h.adapter.valid(ready.workspace)).toBe(true);
    expect(h.refreshingChanged.mock.calls).toEqual([[true], [false]]);
    expect(h.counts().bootstrapRequests).toBe(1);
    h.scope.unauthorized("invalidated", leases[0].revision);
    expect(h.unauthorized).toHaveBeenCalledOnce();
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it.each(["expired", "network", "429", "503"])("fails %s renewal once without family revocation or request replay", async (failure) => {
    const h = await session();
    await h.finish();
    nearExpiry();
    let requests = 0;
    server.use(http.post(config.domain + "/oauth2/token", () => {
      requests++;
      if (failure === "network") return HttpResponse.error();
      if (failure === "expired") return HttpResponse.json({ error: "invalid_grant", error_description: "synthetic-private-diagnostic" }, { status: 400 });
      return HttpResponse.json({ error: "temporarily_unavailable" }, { status: Number(failure) });
    }));
    await expect(h.scope.credential()).rejects.toBeInstanceOf(ApiError);
    expect(requests).toBe(1);
    expect(h.adapter.hasAccount()).toBe(false);
    expect(h.adapter.captureRefreshToken()).toBeUndefined();
    expect(h.failed).toHaveBeenCalledOnce();
    expect(h.failed.mock.calls[0][0].message).not.toContain("synthetic-private");
    expect(h.revoke).not.toHaveBeenCalled();
    await expect(h.scope.credential()).rejects.toMatchObject({ code: "ACCOUNT_SIGN_IN_REQUIRED" });
    expect(requests).toBe(1);
  });

  it("treats an expired access token as a coordinated refresh candidate", async () => {
    const h = await session();
    await h.finish();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3_601_000);
    let requests = 0;
    server.use(http.post(config.domain + "/oauth2/token", () => {
      requests++;
      return HttpResponse.json(payload(h.nonce, h.authTime, "after-expiration"));
    }));
    expect((await h.scope.credential()).authorization).toMatch(/^Bearer /);
    expect(requests).toBe(1);
    expect(h.adapter.hasAccount()).toBe(true);
  });

  it("fails rotation atomically when persistence is unavailable", async () => {
    const h = await session();
    await h.finish();
    nearExpiry();
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(payload(h.nonce, h.authTime, "unpersisted"))));
    const original = Storage.prototype.setItem;
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key: string, value: string) {
      if (key.includes("cognito.user")) throw new DOMException("synthetic quota", "QuotaExceededError");
      return original.call(this, key, value);
    });
    await expect(h.scope.credential()).rejects.toMatchObject({ code: "OAUTH_STORAGE_UNAVAILABLE" });
    storage.mockRestore();
    expect(h.adapter.hasAccount()).toBe(false);
    expect(await h.client.restore(h.scope)).toBeNull();
    expect(h.failed).toHaveBeenCalledOnce();
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it("drops a delayed refresh after generation replacement without touching replacement state", async () => {
    const h = await session();
    await h.finish();
    nearExpiry();
    const seen = deferred<void>();
    const response = deferred<Response>();
    server.use(http.post(config.domain + "/oauth2/token", async () => { seen.resolve(); return await response.promise; }));
    const pending = h.scope.credential();
    const rejected = expect(pending).rejects.toBeInstanceOf(StaleSessionError);
    await seen.promise;
    newSessionScope();
    h.adapter.clear();
    response.resolve(HttpResponse.json(payload(h.nonce, h.authTime, "late-after-logout")));
    await rejected;
    expect(h.adapter.hasAccount()).toBe(false);
    expect(h.failed).not.toHaveBeenCalled();
    expect(h.revoke).not.toHaveBeenCalled();
    expect(Object.keys(sessionStorage).some((key) => key.includes("cognito.user"))).toBe(false);
  });

  it.each([{ user_id: "Other-Opaque-Subject" }, { role: "ADMIN" }])("refuses trusted bootstrap identity mismatch %j", async (bootstrapProfile) => {
    const h = await session({ bootstrapProfile });
    await expect(h.finish()).rejects.toMatchObject({ code: "ACCOUNT_IDENTITY_MISMATCH" });
    expect(h.adapter.hasAccount()).toBe(false);
    expect(await h.client.restore(h.scope)).toBeNull();
  });

  it("preserves admitted identity for one explicit retry of transient bootstrap failure", async () => {
    const h = await session({ bootstrapFailure: true });
    await expect(h.finish()).rejects.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE", requestId: "synthetic-bootstrap-retry" });
    expect(h.adapter.hasAccount()).toBe(true);
    expect(h.counts()).toEqual({ codeRequests: 1, bootstrapRequests: 1 });
    h.recoverBootstrap();
    const ready = await h.adapter.activate(h.scope);
    expect(ready.bootstrap?.profile.user_id).toBe(subject);
    expect(h.counts()).toEqual({ codeRequests: 1, bootstrapRequests: 2 });
    expect(h.failed).not.toHaveBeenCalled();
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it("does not turn a workspace lifecycle denial into new authentication or bootstrap loops", async () => {
    const h = await session();
    let requests = 0;
    server.use(http.post(API_ORIGIN + "/api/v1/me/bootstrap", () => {
      requests++;
      return HttpResponse.json({ error: { code: "WORKSPACE_DELETED", message: "This workspace was erased." } }, { status: 409 });
    }));
    await expect(h.finish()).rejects.toMatchObject({ code: "WORKSPACE_DELETED" });
    expect(requests).toBe(1);
    expect(h.counts().codeRequests).toBe(1);
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it("drops copied session storage when a duplicate tab cannot own the refresh family", async () => {
    const h = await session();
    await h.finish();
    const client = new CognitoClient(config, new CognitoSessionStore());
    const revoke = vi.spyOn(client, "revoke");
    const adapter = new CognitoSessionAdapter(config, vi.fn(), vi.fn(), client);
    const scope = newSessionScope(null, vi.fn(), adapter);
    vi.mocked(acquireSessionOwnership).mockResolvedValue({ status: "busy" });
    await expect(adapter.restore(scope)).rejects.toMatchObject({ code: "ACCOUNT_DUPLICATE_TAB" });
    expect(adapter.hasAccount()).toBe(false);
    expect(Object.keys(sessionStorage).some((key) => key.includes("cognito.user"))).toBe(false);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("uses memory-only callback credentials when locks are unsupported, with no reload restoration", async () => {
    const h = await session({ memory: true });
    await h.finish();
    expect(h.adapter.hasAccount()).toBe(true);
    expect(Object.keys(sessionStorage).some((key) => key.includes("cognito.user"))).toBe(false);
    const adapter = new CognitoSessionAdapter(config, vi.fn());
    const scope = newSessionScope(null, vi.fn(), adapter);
    expect(await adapter.restore(scope)).toBeNull();
    expect(adapter.hasAccount()).toBe(false);
  });
});
