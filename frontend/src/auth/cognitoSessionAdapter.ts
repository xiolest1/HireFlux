import type { User } from "oidc-client-ts";
import { ApiError } from "../api/client";
import { bootstrapWorkspace } from "../api/workspaceBootstrap";
import type { PublicCognitoConfiguration } from "../api/authConfiguration";
import { CognitoClient } from "./cognitoClient";
import { acquireSessionOwnership, type SessionOwnership } from "./cognitoCoordination";
import type { AdapterWorkspace, SessionAdapter } from "./sessionAdapters";
import { StaleSessionError, type CredentialSource, type SessionScope } from "./sessionGeneration";

export class CognitoSessionAdapter implements SessionAdapter, CredentialSource {
  readonly id = "cognito";
  readonly lifetime = "durable";
  private user: User | null = null;
  private serial = 0;
  private refreshing?: Promise<void>;
  private owner?: SessionOwnership & { status: "owned" };
  private ownedInstance?: string;
  readonly client: CognitoClient;

  constructor(
    config: PublicCognitoConfiguration,
    private readonly failed: (error: ApiError) => void,
    private readonly refreshingChanged: (refreshing: boolean) => void = () => {},
    client?: CognitoClient,
  ) { this.client = client ?? new CognitoClient(config); }

  revision = (): number => this.serial;
  async lease(scope: SessionScope) {
    scope.assertCurrent();
    if (!this.user) throw new ApiError("ACCOUNT_SIGN_IN_REQUIRED", "Sign in again to continue. Saved workspace data is preserved.", 401);
    if ((this.user.expires_at ?? 0) <= Date.now() / 1000 + 60) {
      if (!this.refreshing) {
        const previous = this.user;
        // Fence old-revision 401s as soon as coordinated renewal begins.
        ++this.serial;
        this.refreshingChanged(true);
        const refresh = this.client.refresh(scope, previous).then((user) => {
          scope.assertCurrent();
          if (this.user !== previous) throw new StaleSessionError();
          this.user = user;
        }).catch((error: unknown) => {
          if (!scope.isCurrent()) throw new StaleSessionError();
          // A lost rotation response is ambiguous. One attempt; no family revocation
          // or refresh retry. Interactive sign-in starts a new provider transaction.
          this.clear();
          const safe = error instanceof ApiError ? error : new ApiError("ACCOUNT_SIGN_IN_REQUIRED", "Session renewal could not be completed. Sign in again; saved data is preserved.");
          this.failed(safe);
          throw safe;
        }).finally(() => {
          if (this.refreshing === refresh) this.refreshing = undefined;
          if (scope.isCurrent()) this.refreshingChanged(false);
        });
        this.refreshing = refresh;
      }
      await this.refreshing;
    }
    scope.assertCurrent();
    if (!this.user || (this.user.expires_at ?? 0) <= Date.now() / 1000) throw new ApiError("ACCOUNT_SIGN_IN_REQUIRED", "Sign in again to continue.", 401);
    return { authorization: `Bearer ${this.user.access_token}`, revision: this.serial };
  }

  private async ownership(scope: SessionScope, restoring: boolean): Promise<boolean> {
    if (this.owner && this.ownedInstance === this.client.store.instanceId) return true;
    this.owner?.release(); this.owner = undefined;
    this.client.store.setPersistentAllowed(false);
    const owner = await acquireSessionOwnership(this.client.store.instanceId);
    if (!scope.isCurrent()) { if (owner.status === "owned") owner.release(); throw new StaleSessionError(); }
    if (owner.status === "busy") {
      this.client.clear();
      throw new ApiError("ACCOUNT_DUPLICATE_TAB", "This account session is open in another tab. Sign in here to create an independent session.");
    }
    if (owner.status === "owned") {
      this.owner = owner; this.ownedInstance = this.client.store.instanceId;
      this.client.store.setPersistentAllowed(true);
      return true;
    }
    if (restoring) { this.client.clear(); return false; }
    return true; // Memory-only callback session: reload must sign in again.
  }

  async restore(scope: SessionScope): Promise<AdapterWorkspace | null> {
    if (!await this.ownership(scope, true)) return null;
    this.user = await this.client.restore(scope);
    scope.assertCurrent();
    return this.user ? this.activate(scope) : null;
  }

  async begin(scope: SessionScope, returnPath: string, sensitiveIntentId?: string): Promise<string> {
    this.clear();
    return this.client.begin(scope, returnPath, sensitiveIntentId);
  }

  subject(): string | undefined { return this.user?.profile.sub; }

  async reauthenticateCallback(scope: SessionScope, url: string, expected: { subject: string; intentId: string; createdAt: number }): Promise<void> {
    await this.ownership(scope, false);
    const result = await this.client.callback(scope, url, expected);
    scope.assertCurrent();
    this.user = result.user;
    ++this.serial;
    // Restricted management only. Backend independently admits/rechecks freshness;
    // a DELETING workspace must never bootstrap back into normal product pages.
  }

  async callback(scope: SessionScope, url: string): Promise<{ workspace: AdapterWorkspace; returnPath: string }> {
    await this.ownership(scope, false);
    const result = await this.client.callback(scope, url);
    scope.assertCurrent();
    this.user = result.user;
    ++this.serial;
    return { workspace: await this.activate(scope), returnPath: result.returnPath };
  }

  async activate(scope: SessionScope): Promise<AdapterWorkspace> {
    if (!this.user) throw new ApiError("ACCOUNT_SIGN_IN_REQUIRED", "Sign in again to continue.");
    const bootstrap = await bootstrapWorkspace(scope);
    scope.assertCurrent();
    if (bootstrap.identity_kind !== "PERSISTENT" || bootstrap.profile.user_id !== this.user.profile.sub || bootstrap.profile.role !== "STANDARD_USER") {
      this.clear();
      throw new ApiError("ACCOUNT_IDENTITY_MISMATCH", "Account identity could not be confirmed. Sign in again.");
    }
    return { lifetime: "durable", identityKind: "PERSISTENT", authorization: null, credentials: this, bootstrap };
  }
  persist(): void { /* Protocol client persists only guarded credential state. */ }
  valid(workspace: AdapterWorkspace): boolean { return workspace.identityKind === "PERSISTENT" && Boolean(this.user); }
  clear(): void {
    this.user = null; ++this.serial;
    this.client.clear(); this.owner?.release(); this.owner = undefined;
    this.ownedInstance = undefined; this.client.store.setPersistentAllowed(false);
  }
  captureRefreshToken(): string | undefined { return this.user?.refresh_token; }
  hasAccount(): boolean { return this.user !== null; }
  releaseOwnership(): void { this.owner?.release(); this.owner = undefined; this.ownedInstance = undefined; }
}
