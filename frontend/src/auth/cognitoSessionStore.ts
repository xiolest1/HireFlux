import type { StateStore } from "oidc-client-ts";
import { ApiError } from "../api/client";
import { type SessionScope, StaleSessionError } from "./sessionGeneration";
import { safeWorkspaceReturnPath } from "./workspaceReturnPath";

export const COGNITO_LOGOUT_EPOCH_KEY = "hireflux.cognito.logout-epoch.v1";
export const COGNITO_SENSITIVE_INTENT_KEY = "hireflux.cognito.sensitive-intent.v1";
const INSTANCE_KEY = "hireflux.cognito.instance.v1";
const USER_KEY = "hireflux.cognito.user.v1";
const TRANSACTION_PREFIX = "hireflux.cognito.transaction.v1.";

/** Cleanup must also work before public configuration can construct a client. */
export function clearStoredCognitoState(): void {
  let storage: Storage;
  try { storage = window.sessionStorage; } catch { return; }
  const keys = [USER_KEY, INSTANCE_KEY, COGNITO_SENSITIVE_INTENT_KEY];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(TRANSACTION_PREFIX)) keys.push(key);
    }
  } catch { /* Still attempt removal of the known user and instance records. */ }
  for (const key of keys) {
    try { storage.removeItem(key); } catch { /* Best effort; no unrelated tab state is removed. */ }
  }
}

export interface CognitoStoreGuard {
  readonly scope: SessionScope;
  readonly epoch: string;
  readonly instanceId: string;
  readonly revision: number;
}

export interface CognitoTransactionContext {
  epoch: string;
  instanceId: string;
  returnPath: string;
  sensitiveIntentId?: string;
}

interface StoreOptions {
  sessionStorage?: Storage | null;
  localStorage?: Storage | null;
  persistent?: boolean;
}

function availableStorage(kind: "sessionStorage" | "localStorage"): Storage | null {
  try {
    const storage = window[kind];
    const probe = "hireflux.cognito.storage-probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch { return null; }
}

function storageFailure(): ApiError {
  return new ApiError("OAUTH_STORAGE_UNAVAILABLE", "Secure tab storage is unavailable. Enable browser storage, then sign in again.");
}

function opaque(): string { return crypto.randomUUID(); }

/** Tokens use tab storage only while the controller owns the refresh-family Web Lock.
 * Transactions still need tab storage for the full-page redirect. No async storage
 * adapter is used: every final fence and native write/consume share one JS turn.
 */
export class CognitoSessionStore {
  private readonly session: Storage | null;
  private readonly local: Storage | null;
  private instance: string;
  private memoryEpoch = opaque();
  private revision = 0;
  private memoryUser: string | null = null;
  private persistent: boolean;

  constructor(options: StoreOptions = {}) {
    this.session = options.sessionStorage === undefined ? availableStorage("sessionStorage") : options.sessionStorage;
    this.local = options.localStorage === undefined ? availableStorage("localStorage") : options.localStorage;
    this.persistent = options.persistent ?? false;
    let instance: string | null = null;
    try { instance = this.session?.getItem(INSTANCE_KEY) ?? null; } catch { /* Refuse reload restoration below. */ }
    this.instance = instance && /^[A-Za-z0-9-]{16,80}$/.test(instance) ? instance : opaque();
    try { this.session?.setItem(INSTANCE_KEY, this.instance); } catch { this.persistent = false; }
    void this.epoch;
  }

  get instanceId(): string { return this.instance; }
  get epoch(): string {
    if (!this.local) return this.memoryEpoch;
    try {
      const value = this.local.getItem(COGNITO_LOGOUT_EPOCH_KEY);
      if (value && /^[A-Za-z0-9-]{16,80}$/.test(value)) return value;
      const replacement = opaque();
      this.local.setItem(COGNITO_LOGOUT_EPOCH_KEY, replacement);
      this.memoryEpoch = replacement;
      return replacement;
    } catch { this.persistent = false; return this.memoryEpoch; }
  }

  setPersistentAllowed(allowed: boolean): void {
    this.persistent = allowed && this.session !== null && this.local !== null;
  }

  capture(scope: SessionScope): CognitoStoreGuard {
    scope.assertCurrent();
    return { scope, epoch: this.epoch, instanceId: this.instance, revision: this.revision };
  }

  assertCurrent(guard: CognitoStoreGuard): void {
    guard.scope.assertCurrent();
    if (guard.epoch !== this.epoch || guard.instanceId !== this.instance || guard.revision !== this.revision) throw new StaleSessionError();
  }

  prepareLogin(scope: SessionScope): CognitoStoreGuard {
    scope.assertCurrent();
    if (!this.session || !this.local) throw storageFailure();
    this.persistent = false;
    this.clear();
    this.instance = opaque();
    try { this.session.setItem(INSTANCE_KEY, this.instance); } catch { throw storageFailure(); }
    return this.capture(scope);
  }

  private transactionContext(raw: string, guard: CognitoStoreGuard, redirectUri: string): CognitoTransactionContext {
    const state = JSON.parse(raw) as Record<string, unknown>;
    const data = state.data as Partial<CognitoTransactionContext> | undefined;
    const now = Math.floor(Date.now() / 1000);
    if (!data || data.epoch !== guard.epoch || data.instanceId !== guard.instanceId
      || typeof state.created !== "number" || !Number.isInteger(state.created)
      || state.created > now + 60 || now - state.created > 300
      || state.redirect_uri !== redirectUri || state.request_type !== "si:r"
      || state.client_secret !== undefined || (state.extraTokenParams !== undefined
        && (typeof state.extraTokenParams !== "object" || state.extraTokenParams === null || Object.keys(state.extraTokenParams).length !== 0))
      || typeof state.nonce !== "string" || state.nonce.length < 16
      || typeof state.code_verifier !== "string" || state.code_verifier.length < 43
      || (data.sensitiveIntentId !== undefined && (typeof data.sensitiveIntentId !== "string" || !/^[A-Za-z0-9-]{36}$/.test(data.sensitiveIntentId)))
      || !safeWorkspaceReturnPath(data.returnPath)) {
      throw new ApiError("OAUTH_TRANSACTION_INVALID", "This sign-in request has expired or is no longer valid. Start sign-in again.");
    }
    return data as CognitoTransactionContext;
  }

  stateStore(guard: CognitoStoreGuard, redirectUri: string): StateStore {
    const read = (key: string, remove: boolean): string | null => {
      this.assertCurrent(guard);
      if (!this.session) throw storageFailure();
      let raw: string | null;
      try {
        raw = this.session.getItem(TRANSACTION_PREFIX + key);
        // Consume atomically before any library await or token exchange.
        if (remove) this.session.removeItem(TRANSACTION_PREFIX + key);
      } catch { throw storageFailure(); }
      if (raw) this.transactionContext(raw, guard, redirectUri);
      this.assertCurrent(guard);
      return raw;
    };
    return {
      set: async (key, value) => {
        this.assertCurrent(guard);
        if (!this.session) throw storageFailure();
        this.transactionContext(value, guard, redirectUri);
        this.assertCurrent(guard);
        try { this.session.setItem(TRANSACTION_PREFIX + key, value); } catch { throw storageFailure(); }
      },
      get: async (key) => read(key, false),
      remove: async (key) => read(key, true),
      getAllKeys: async () => {
        this.assertCurrent(guard);
        const keys: string[] = [];
        if (!this.session) return keys;
        for (let i = 0; i < this.session.length; i++) {
          const key = this.session.key(i);
          if (key?.startsWith(TRANSACTION_PREFIX)) keys.push(key.slice(TRANSACTION_PREFIX.length));
        }
        return keys;
      },
    };
  }

  readUser(scope: SessionScope): string | null {
    const guard = this.capture(scope);
    let raw = this.memoryUser;
    try { if (!raw && this.persistent) raw = this.session?.getItem(USER_KEY) ?? null; } catch { throw storageFailure(); }
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw) as { epoch?: unknown; instanceId?: unknown; user?: unknown };
      if (envelope.epoch !== guard.epoch || envelope.instanceId !== guard.instanceId || typeof envelope.user !== "string") {
        this.clear();
        return null;
      }
      this.assertCurrent(guard);
      return envelope.user;
    } catch (error) {
      if (error instanceof StaleSessionError) throw error;
      this.clear();
      throw storageFailure();
    }
  }

  writeUser(guard: CognitoStoreGuard, user: string): void {
    this.assertCurrent(guard);
    const envelope = JSON.stringify({ epoch: guard.epoch, instanceId: guard.instanceId, user });
    if (this.persistent) {
      // A failed rotated-token write cannot masquerade as a restorable session.
      try { this.session!.setItem(USER_KEY, envelope); }
      catch { this.clear(); throw storageFailure(); }
    }
    this.memoryUser = envelope;
  }

  advanceLogoutEpoch(): string {
    const epoch = opaque();
    this.memoryEpoch = epoch;
    try { this.local?.setItem(COGNITO_LOGOUT_EPOCH_KEY, epoch); } catch { this.persistent = false; }
    this.clear();
    return epoch;
  }

  clear(): void {
    ++this.revision;
    this.memoryUser = null;
    try {
      this.session?.removeItem(USER_KEY);
      this.session?.removeItem(COGNITO_SENSITIVE_INTENT_KEY);
      const keys: string[] = [];
      for (let i = 0; this.session && i < this.session.length; i++) {
        const key = this.session.key(i);
        if (key?.startsWith(TRANSACTION_PREFIX)) keys.push(key);
      }
      for (const key of keys) this.session!.removeItem(key);
    } catch { /* Scope/epoch fencing still removes local access if storage is broken. */ }
  }
}
