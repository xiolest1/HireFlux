import { describe, expect, it, vi } from "vitest";
import { clearStoredCognitoState, COGNITO_LOGOUT_EPOCH_KEY, CognitoSessionStore } from "./cognitoSessionStore";
import { newSessionScope, StaleSessionError } from "./sessionGeneration";

function context(store: CognitoSessionStore, redirect = window.location.origin + "/auth/callback"): string {
  return JSON.stringify({ id: "test-state", data: { epoch: store.epoch, instanceId: store.instanceId, returnPath: "/settings" },
    created: Math.floor(Date.now() / 1000), authority: "https://pool.invalid", client_id: "fake",
    redirect_uri: redirect, request_type: "si:r", code_verifier: "a".repeat(96), nonce: "synthetic-nonce-for-test" });
}

describe("Cognito operation-bound tab store", () => {
  it("clears stored Cognito data without configuration and preserves unrelated/demo state", () => {
    const keys = ["hireflux.cognito.user.v1", "hireflux.cognito.instance.v1", "hireflux.cognito.transaction.v1.pending"];
    for (const key of keys) sessionStorage.setItem(key, "synthetic");
    sessionStorage.setItem("hireflux.demo.v1", "independent demo");
    const epoch = crypto.randomUUID();
    localStorage.setItem(COGNITO_LOGOUT_EPOCH_KEY, epoch);
    clearStoredCognitoState();
    expect(keys.every((key) => sessionStorage.getItem(key) === null)).toBe(true);
    expect(sessionStorage.getItem("hireflux.demo.v1")).toBe("independent demo");
    expect(localStorage.getItem(COGNITO_LOGOUT_EPOCH_KEY)).toBe(epoch);
  });

  it("fences a stale identity before a credential write", () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore({ persistent: true });
    const guard = store.capture(scope);
    newSessionScope();
    expect(() => store.writeUser(guard, "synthetic-user")).toThrow(StaleSessionError);
    expect(Object.keys(sessionStorage).some((key) => key.includes("cognito.user"))).toBe(false);
  });

  it("fences a different logout epoch even without an identity-generation change", () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore({ persistent: true });
    const guard = store.capture(scope);
    localStorage.setItem(COGNITO_LOGOUT_EPOCH_KEY, crypto.randomUUID());
    expect(() => store.writeUser(guard, "synthetic-user")).toThrow(StaleSessionError);
  });

  it("consumes a transaction synchronously so a duplicate cannot read it", async () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore();
    const guard = store.prepareLogin(scope);
    const state = store.stateStore(guard, window.location.origin + "/auth/callback");
    await state.set("state", context(store));
    const a = state.remove("state");
    const b = state.remove("state");
    expect(await a).not.toBeNull();
    expect(await b).toBeNull();
  });

  it("prevents a previous operation overwriting a newer login", async () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore();
    const a = store.prepareLogin(scope);
    const state = store.stateStore(a, window.location.origin + "/auth/callback");
    const old = context(store);
    store.prepareLogin(scope);
    await expect(state.set("old", old)).rejects.toBeInstanceOf(StaleSessionError);
  });

  it("allows memory-only credentials without pretending they restore after reload", () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore({ persistent: false });
    store.writeUser(store.capture(scope), "synthetic-user");
    expect(store.readUser(scope)).toBe("synthetic-user");
    const reloaded = new CognitoSessionStore({ persistent: false });
    expect(reloaded.readUser(scope)).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("synthetic-user");
    expect(JSON.stringify(sessionStorage)).not.toContain("synthetic-user");
  });

  it("refuses full-page login if tab/epoch storage is unavailable", () => {
    const scope = newSessionScope();
    for (const options of [{ sessionStorage: null }, { localStorage: null }]) {
      expect(() => new CognitoSessionStore(options).prepareLogin(scope)).toThrow("Secure tab storage is unavailable");
    }
  });

  it("invalidates persistent rotation when its synchronous storage write fails", () => {
    const scope = newSessionScope();
    const store = new CognitoSessionStore({ persistent: true });
    const guard = store.capture(scope);
    store.writeUser(guard, "synthetic-old-credential");
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key: string, value: string) {
      if (key.includes("cognito.user")) throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    });
    expect(() => store.writeUser(guard, "synthetic-rotated-credential")).toThrow("Secure tab storage is unavailable");
    spy.mockRestore();
    expect(store.readUser(scope)).toBeNull();
    expect(() => store.writeUser(guard, "synthetic-delayed")).toThrow(StaleSessionError);
  });
});
