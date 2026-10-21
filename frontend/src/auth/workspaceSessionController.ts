import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { createDemoOperationKey } from "../api/demoSessions";
import { createQueryClient } from "../app/queryClient";
import { clearIdentityUiState } from "./identityCleanup";
import { bindRequestScope, newSessionScope, StaleSessionError, type SessionScope } from "./sessionGeneration";
import { configuredSessionAdapter, type AdapterWorkspace, type SessionAdapter } from "./sessionAdapters";
import { workspaceCapabilities } from "./workspaceCapabilities";
import { loadAuthConfiguration, type AuthConfiguration } from "../api/authConfiguration";
import { CognitoSessionAdapter } from "./cognitoSessionAdapter";
import { broadcastAccountLogout, observeAccountLogout } from "./cognitoCoordination";
import { createDemoAdapter } from "./sessionAdapters";
import { safeWorkspaceReturnPath } from "./workspaceReturnPath";
import type { CredentialSource } from "./sessionGeneration";
import { clearStoredCognitoState } from "./cognitoSessionStore";
import { consumeSensitiveIntent, invalidIntent, readSensitiveIntent, storeSensitiveIntent, type SensitiveIntent, type SensitiveOperation } from "./sensitiveIntent";
import { deleteAccount, exportAccount, getAccountDeletionStatus, type AccountDeletionStatus } from "../api/accountLifecycle";
import { downloadInSession } from "./sessionGeneration";

interface SessionBase { scope: SessionScope; queryClient: QueryClient }
export interface ReadySession extends SessionBase {
  status: "ready";
  workspace: AdapterWorkspace;
  capabilities: ReturnType<typeof workspaceCapabilities>;
  error?: unknown;
  credentialStatus?: "refreshing";
}
export interface AccountManagementSession extends SessionBase {
  status: "account-management";
  intent: SensitiveIntent;
  busy?: boolean;
  consumed?: boolean;
  completed?: boolean;
  deletion?: AccountDeletionStatus;
  error?: unknown;
}
export type WorkspaceSessionState =
  | (SessionBase & { status: "initializing" | "anonymous" })
  | (SessionBase & { status: "expired"; reason: "expired" | "invalidated" })
  | (SessionBase & { status: "activating" | "bootstrapping" | "authenticating" | "callback" | "restoring" | "signing-out" })
  | (SessionBase & { status: "switching"; operation: "reset" })
  | (SessionBase & { status: "error"; error: unknown; operation: "restore" | "activate" | "configuration" | "account" | "account-bootstrap" | "logout" })
  | ReadySession | AccountManagementSession;

export interface ControllerOptions {
  loadConfiguration?: () => Promise<AuthConfiguration>;
  accountFactory?: (config: NonNullable<AuthConfiguration["cognito"]>, failed: (error: ApiError) => void, refreshing: (value: boolean) => void) => CognitoSessionAdapter;
  navigateExternal?: (url: string) => void;
}
const SELECTED = "hireflux.selected-workspace.v1";
const LOGOUT_NOTICE = "hireflux.logout-unconfirmed.v1";
export const ACCOUNT_DELETION_NOTICE = "hireflux.account-deletion-outcome.v1";

export class WorkspaceSessionController {
  private state: WorkspaceSessionState;
  private readonly listeners = new Set<() => void>();
  private readonly dirty = new Set<symbol>();
  private adapter?: SessionAdapter;
  private initialized = false;
  private pending?: { scope: SessionScope; promise: Promise<ReadySession> };
  private operationKey: string | null = null;
  private account?: CognitoSessionAdapter;
  private authConfig?: AuthConfiguration;
  private configError?: unknown;
  private configPromise?: Promise<void>;
  private callbackPending?: Promise<{ ready: ReadySession | AccountManagementSession; returnPath: string }>;
  private callbackAttempted = false;
  private stopLogoutObservation?: () => void;
  private readonly managed: boolean;
  private disposed = false;
  private configRevision = 0;
  private selected: string | null;

  constructor(adapter?: SessionAdapter, private readonly clientFactory = createQueryClient, private readonly options: ControllerOptions = {}) {
    const scope = newSessionScope(null, (reason) => this.invalidate(reason));
    this.state = { status: "initializing", scope, queryClient: clientFactory() };
    this.managed = !adapter;
    try { this.selected = window.sessionStorage.getItem(SELECTED); } catch { this.selected = null; }
    try { this.adapter = adapter ?? configuredSessionAdapter(); }
    catch (error) { this.state = { ...this.state, status: "error", error, operation: "configuration" }; }
  }

  getSnapshot = (): WorkspaceSessionState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  get adapterId(): string | undefined { return this.adapter?.id; }
  get lifetime() { return this.adapter?.lifetime; }
  get authenticationConfiguration() { return this.authConfig; }
  get authenticationConfigurationError() { return this.configError; }
  get accountEntryAvailable() { return Boolean(this.authConfig?.cognito && this.account); }
  get demoEntryAvailable() { return !this.authConfig || this.authConfig.capabilities.includes("demo"); }
  get providerLogoutUnconfirmed() { try { return window.sessionStorage.getItem(LOGOUT_NOTICE) === "true"; } catch { return false; } }
  private select(value: "demo" | "cognito" | "none"): void {
    this.selected = value;
    if (!this.managed) return;
    try { window.sessionStorage.setItem(SELECTED, value); } catch { /* Memory-only selection. */ }
  }
  get hasUnsavedChanges(): boolean { return this.dirty.size > 0; }
  registerUnsaved(scope: SessionScope): () => void {
    if (!scope.isCurrent()) return () => {};
    const key = Symbol();
    this.dirty.add(key);
    return () => this.dirty.delete(key);
  }

  observeReadySession(state: ReadySession): (() => void) | undefined {
    return this.adapter?.observe?.(state.workspace, (reason) => {
      if (state.scope.isCurrent()) this.invalidate(reason);
    });
  }

  private publish(state: WorkspaceSessionState): void {
    if (this.disposed) return;
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private next(authorization: string | null = null, preserveManualTimeZone = false, cleanup = true, credentials?: CredentialSource): SessionBase {
    // Invalidate continuations before cancelling requests or publishing replacement state.
    const scope = newSessionScope(authorization, (reason) => this.invalidate(reason), credentials);
    void this.state.queryClient.cancelQueries();
    this.state.queryClient.clear();
    this.dirty.clear();
    if (cleanup) clearIdentityUiState({ preserveManualTimeZone });
    return { scope, queryClient: this.clientFactory() };
  }

  private ready(workspace: AdapterWorkspace, error?: unknown, restoring = false): ReadySession {
    const base = this.next(workspace.authorization, Boolean(error), !restoring || workspace.lifetime === "durable", workspace.credentials);
    this.adapter?.persist(workspace);
    if (workspace.bootstrap) {
      base.queryClient.setQueryData(["me"], workspace.bootstrap.profile);
      base.queryClient.setQueryData(["settings"], workspace.bootstrap.settings);
    }
    const state: ReadySession = { ...base, status: "ready", workspace, capabilities: workspaceCapabilities(workspace.lifetime, workspace.identityKind), error };
    this.publish(state);
    return state;
  }

  initialize = async (): Promise<void> => {
    if (this.disposed || this.initialized || !this.adapter) return;
    this.initialized = true;
    bindRequestScope(this.state.scope);
    const initializingScope = this.state.scope;
    if (this.managed && this.adapter.id !== "local") {
      await this.configure();
      if (!initializingScope.isCurrent()) return;
      if (["/auth/callback", "/auth/signed-out"].includes(window.location.pathname)) {
        if (window.location.pathname === "/auth/signed-out") { this.account?.clear(); clearStoredCognitoState(); this.select("none"); }
        if (this.state.status === "initializing") this.publish({ ...this.state, status: "anonymous" });
        return;
      }
      if (this.selected === "none") { this.publish({ ...this.state, status: "anonymous" }); return; }
      if (this.selected === "cognito") {
        if (!this.account || this.configError) { this.publish({ ...this.state, status: "error", error: this.configError ?? new ApiError("ACCOUNT_UNAVAILABLE", "Account sign-in is unavailable on this backend."), operation: "configuration" }); return; }
        this.adapter = this.account;
      }
      if (this.adapter.id === "demo" && this.authConfig && !this.authConfig.capabilities.includes("demo")) {
        this.adapter.clear(); this.publish({ ...this.state, status: "anonymous" }); return;
      }
    }
    const base = this.adapter === this.account ? this.next(null, false, true, this.account) : this.state;
    if (this.adapter === this.account) this.publish({ ...base, status: "restoring" });
    else if (this.adapter.lifetime === "durable") this.publish({ ...base, status: "bootstrapping" });
    try {
      const result = this.adapter.restore(base.scope);
      const restored = result instanceof Promise ? await result : result;
      base.scope.assertCurrent();
      if (restored === "expired") this.publish({ ...base, status: "expired", reason: "expired" });
      else if (restored) {
        this.ready(restored, undefined, true);
      } else this.publish({ ...base, status: "anonymous" });
    } catch (error) {
      if (base.scope.isCurrent()) this.publish({ ...base, status: "error", error, operation: this.adapter === this.account ? this.account?.hasAccount() ? "account-bootstrap" : "account" : "restore" });
    }
  };

  activate = (reset = false): Promise<ReadySession> => {
    if (this.pending?.scope.isCurrent()) return this.pending.promise;
    if (!this.adapter) return Promise.reject(new ApiError("SESSION_CONFIGURATION", "Workspace mode is unavailable."));
    const previous = reset && this.state.status === "ready" ? this.state.workspace : undefined;
    if (reset && previous?.lifetime !== "temporary") return Promise.reject(new Error("Only temporary workspaces can be reset."));
    const base = this.next(null, Boolean(previous), true, this.adapter === this.account ? this.account : undefined);
    this.adapter.clear();
    this.publish(reset ? { ...base, status: "switching", operation: "reset" } : {
      ...base, status: this.adapter.lifetime === "durable" ? "bootstrapping" : "activating",
    });
    this.operationKey ??= createDemoOperationKey();
    const promise = this.adapter.activate(base.scope, this.operationKey).then((workspace) => {
      base.scope.assertCurrent();
      this.operationKey = null;
      return this.ready(workspace);
    }).catch((error: unknown) => {
      base.scope.assertCurrent();
      if (!(error instanceof ApiError && ["NETWORK_ERROR", "DEMO_PROVISIONING_IN_PROGRESS"].includes(error.code))) this.operationKey = null;
      if (previous && this.adapter?.valid(previous)) this.ready(previous, error);
      else this.publish({ ...base, status: "error", error, operation: "activate" });
      throw error;
    }).finally(() => {
      if (this.pending?.scope === base.scope) this.pending = undefined;
    });
    this.pending = { scope: base.scope, promise };
    return promise;
  };

  abandonReset = (): void => {
    if (this.state.status === "switching") return;
    this.operationKey = null;
    if (this.state.status === "ready") this.publish({ ...this.state, error: undefined });
  };

  leave = ({ discard = false } = {}): boolean => {
    if (this.hasUnsavedChanges && !discard) return false;
    const base = this.next();
    this.adapter?.clear();
    if (this.account && this.adapter !== this.account) this.account.clear();
    clearStoredCognitoState();
    this.select("none");
    this.operationKey = null;
    this.publish({ ...base, status: "anonymous" });
    return true;
  };

  /** Also usable by a future credential-free adapter invalidation event. */
  invalidate = (reason: "expired" | "invalidated" = "invalidated"): void => {
    const base = this.next();
    this.adapter?.clear();
    if (this.account && this.adapter !== this.account) this.account.clear();
    clearStoredCognitoState();
    this.select("none");
    this.operationKey = null;
    this.publish({ ...base, status: "expired", reason });
  };

  disposeIfUnused = (): void => {
    if (this.listeners.size) return;
    this.disposed = true;
    if (this.state.scope.isCurrent()) newSessionScope();
    void this.state.queryClient.cancelQueries();
    this.state.queryClient.clear();
    this.account?.releaseOwnership();
    this.stopLogoutObservation?.(); this.stopLogoutObservation = undefined;
  };

  private configure(): Promise<void> {
    if (this.configPromise) return this.configPromise;
    const revision = ++this.configRevision;
    this.configPromise = (this.options.loadConfiguration ?? loadAuthConfiguration)().then((config) => {
      if (this.disposed || revision !== this.configRevision) return;
      this.authConfig = config; this.configError = undefined;
      if (config.cognito && !this.account) {
        const factory = this.options.accountFactory ?? ((value, failed, refreshing) => new CognitoSessionAdapter(value, failed, refreshing));
        this.account = factory(config.cognito, this.accountFailed, (refreshing) => {
          if (this.state.status === "ready" && this.state.workspace.identityKind === "PERSISTENT") this.publish({ ...this.state, credentialStatus: refreshing ? "refreshing" : undefined });
        });
        if (this.selected === "none") this.account.clear();
        this.stopLogoutObservation = observeAccountLogout(() => {
          if (this.adapter === this.account && this.selected === "cognito") this.invalidate();
          else this.account?.clear(); // Demo keeps its own independent session.
        });
      }
      this.publish({ ...this.state });
    }).catch((error: unknown) => { if (!this.disposed && revision === this.configRevision) { this.configError = error; this.publish({ ...this.state }); } });
    return this.configPromise;
  }

  retryAuthenticationConfiguration = async (): Promise<void> => {
    this.configPromise = undefined;
    await this.configure();
  };

  private accountFailed = (error: ApiError): void => {
    const base = this.next();
    this.select("none");
    this.publish({ ...base, status: "error", error, operation: "account" });
  };

  activateDemo = async ({ discard = false } = {}): Promise<ReadySession> => {
    if (this.hasUnsavedChanges && !discard) throw new ApiError("UNSAVED_CHANGES", "Confirm leaving your unsaved changes first.");
    if (!this.demoEntryAvailable) throw new ApiError("DEMO_UNAVAILABLE", "Demo workspaces are unavailable on this backend.");
    if (this.adapter?.id === "local") return this.activate();
    if (this.adapter === this.account) {
      const base = this.next(); this.account?.clear(); this.publish({ ...base, status: "anonymous" });
    }
    if (this.adapter?.id !== "demo") this.adapter = createDemoAdapter();
    this.select("demo");
    return this.activate();
  };

  beginSignIn = (returnPath = "/dashboard", { discard = false } = {}): Promise<boolean> => this.startAccountLogin(returnPath, discard);

  beginSensitiveOperation = (operation: SensitiveOperation, confirmation = "", { discard = false } = {}): Promise<boolean> => {
    if (!this.account?.subject() || this.adapter !== this.account || !this.authConfig?.cognito) return Promise.reject(invalidIntent());
    if (operation === "delete" && (!this.authConfig.account_management_enabled || confirmation !== "DELETE_MY_ACCOUNT")) return Promise.reject(new ApiError("ACCOUNT_CONFIRMATION_REQUIRED", "Type DELETE_MY_ACCOUNT exactly before verifying your identity."));
    const intent: SensitiveIntent = {
      id: crypto.randomUUID(), operation, subject: this.account.subject()!,
      issuer: this.authConfig.cognito.issuer, clientId: this.authConfig.cognito.client_id,
      originalGeneration: this.state.scope.generation, createdAt: Date.now(),
      epoch: this.account.client.store.epoch, instanceId: "pending", confirmed: operation === "delete",
    };
    return this.startAccountLogin("/account", discard, intent);
  };

  private startAccountLogin = async (returnPath: string, discard: boolean, intent?: SensitiveIntent): Promise<boolean> => {
    if (this.hasUnsavedChanges && !discard) return false;
    const base = this.next();
    this.adapter?.clear();
    try { window.sessionStorage.removeItem(ACCOUNT_DELETION_NOTICE); } catch { /* No credential is stored in this notice. */ }
    this.select("cognito"); this.operationKey = null; this.callbackAttempted = false;
    this.publish({ ...base, status: "authenticating" });
    try {
      await this.configure(); base.scope.assertCurrent();
      if (!this.account || this.configError) throw new ApiError("ACCOUNT_UNAVAILABLE", "Account sign-in is unavailable. Retry account configuration first.");
      this.adapter = this.account;
      const url = await this.account.begin(base.scope, safeWorkspaceReturnPath(returnPath) ?? "/dashboard", intent?.id);
      base.scope.assertCurrent();
      if (intent) storeSensitiveIntent({ ...intent, instanceId: this.account.client.store.instanceId }, this.account.client.store, base.scope);
      (this.options.navigateExternal ?? ((value) => window.location.assign(value)))(url);
      return true;
    } catch (error) {
      if (base.scope.isCurrent()) {
        this.account?.clear();
        this.publish({ ...base, status: "error", operation: "account", error: error instanceof ApiError ? error : new ApiError("ACCOUNT_SIGN_IN_REQUIRED", "Sign-in could not be started. Please try again.") });
      }
      throw error;
    }
  };

  completeOAuthCallback = (url: string): Promise<{ ready: ReadySession | AccountManagementSession; returnPath: string }> => {
    if (this.selected !== "cognito") return Promise.reject(new ApiError("OAUTH_CALLBACK_INVALID", "This sign-in request was canceled or is not active. Start sign-in again."));
    if (this.callbackPending) return this.callbackPending;
    if (this.callbackAttempted) return Promise.reject(new ApiError("OAUTH_CALLBACK_INVALID", "This sign-in response has already been processed. Start sign-in again."));
    this.callbackAttempted = true;
    const pendingBase = this.next();
    this.publish({ ...pendingBase, status: "callback" });
    const promise = this.configure().then(async () => {
      pendingBase.scope.assertCurrent();
      if (!this.account || this.configError) throw new ApiError("ACCOUNT_UNAVAILABLE", "Account configuration is unavailable. Start sign-in again when it is restored.");
      const intent = readSensitiveIntent(this.account.client.store, this.authConfig!.cognito!);
      const base = this.next(null, false, true, this.account);
      if (this.adapter?.id === "demo") this.adapter.clear();
      this.adapter = this.account;
      this.select("cognito"); this.publish({ ...base, status: "callback" });
      try {
        if (intent) {
          await this.account.reauthenticateCallback(base.scope, url, { subject: intent.subject, intentId: intent.id, createdAt: intent.createdAt });
          base.scope.assertCurrent();
          const management: AccountManagementSession = { ...base, status: "account-management", intent };
          this.publish(management);
          return { ready: management, returnPath: "/account" };
        }
        const result = await this.account.callback(base.scope, url);
        base.scope.assertCurrent();
        return { ready: this.ready(result.workspace), returnPath: result.returnPath };
      } catch (error) {
        if (intent && base.scope.isCurrent()) this.account.clear();
        if (base.scope.isCurrent()) this.publish({ ...base, status: "error", operation: this.account.hasAccount() ? "account-bootstrap" : "account", error: error instanceof ApiError ? error : new ApiError("OAUTH_CALLBACK_INVALID", "Sign-in could not be completed. Start sign-in again.") });
        throw error;
      }
    }).catch((error: unknown) => {
      if (pendingBase.scope.isCurrent()) this.publish({ ...pendingBase, status: "error", operation: "account", error: error instanceof ApiError ? error : new ApiError("OAUTH_CALLBACK_INVALID", "Sign-in could not be completed. Start sign-in again.") });
      throw error;
    }).finally(() => { if (this.callbackPending === promise) this.callbackPending = undefined; });
    this.callbackPending = promise;
    return promise;
  };

  private consumeIntent(operation: SensitiveOperation): AccountManagementSession {
    const state = this.state;
    if (state.status !== "account-management" || state.busy || state.consumed || !this.account || !this.authConfig?.cognito) throw invalidIntent();
    consumeSensitiveIntent(state.intent, operation, this.account.client.store, this.authConfig.cognito, state.scope, this.account.subject());
    this.publish({ ...state, consumed: true, busy: true, error: undefined });
    return state;
  }

  performSensitiveExport = async (): Promise<void> => {
    const state = this.consumeIntent("export");
    try {
      const data = await exportAccount(state.scope);
      state.scope.assertCurrent();
      downloadInSession(state.scope, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "hireflux-workspace-export.json");
      this.publish({ ...state, consumed: true, completed: true });
    } catch (error) {
      if (state.scope.isCurrent()) this.publish({ ...state, consumed: true, error });
      throw error;
    }
  };

  performAccountDeletion = async (): Promise<void> => {
    const state = this.consumeIntent("delete");
    try {
      try { window.sessionStorage.setItem(ACCOUNT_DELETION_NOTICE, "unknown"); } catch { /* No authority or credential is stored. */ }
      const deletion = await deleteAccount(state.scope);
      state.scope.assertCurrent();
      this.publishDeletionProgress(state, deletion);
    } catch (error) {
      if (state.scope.isCurrent()) this.publish({ ...state, consumed: true, error });
      throw error;
    }
  };

  reviewAccountDeletion = async (): Promise<void> => {
    const state = this.state;
    if (state.status !== "account-management" || state.intent.operation !== "delete" || state.busy) throw invalidIntent();
    this.publish({ ...state, busy: true });
    try {
      const deletion = await getAccountDeletionStatus(state.scope);
      state.scope.assertCurrent();
      this.publishDeletionProgress(state, deletion);
    } catch (error) {
      if (state.scope.isCurrent()) this.publish({ ...state, busy: false, error });
      throw error;
    }
  };

  private publishDeletionProgress(state: AccountManagementSession, deletion: AccountDeletionStatus): void {
    if (deletion.state === "DELETED" && ["COMPLETE", "REVIEW_REQUIRED"].includes(deletion.provider_finalization ?? "")) {
      const base = this.next();
      const epoch = this.account!.client.store.advanceLogoutEpoch();
      this.account!.clear(); this.select("none");
      const complete = deletion.provider_finalization === "COMPLETE";
      try { window.sessionStorage.setItem(ACCOUNT_DELETION_NOTICE, complete ? "complete" : "review"); } catch { /* Presentation only. */ }
      this.publish({ ...base, status: "account-management", intent: state.intent, consumed: true, completed: complete, deletion });
      broadcastAccountLogout(epoch);
    } else this.publish({ ...state, deletion, consumed: true, error: undefined, busy: false });
  }

  retryAccountBootstrap = async (): Promise<ReadySession> => {
    if (!this.account?.hasAccount()) throw new ApiError("ACCOUNT_SIGN_IN_REQUIRED", "Sign in again to continue.");
    const base = this.next(null, false, true, this.account);
    this.publish({ ...base, status: "bootstrapping" });
    try {
      const workspace = await this.account.activate(base.scope);
      base.scope.assertCurrent(); return this.ready(workspace);
    } catch (error) {
      if (base.scope.isCurrent()) this.publish({ ...base, status: "error", error, operation: "account-bootstrap" });
      throw error;
    }
  };

  signOut = async ({ discard = false } = {}): Promise<boolean> => {
    if (this.hasUnsavedChanges && !discard) return false;
    if (this.adapter !== this.account || !this.account) return this.leave({ discard });
    const refreshToken = this.account.captureRefreshToken();
    const client = this.account.client;
    const base = this.next(); // Local access ends before any provider operation.
    const epoch = client.store.advanceLogoutEpoch();
    this.account.clear(); this.select("none"); this.operationKey = null;
    this.publish({ ...base, status: "signing-out" });
    broadcastAccountLogout(epoch);
    let unconfirmed = false;
    try { if (refreshToken) await client.revoke(refreshToken); } catch { unconfirmed = true; }
    base.scope.assertCurrent();
    try { window.sessionStorage.setItem(LOGOUT_NOTICE, String(unconfirmed)); } catch { /* Local credentials are already gone. */ }
    this.publish({ ...base, status: "anonymous" });
    try { (this.options.navigateExternal ?? ((value) => window.location.assign(value)))(client.logoutUrl()); }
    catch { try { window.sessionStorage.setItem(LOGOUT_NOTICE, "true"); } catch { /* No credentials retained. */ } this.publish({ ...base, status: "error", operation: "logout", error: new ApiError("PROVIDER_LOGOUT_UNCONFIRMED", "Signed out locally. Provider sign-out could not be confirmed; the managed-login cookie may remain.") }); }
    return true;
  };

  finishProviderLogout = (): void => {
    if (this.account) (this.options.navigateExternal ?? ((value) => window.location.assign(value)))(this.account.client.logoutUrl());
  };

  acceptSignedOut = (): void => {
    const base = this.next();
    this.account?.clear();
    clearStoredCognitoState();
    this.select("none");
    this.publish({ ...base, status: "anonymous" });
  };
}

export { StaleSessionError };
