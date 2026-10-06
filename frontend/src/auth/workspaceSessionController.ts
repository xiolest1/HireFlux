import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { createDemoOperationKey } from "../api/demoSessions";
import { createQueryClient } from "../app/queryClient";
import { clearIdentityUiState } from "./identityCleanup";
import { bindRequestScope, newSessionScope, StaleSessionError, type SessionScope } from "./sessionGeneration";
import { configuredSessionAdapter, type AdapterWorkspace, type SessionAdapter } from "./sessionAdapters";
import { workspaceCapabilities } from "./workspaceCapabilities";

interface SessionBase { scope: SessionScope; queryClient: QueryClient }
export interface ReadySession extends SessionBase {
  status: "ready";
  workspace: AdapterWorkspace;
  capabilities: ReturnType<typeof workspaceCapabilities>;
  error?: unknown;
}
export type WorkspaceSessionState =
  | (SessionBase & { status: "initializing" | "anonymous" })
  | (SessionBase & { status: "expired"; reason: "expired" | "invalidated" })
  | (SessionBase & { status: "activating" | "bootstrapping" })
  | (SessionBase & { status: "switching"; operation: "reset" })
  | (SessionBase & { status: "error"; error: unknown; operation: "restore" | "activate" | "configuration" })
  | ReadySession;

export class WorkspaceSessionController {
  private state: WorkspaceSessionState;
  private readonly listeners = new Set<() => void>();
  private readonly dirty = new Set<symbol>();
  private adapter?: SessionAdapter;
  private initialized = false;
  private pending?: { scope: SessionScope; promise: Promise<ReadySession> };
  private operationKey: string | null = null;

  constructor(adapter?: SessionAdapter, private readonly clientFactory = createQueryClient) {
    const scope = newSessionScope(null, (reason) => this.invalidate(reason));
    this.state = { status: "initializing", scope, queryClient: clientFactory() };
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
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private next(authorization: string | null = null, preserveManualTimeZone = false, cleanup = true): SessionBase {
    // Invalidate continuations before cancelling requests or publishing replacement state.
    const scope = newSessionScope(authorization, (reason) => this.invalidate(reason));
    void this.state.queryClient.cancelQueries();
    this.state.queryClient.clear();
    this.dirty.clear();
    if (cleanup) clearIdentityUiState({ preserveManualTimeZone });
    return { scope, queryClient: this.clientFactory() };
  }

  private ready(workspace: AdapterWorkspace, error?: unknown, restoring = false): ReadySession {
    const base = this.next(workspace.authorization, Boolean(error), !restoring || workspace.lifetime === "durable");
    this.adapter?.persist(workspace);
    if (workspace.bootstrap) {
      base.queryClient.setQueryData(["me"], workspace.bootstrap.profile);
      base.queryClient.setQueryData(["settings"], workspace.bootstrap.settings);
    }
    const state: ReadySession = { ...base, status: "ready", workspace, capabilities: workspaceCapabilities(workspace.lifetime), error };
    this.publish(state);
    return state;
  }

  initialize = async (): Promise<void> => {
    if (this.initialized || !this.adapter) return;
    this.initialized = true;
    bindRequestScope(this.state.scope);
    const base = this.state;
    if (this.adapter.lifetime === "durable") this.publish({ ...base, status: "bootstrapping" });
    try {
      const result = this.adapter.restore(base.scope);
      const restored = result instanceof Promise ? await result : result;
      base.scope.assertCurrent();
      if (restored === "expired") this.publish({ ...base, status: "expired", reason: "expired" });
      else if (restored) {
        this.ready(restored, undefined, true);
      } else this.publish({ ...base, status: "anonymous" });
    } catch (error) {
      if (base.scope.isCurrent()) this.publish({ ...base, status: "error", error, operation: "restore" });
    }
  };

  activate = (reset = false): Promise<ReadySession> => {
    if (this.pending?.scope.isCurrent()) return this.pending.promise;
    if (!this.adapter) return Promise.reject(new ApiError("SESSION_CONFIGURATION", "Workspace mode is unavailable."));
    const previous = reset && this.state.status === "ready" ? this.state.workspace : undefined;
    if (reset && previous?.lifetime !== "temporary") return Promise.reject(new Error("Only temporary workspaces can be reset."));
    const base = this.next(null, Boolean(previous));
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
    this.operationKey = null;
    this.publish({ ...base, status: "anonymous" });
    return true;
  };

  /** Also usable by a future credential-free adapter invalidation event. */
  invalidate = (reason: "expired" | "invalidated" = "invalidated"): void => {
    const base = this.next();
    this.adapter?.clear();
    this.operationKey = null;
    this.publish({ ...base, status: "expired", reason });
  };

  disposeIfUnused = (): void => {
    if (this.listeners.size) return;
    if (this.state.scope.isCurrent()) newSessionScope();
    void this.state.queryClient.cancelQueries();
    this.state.queryClient.clear();
  };
}

export { StaleSessionError };
