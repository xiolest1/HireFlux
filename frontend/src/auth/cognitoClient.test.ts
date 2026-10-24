import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/server";
import { CognitoClient } from "./cognitoClient";
import { CognitoSessionStore } from "./cognitoSessionStore";
import { newSessionScope, StaleSessionError } from "./sessionGeneration";

const config = {
  issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY",
  client_id: "testonlypublicclient",
  domain: "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com",
  scopes: ["openid", "email", "profile"],
};

function jwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${encode({ alg: "RS256", kid: "synthetic" })}.${encode(payload)}.synthetic-test-signature`;
}

function tokens(nonce: string, overrides: { access?: object; id?: object; refresh?: string } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: jwt({ iss: config.issuer, client_id: config.client_id, token_use: "access",
      sub: "Opaque-Subject-A", iat: now, auth_time: now - 30, exp: now + 3600,
      scope: "openid email profile", ...overrides.access }),
    id_token: jwt({ iss: config.issuer, aud: config.client_id, token_use: "id", sub: "Opaque-Subject-A",
      iat: now, auth_time: now - 30, exp: now + 3600, nonce, ...overrides.id }),
    refresh_token: overrides.refresh ?? "synthetic-refresh-original",
    token_type: "Bearer", expires_in: 3600, scope: "openid email profile",
  };
}

function callback(url: string): string {
  const request = new URL(url);
  return `${window.location.origin}/auth/callback?code=synthetic-code&state=${request.searchParams.get("state")}`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}


async function signedIn() {
  const scope = newSessionScope();
  const store = new CognitoSessionStore();
  const client = new CognitoClient(config, store);
  const url = await client.begin(scope, "/settings");
  store.setPersistentAllowed(true); // Simulate root controller holding its Web Lock.
  const nonce = new URL(url).searchParams.get("nonce")!;
  server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(nonce))));
  const result = await client.callback(scope, callback(url));
  return { scope, client, store, user: result.user, nonce };
}

describe("Cognito protocol client using the actual OIDC library", () => {
  it("uses the SDK signup transaction unchanged and verifies its PKCE code exchange", async () => {
    const client = new CognitoClient({ ...config, self_registration_enabled: true });
    const scope = newSessionScope();
    const url = new URL(await client.begin(scope, "/settings", undefined, "signup"));
    expect(url.origin + url.pathname).toBe(config.domain + "/signup");
    expect(url.searchParams.get("client_id")).toBe(config.client_id);
    expect(url.searchParams.get("redirect_uri")).toBe(window.location.origin + "/auth/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("code_verifier")).toBe(false);
    const keys = Object.keys(sessionStorage).filter((key) => key.startsWith("hireflux.cognito.transaction.v1."));
    expect(keys).toHaveLength(1);
    const transaction = JSON.parse(sessionStorage.getItem(keys[0])!);
    expect(transaction.data.entry).toBe("signup");
    expect(transaction.id).toBe(url.searchParams.get("state"));
    expect(transaction.nonce).toBe(url.searchParams.get("nonce"));
    const exchange = vi.fn(async ({ request }: { request: Request }) => {
      const body = new URLSearchParams(await request.text());
      expect(body.get("code_verifier")).toBe(transaction.code_verifier);
      expect(body.has("client_secret")).toBe(false);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.get("code_verifier")!));
      expect(btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")).toBe(url.searchParams.get("code_challenge"));
      return HttpResponse.json(tokens(transaction.nonce));
    });
    server.use(http.post(config.domain + "/oauth2/token", exchange));
    expect((await client.callback(scope, callback(url.href))).returnPath).toBe("/settings");
    expect(exchange).toHaveBeenCalledOnce();
  });

  it("rejects disabled signup before creating a transaction and never uses signup for sensitive authentication", async () => {
    const client = new CognitoClient(config);
    await expect(client.begin(newSessionScope(), "/dashboard", undefined, "signup")).rejects.toMatchObject({ code: "ACCOUNT_REGISTRATION_CLOSED" });
    const enabled = new CognitoClient({ ...config, self_registration_enabled: true });
    await expect(enabled.begin(newSessionScope(), "/account", crypto.randomUUID(), "signup")).rejects.toMatchObject({ code: "ACCOUNT_REGISTRATION_CLOSED" });
    expect(Object.keys(sessionStorage).filter((key) => key.includes("transaction"))).toHaveLength(0);
  });

  it("expires delayed signup without token exchange and recovers with a new ordinary sign-in", async () => {
    const scope = newSessionScope();
    const client = new CognitoClient({ ...config, self_registration_enabled: true });
    const signup = await client.begin(scope, "/settings", undefined, "signup");
    const key = Object.keys(sessionStorage).find((x) => x.includes("transaction"))!;
    const transaction = JSON.parse(sessionStorage.getItem(key)!); transaction.created -= 301;
    sessionStorage.setItem(key, JSON.stringify(transaction));
    const exchange = vi.fn(() => HttpResponse.json({}, { status: 400 }));
    server.use(http.post(config.domain + "/oauth2/token", exchange));
    await expect(client.callback(scope, callback(signup))).rejects.toMatchObject({ code: "OAUTH_SIGNUP_EXPIRED", message: expect.stringContaining("Registration may have completed") });
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
    const signIn = new URL(await client.begin(scope, "/settings"));
    expect(signIn.pathname).toBe("/oauth2/authorize");
    expect(signIn.searchParams.get("state")).not.toBe(new URL(signup).searchParams.get("state"));
    expect(signIn.searchParams.get("prompt")).toBe("login");
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(signIn.searchParams.get("nonce")!))));
    expect((await client.callback(scope, callback(signIn.href))).user.profile.sub).toBe("Opaque-Subject-A");
    expect(await client.restore(scope)).not.toBeNull();
  });

  it("handles canceled managed signup without exchanging a code or retaining its transaction", async () => {
    const scope = newSessionScope();
    const client = new CognitoClient({ ...config, self_registration_enabled: true });
    const signup = new URL(await client.begin(scope, "/dashboard", undefined, "signup"));
    const exchange = vi.fn(() => HttpResponse.json({}, { status: 400 }));
    server.use(http.post(config.domain + "/oauth2/token", exchange));
    await expect(client.callback(scope, `${client.redirectUri}?error=access_denied&state=${signup.searchParams.get("state")}`)).rejects.toMatchObject({ code: "OAUTH_CANCELLED" });
    expect(exchange).not.toHaveBeenCalled();
    expect(Object.keys(sessionStorage).filter((key) => key.includes("transaction"))).toHaveLength(0);
    expect(await client.restore(scope)).toBeNull();
  });
  it("uses SDK state/nonce/S256 PKCE with pinned endpoints and no discovery/userInfo", async () => {
    const scope = newSessionScope();
    const client = new CognitoClient(config);
    const url = new URL(await client.begin(scope, "/applications?status=APPLIED"));
    expect(url.origin + url.pathname).toBe(config.domain + "/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("prompt")).toBe("login");
    expect(url.searchParams.get("nonce")).toHaveLength(36);
    const requests: string[] = [];
    server.use(http.post(config.domain + "/oauth2/token", async ({ request }) => {
      requests.push(request.url);
      const body = new URLSearchParams(await request.text());
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("client_id")).toBe(config.client_id);
      expect(body.get("redirect_uri")).toBe(window.location.origin + "/auth/callback");
      expect(body.get("client_secret")).toBeNull();
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.get("code_verifier")!)));
      const challenge = btoa(String.fromCharCode(...digest)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      expect(challenge).toBe(url.searchParams.get("code_challenge"));
      return HttpResponse.json(tokens(url.searchParams.get("nonce")!));
    }));
    const result = await client.callback(scope, callback(url.href));
    expect(result.user.profile.sub).toBe("Opaque-Subject-A");
    expect(result.returnPath).toBe("/applications?status=APPLIED");
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(localStorage)).not.toContain("synthetic-refresh");
  });

  it.each(["nonce", "issuer", "audience", "access-subject", "access-client", "expired-access", "expired-id"])("rejects %s mismatch before persistence", async (mismatch) => {
    const scope = newSessionScope();
    const client = new CognitoClient(config);
    const url = await client.begin(scope);
    const nonce = new URL(url).searchParams.get("nonce")!;
    const now = Math.floor(Date.now() / 1000);
    const id = mismatch === "nonce" ? { nonce: "wrong" } : mismatch === "issuer" ? { iss: "https://attacker.invalid" }
      : mismatch === "audience" ? { aud: "other" } : mismatch === "expired-id" ? { iat: now - 3600, exp: now - 1 } : {};
    const access = mismatch === "access-subject" ? { sub: "Other-Subject" } : mismatch === "access-client" ? { client_id: "other" }
      : mismatch === "expired-access" ? { iat: now - 3600, auth_time: now - 3610, exp: now - 1 } : {};
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(nonce, { id, access }))));
    await expect(client.callback(scope, callback(url))).rejects.toMatchObject({ code: mismatch === "nonce" ? "OAUTH_PROVIDER_UNAVAILABLE" : "OAUTH_SESSION_INVALID" });
    expect(await client.restore(scope)).toBeNull();
  });

  it("consumes callback once and never repeats a code exchange", async () => {
    const { client, scope } = await signedIn();
    await expect(client.callback(scope, window.location.origin + "/auth/callback?code=synthetic-code&state=unknown")).rejects.toMatchObject({ code: "OAUTH_PROVIDER_UNAVAILABLE" });
    expect((await client.restore(scope))?.profile.sub).toBe("Opaque-Subject-A");
  });

  it("rejects state older than five minutes before an exchange", async () => {
    const scope = newSessionScope();
    const client = new CognitoClient(config);
    const url = await client.begin(scope);
    const stateKey = Object.keys(sessionStorage).find((key) => key.includes("transaction"))!;
    const state = JSON.parse(sessionStorage.getItem(stateKey)!);
    state.created -= 301;
    sessionStorage.setItem(stateKey, JSON.stringify(state));
    await expect(client.callback(scope, callback(url))).rejects.toMatchObject({ code: "OAUTH_TRANSACTION_INVALID" });
    expect(sessionStorage.getItem(stateKey)).toBeNull();
  });

  it.each(["&access_token=synthetic", "&iss=https%3A%2F%2Fattacker.invalid", "&code=duplicate", "&error=access_denied"])("rejects unexpected callback protocol parameters %s", async (suffix) => {
    const scope = newSessionScope();
    const client = new CognitoClient(config);
    const url = await client.begin(scope);
    await expect(client.callback(scope, callback(url) + suffix)).rejects.toMatchObject({ code: "OAUTH_SESSION_INVALID" });
    expect(await client.restore(scope)).toBeNull();
  });

  it.each(["https://attacker.invalid/", "/auth/callback", "//attacker.invalid", "/applications/%2e%2e/auth/callback"])("refuses unsafe return path %s", async (path) => {
    await expect(new CognitoClient(config).begin(newSessionScope(), path)).rejects.toMatchObject({ code: "OAUTH_RETURN_PATH_INVALID" });
  });

  it.each(["scope", "logout", "new-login"])("fences delayed callback credentials after %s transition", async (kind) => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore();
    const client = new CognitoClient(config, store);
    const url = await client.begin(scope);
    const seen = deferred<void>();
    const delayed = deferred<Response>();
    server.use(http.post(config.domain + "/oauth2/token", async () => { seen.resolve(); return await delayed.promise; }));
    const promise = client.callback(scope, callback(url));
    await seen.promise;
    if (kind === "scope") newSessionScope();
    else if (kind === "logout") store.advanceLogoutEpoch();
    else await client.begin(scope);
    delayed.resolve(HttpResponse.json(tokens(new URL(url).searchParams.get("nonce")!)));
    await expect(promise).rejects.toBeInstanceOf(StaleSessionError);
    expect(Object.keys(sessionStorage).some((key) => key.includes("cognito.user"))).toBe(false);
  });

  it("persists the rotated credential before returning and rejects changed refresh identity", async () => {
    const { client, store, scope, user, nonce } = await signedIn();
    server.use(http.post(config.domain + "/oauth2/token", async ({ request }) => {
      const body = new URLSearchParams(await request.text());
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("synthetic-refresh-original");
      return HttpResponse.json(tokens(nonce, { refresh: "synthetic-refresh-rotated" }));
    }));
    const refreshed = await client.refresh(scope, user);
    expect(refreshed.refresh_token).toBe("synthetic-refresh-rotated");
    expect(store.readUser(scope)).toContain("synthetic-refresh-rotated");
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(nonce, {
      access: { sub: "Other-Subject" }, id: { sub: "Other-Subject" },
    }))));
    await expect(client.refresh(scope, refreshed)).rejects.toMatchObject({ code: "OAUTH_PROVIDER_UNAVAILABLE" });
  });

  it.each(["missing", "empty", "unchanged"])("rejects %s replacement refresh credentials under rotation", async (kind) => {
    const { client, scope, user, nonce } = await signedIn();
    const response: Record<string, unknown> = tokens(nonce);
    if (kind === "missing") delete response.refresh_token;
    if (kind === "empty") response.refresh_token = "";
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(response)));
    await expect(client.refresh(scope, user)).rejects.toMatchObject({ code: "OAUTH_SESSION_INVALID" });
  });

  it("takes refreshed expiration from the new SDK response as time advances", async () => {
    const { client, scope, user, nonce } = await signedIn();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 60_000);
      server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(nonce, {
        refresh: "synthetic-new-rotation", id: { auth_time: user.profile.auth_time },
        access: { auth_time: user.profile.auth_time },
      }))));
      const refreshed = await client.refresh(scope, user);
      expect(refreshed.expires_at).toBe(user.expires_at! + 60);
      expect((await client.restore(scope))?.expires_at).toBe(refreshed.expires_at);
    } finally { vi.useRealTimers(); }
  });

  it("caps callback expiry at the access token deadline when issuance precedes receipt", async () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore();
    const client = new CognitoClient(config, store);
    const url = await client.begin(scope);
    store.setPersistentAllowed(true);
    const issuedAt = Math.floor(Date.now() / 1000) - 5;
    const nonce = new URL(url).searchParams.get("nonce")!;
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(nonce, {
      access: { iat: issuedAt, exp: issuedAt + 3600 },
      id: { iat: issuedAt, exp: issuedAt + 3600 },
    }))));
    const { user } = await client.callback(scope, callback(url));
    expect(user.expires_at).toBe(issuedAt + 3600);
    expect((await client.restore(scope))?.expires_at).toBe(issuedAt + 3600);
  });

  it("caps rotated expiry at the new access deadline when issuance precedes receipt", async () => {
    const { client, scope, user, nonce } = await signedIn();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 60_000);
      const issuedAt = Math.floor(Date.now() / 1000) - 5;
      server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(tokens(nonce, {
        refresh: "synthetic-latency-rotation",
        access: { iat: issuedAt, exp: issuedAt + 3600, auth_time: user.profile.auth_time },
        id: { iat: issuedAt, exp: issuedAt + 3600, auth_time: user.profile.auth_time },
      }))));
      const refreshed = await client.refresh(scope, user);
      expect(refreshed.expires_at).toBe(issuedAt + 3600);
      expect(refreshed.expires_at).toBe(user.expires_at! + 55);
      expect((await client.restore(scope))?.expires_at).toBe(refreshed.expires_at);
    } finally { vi.useRealTimers(); }
  });

  it("never extends an earlier SDK expiration to the access token deadline", async () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore();
    const client = new CognitoClient(config, store);
    const url = await client.begin(scope);
    store.setPersistentAllowed(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const now = Math.floor(Date.now() / 1000);
      const response = { ...tokens(new URL(url).searchParams.get("nonce")!), expires_in: 3500 };
      server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json(response)));
      const { user } = await client.callback(scope, callback(url));
      expect(user.expires_at).toBe(now + 3500);
      expect((await client.restore(scope))?.expires_at).toBe(now + 3500);
    } finally { vi.useRealTimers(); }
  });

  it("does not retry a lost refresh response or expose provider diagnostics", async () => {
    const { client, scope, user } = await signedIn();
    let attempts = 0;
    server.use(http.post(config.domain + "/oauth2/token", () => { attempts++; return HttpResponse.error(); }));
    await expect(client.refresh(scope, user)).rejects.toMatchObject({ code: "OAUTH_PROVIDER_UNAVAILABLE" });
    expect(attempts).toBe(1);
    server.use(http.post(config.domain + "/oauth2/token", () => HttpResponse.json({ error: "invalid_grant", error_description: "private-provider-details" }, { status: 400 })));
    await expect(client.refresh(scope, user)).rejects.toMatchObject({ code: "OAUTH_SIGNIN_REQUIRED", message: "This session can no longer be renewed. Sign in again." });
  });

  it("never stores captured logout credentials again and uses Cognito's exact logout parameters", async () => {
    const { client, scope, user } = await signedIn();
    client.store.advanceLogoutEpoch();
    server.use(http.post(config.domain + "/oauth2/revoke", async ({ request }) => {
      const body = new URLSearchParams(await request.text());
      expect(body.get("token_type_hint")).toBe("refresh_token");
      expect(body.get("token")).toBe(user.refresh_token);
      return new HttpResponse(null, { status: 200 });
    }));
    await client.revoke(user.refresh_token!);
    expect(await client.restore(scope)).toBeNull();
    const logout = new URL(client.logoutUrl());
    expect([...logout.searchParams.keys()].sort()).toEqual(["client_id", "logout_uri"]);
    expect(logout.searchParams.get("logout_uri")).toBe(window.location.origin + "/auth/signed-out");
    expect(logout.href).not.toContain("synthetic");
  });

  it("does not let a stale restore clear a newer credential", async () => {
    const { client, scope, store, user } = await signedIn();
    const current = newSessionScope();
    store.writeUser(store.capture(current), user.toStorageString());
    await expect(client.restore(scope)).rejects.toBeInstanceOf(StaleSessionError);
    expect((await client.restore(current))?.refresh_token).toBe(user.refresh_token);
  });

  it("rejects a late refresh after logout before it can store a rotated token", async () => {
    const { client, scope, nonce } = await signedIn();
    const user = (await client.restore(scope))!;
    const seen = deferred<void>();
    const delayed = deferred<Response>();
    server.use(http.post(config.domain + "/oauth2/token", async () => { seen.resolve(); return await delayed.promise; }));
    const refresh = client.refresh(scope, user);
    await seen.promise;
    client.store.advanceLogoutEpoch();
    delayed.resolve(HttpResponse.json(tokens(nonce, { refresh: "synthetic-new-rotation" })));
    await expect(refresh).rejects.toBeInstanceOf(StaleSessionError);
    expect(await client.restore(scope)).toBeNull();
  });

  it("bounds a stalled token body and cannot persist a late rotated response", async () => {
    const { client, scope, user, nonce } = await signedIn();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const seen = deferred<void>();
    server.use(http.post(config.domain + "/oauth2/token", () => {
      const stream = new ReadableStream<Uint8Array>({ start(controller) { body = controller; } });
      seen.resolve();
      return new HttpResponse(stream, { headers: { "Content-Type": "application/json" } });
    }));
    vi.useFakeTimers();
    try {
      const refresh = client.refresh(scope, user);
      const failed = expect(refresh).rejects.toMatchObject({ code: "OAUTH_PROVIDER_UNAVAILABLE" });
      await seen.promise;
      await vi.advanceTimersByTimeAsync(10_000);
      await failed;
      body.enqueue(new TextEncoder().encode(JSON.stringify(tokens(nonce, { refresh: "synthetic-late-rotation" }))));
      body.close();
      await Promise.resolve();
      expect(await client.restore(scope)).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
