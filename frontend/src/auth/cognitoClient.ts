import { ErrorResponse, Log, OidcClient, User } from "oidc-client-ts";
import { jwtDecode } from "jwt-decode";
import { ApiError } from "../api/client";
import type { PublicCognitoConfiguration } from "../api/authConfiguration";
import { CognitoSessionStore, type CognitoStoreGuard } from "./cognitoSessionStore";
import { StaleSessionError, type SessionScope } from "./sessionGeneration";
import { safeWorkspaceReturnPath } from "./workspaceReturnPath";

Log.setLevel(Log.NONE);

function invalidSession(): ApiError {
  return new ApiError("OAUTH_SESSION_INVALID", "The account session could not be verified. Sign in again.");
}

function safeSubject(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\p{C}\s#]/u.test(value);
}

function dateClaim(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }

function safeError(error: unknown): never {
  if (error instanceof StaleSessionError || error instanceof ApiError) throw error;
  if (error instanceof ErrorResponse && error.error === "access_denied") {
    throw new ApiError("OAUTH_CANCELLED", "Sign-in was canceled. You can sign in again when ready.");
  }
  if (error instanceof ErrorResponse && error.error && ["invalid_grant", "login_required", "interaction_required"].includes(error.error)) {
    throw new ApiError("OAUTH_SIGNIN_REQUIRED", "This session can no longer be renewed. Sign in again.");
  }
  throw new ApiError("OAUTH_PROVIDER_UNAVAILABLE", "Account sign-in could not finish. Check your connection and start sign-in again.");
}

/** The SDK owns state, nonce comparison, PKCE, code/refresh exchanges and response
 * processing. These extra payload guards implement 5A's application trust/identity
 * consistency requirements, not JWT signature verification; API admission remains
 * the backend's authority. OidcClient avoids UserManager's user writes/events/timers.
 */
export class CognitoClient {
  readonly store: CognitoSessionStore;
  readonly redirectUri: string;
  private readonly logoutUri: string;

  constructor(private readonly config: PublicCognitoConfiguration, store = new CognitoSessionStore()) {
    this.store = store;
    this.redirectUri = new URL("/auth/callback", window.location.origin).href;
    this.logoutUri = new URL("/auth/signed-out", window.location.origin).href;
  }

  private async bounded<T>(operation: Promise<T>, guard?: CognitoStoreGuard): Promise<T> {
    let timer: number | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          // The SDK timeout covers fetch-to-headers. This deadline also bounds
          // body processing; a late SDK result has no user-write side effects.
          if (guard) {
            try { this.store.assertCurrent(guard); this.store.clear(); } catch { /* Never clear a newer identity. */ }
          }
          reject(new ApiError("OAUTH_PROVIDER_UNAVAILABLE", "Account sign-in timed out. Start sign-in again; no automatic retry was made."));
        }, 10_000);
      })]);
    } finally { window.clearTimeout(timer); }
  }

  private sdk(scope: SessionScope): OidcClient {
    const guard = this.store.capture(scope);
    return new OidcClient({
      authority: this.config.issuer, client_id: this.config.client_id,
      redirect_uri: this.redirectUri, response_type: "code", response_mode: "query",
      scope: this.config.scopes.join(" "), disablePKCE: false,
      client_authentication: "client_secret_post", loadUserInfo: false, filterProtocolClaims: false,
      requestTimeoutInSeconds: 10, staleStateAgeInSeconds: 300,
      fetchRequestCredentials: "omit",
      metadata: { issuer: this.config.issuer, authorization_endpoint: this.config.domain + "/oauth2/authorize",
        token_endpoint: this.config.domain + "/oauth2/token", revocation_endpoint: this.config.domain + "/oauth2/revoke" },
      stateStore: this.store.stateStore(guard, this.redirectUri),
    });
  }

  private validate(user: User, allowExpired = false, expectedSub?: string, allowExpiredId = false): void {
    try {
      if (typeof user.access_token !== "string" || user.access_token.length > 8192
        || typeof user.id_token !== "string" || user.id_token.length > 8192
        || (user.refresh_token !== undefined && (typeof user.refresh_token !== "string" || user.refresh_token.length > 8192))
        || user.token_type.toLowerCase() !== "bearer") throw invalidSession();
      const access = jwtDecode<Record<string, unknown>>(user.access_token);
      const id = jwtDecode<Record<string, unknown>>(user.id_token);
      const now = Math.floor(Date.now() / 1000);
      if (!safeSubject(access.sub) || id.sub !== access.sub || user.profile.sub !== access.sub
        || (expectedSub !== undefined && access.sub !== expectedSub)
        || access.iss !== this.config.issuer || id.iss !== this.config.issuer
        || access.client_id !== this.config.client_id || id.aud !== this.config.client_id
        || access.token_use !== "access" || id.token_use !== "id"
        || !dateClaim(access.iat) || !dateClaim(access.exp) || !dateClaim(access.auth_time)
        || !dateClaim(id.iat) || !dateClaim(id.exp)
        || access.exp <= access.iat || access.exp - access.iat > 3600
        || id.exp <= id.iat || id.exp - id.iat > 3600
        || access.auth_time > access.iat || access.iat > now + 60 || id.iat > now + 60
        || (!allowExpired && access.exp <= now)
        || (!allowExpired && !allowExpiredId && id.exp <= now)
        || !dateClaim(user.expires_at)
        || typeof access.scope !== "string" || !this.config.scopes.every((scope) => (access.scope as string).split(" ").includes(scope))
        || !user.scopes.includes("openid") || !user.scopes.includes("email") || !user.scopes.includes("profile")) throw invalidSession();
      // The SDK derives expiry from response receipt, which can lag issuance.
      // Cap it at the validated token deadline without extending an earlier one.
      user.expires_at = Math.min(user.expires_at, access.exp);
    } catch { throw invalidSession(); }
  }

  async begin(scope: SessionScope, returnPath = "/dashboard", sensitiveIntentId?: string, entry: "signin" | "signup" = "signin"): Promise<string> {
    try {
      if (entry === "signup" && (this.config.self_registration_enabled !== true || sensitiveIntentId)) {
        throw new ApiError("ACCOUNT_REGISTRATION_CLOSED", "Account registration is unavailable. You can still sign in to an existing account.");
      }
      const target = safeWorkspaceReturnPath(returnPath);
      if (!target) throw new ApiError("OAUTH_RETURN_PATH_INVALID", "Choose a workspace page, then start sign-in again.");
      const guard = this.store.prepareLogin(scope);
      const request = await this.sdk(scope).createSigninRequest({
        request_type: "si:r", prompt: "login", nonce: crypto.randomUUID(),
        state: { epoch: guard.epoch, instanceId: guard.instanceId, returnPath: target, ...(entry === "signup" ? { entry } : {}), ...(sensitiveIntentId ? { sensitiveIntentId } : {}) },
      });
      this.store.assertCurrent(guard);
      // Reuse the SDK transaction verbatim; only the documented browser page changes.
      const destination = new URL(request.url);
      if (destination.origin !== this.config.domain || destination.pathname !== "/oauth2/authorize") throw invalidSession();
      if (entry === "signup") destination.pathname = "/signup";
      return destination.href;
    } catch (error) { return safeError(error); }
  }

  async callback(scope: SessionScope, url: string, expected?: { subject: string; intentId: string; createdAt: number }): Promise<{ user: User; returnPath: string }> {
    const guard = this.store.capture(scope);
    try {
      const parsed = new URL(url);
      const allowed = new Set(["state", "code", "error", "error_description", "error_uri", "iss", "session_state"]);
      if (parsed.origin + parsed.pathname !== this.redirectUri || parsed.hash
        || [...parsed.searchParams.keys()].some((name) => !allowed.has(name) || parsed.searchParams.getAll(name).length !== 1)
        || (parsed.searchParams.has("iss") && parsed.searchParams.get("iss") !== this.config.issuer)
        || (parsed.searchParams.has("code") && parsed.searchParams.has("error"))
        || parsed.searchParams.getAll("state").length !== 1
        || parsed.searchParams.getAll("code").length > 1
        || (!parsed.searchParams.get("code") && !parsed.searchParams.get("error"))) throw invalidSession();
      const result = await this.bounded(this.sdk(scope).processSigninResponse(url), guard);
      this.store.assertCurrent(guard);
      const user = new User(result);
      this.validate(user, false, expected?.subject);
      const data = result.userState as { returnPath?: unknown; sensitiveIntentId?: unknown } | undefined;
      if (data?.sensitiveIntentId !== expected?.intentId) throw invalidSession();
      if (expected) {
        const access = jwtDecode<{ auth_time: number }>(user.access_token);
        if (access.auth_time < Math.floor(expected.createdAt / 1000) - 60 || Date.now() / 1000 - access.auth_time > 300) throw invalidSession();
      }
      const returnPath = safeWorkspaceReturnPath(data?.returnPath);
      if (!returnPath) throw invalidSession();
      this.store.writeUser(guard, user.toStorageString());
      return { user, returnPath };
    } catch (error) { return safeError(error); }
  }

  async restore(scope: SessionScope): Promise<User | null> {
    const guard = this.store.capture(scope);
    try {
      const serialized = this.store.readUser(scope);
      if (!serialized) return null;
      const user = User.fromStorageString(serialized);
      this.validate(user, true);
      scope.assertCurrent();
      return user;
    } catch (error) {
      try { this.store.assertCurrent(guard); this.store.clear(); } catch { /* A stale restore cannot clear a newer session. */ }
      return safeError(error);
    }
  }

  async refresh(scope: SessionScope, user: User): Promise<User> {
    const guard = this.store.capture(scope);
    try {
      if (!user.refresh_token) throw new ApiError("OAUTH_SIGNIN_REQUIRED", "Sign in again to continue.");
      this.validate(user, true);
      const result = await this.bounded(this.sdk(scope).useRefreshToken({ state: {
        refresh_token: user.refresh_token, id_token: user.id_token, session_state: user.session_state,
        scope: user.scope, profile: user.profile, data: user.state,
      }, timeoutInSeconds: 10 }), guard);
      this.store.assertCurrent(guard);
      // The qualified target enables rotation. Missing/unchanged replacement
      // credentials cannot be treated as a safely persisted refresh family.
      if (typeof result.refresh_token !== "string" || !result.refresh_token
        || result.refresh_token === user.refresh_token) throw invalidSession();
      const refreshed = new User({ ...user, ...result });
      this.validate(refreshed, false, user.profile.sub, result.id_token === user.id_token);
      this.store.writeUser(guard, refreshed.toStorageString());
      return refreshed;
    } catch (error) { return safeError(error); }
  }

  async revoke(refreshToken: string): Promise<void> {
    // This SDK operation never writes a User or raises UserManager events.
    try {
      const sdk = new OidcClient({ authority: this.config.issuer, client_id: this.config.client_id,
        redirect_uri: this.redirectUri,
        requestTimeoutInSeconds: 10, fetchRequestCredentials: "omit",
        stateStore: { set: async () => {}, get: async () => null, remove: async () => null, getAllKeys: async () => [] },
        metadata: { issuer: this.config.issuer, revocation_endpoint: this.config.domain + "/oauth2/revoke" } });
      await this.bounded(sdk.revokeToken(refreshToken, "refresh_token"));
    } catch { throw new ApiError("OAUTH_LOGOUT_INCOMPLETE", "Local access is cleared. Provider sign-out could not be confirmed."); }
  }

  logoutUrl(): string {
    const url = new URL(this.config.domain + "/logout");
    url.searchParams.set("client_id", this.config.client_id);
    url.searchParams.set("logout_uri", this.logoutUri);
    return url.href;
  }

  clear(): void { this.store.clear(); }
}
