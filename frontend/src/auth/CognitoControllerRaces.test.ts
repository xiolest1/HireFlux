import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import type { AuthConfiguration } from "../api/authConfiguration";
import { createQueryClient } from "../app/queryClient";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";
import { CognitoSessionAdapter } from "./cognitoSessionAdapter";
import { loadDemoSession, saveDemoSession } from "./sessionStore";
import { StaleSessionError, WorkspaceSessionController, type ControllerOptions } from "./workspaceSessionController";

const SELECTED = "hireflux.selected-workspace.v1";
const USER = "hireflux.cognito.user.v1";
const INSTANCE = "hireflux.cognito.instance.v1";
const TRANSACTION = "hireflux.cognito.transaction.v1.synthetic-state";
const callbackUrl = `${window.location.origin}/auth/callback?code=synthetic-code&state=synthetic-state`;
const hybrid: AuthConfiguration = {
  version: 1, environment: "test", capabilities: ["demo", "cognito"],
  account_data_policy: "local_development", account_management_enabled: false,
  cognito: {
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY",
    client_id: "testonlypublicclient", domain: STAGING_COGNITO_ORIGIN,
    scopes: ["openid", "email", "profile"],
    self_registration_enabled: false,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const controllers: WorkspaceSessionController[] = [];
function managedController(options: ControllerOptions) {
  const controller = new WorkspaceSessionController(undefined, createQueryClient, options);
  controllers.push(controller);
  return controller;
}
function accountFactory() {
  return vi.fn<NonNullable<ControllerOptions["accountFactory"]>>((config, failed, refreshing) => {
    const account = new CognitoSessionAdapter(config, failed, refreshing);
    vi.spyOn(account, "begin").mockResolvedValue(`${config.domain}/oauth2/authorize`);
    vi.spyOn(account, "callback").mockRejectedValue(new Error("Canceled callback must not run."));
    vi.spyOn(account, "restore").mockResolvedValue(null);
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
  controllers.splice(0).forEach((controller) => controller.disposeIfUnused());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Cognito controller configuration and cancellation fences", () => {
  it("serializes signup clicks and passes an explicit signup intent once", async () => {
    const config = deferred<AuthConfiguration>(), factory = accountFactory(), navigate = vi.fn();
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory, navigateExternal: navigate });
    const first = controller.beginSignUp("/settings");
    expect(controller.beginSignUp("/settings")).toBe(first);
    config.resolve({ ...hybrid, cognito: { ...hybrid.cognito!, self_registration_enabled: true } });
    await first;
    expect(factory.mock.results[0].value.begin).toHaveBeenCalledExactlyOnceWith(expect.anything(), "/settings", undefined, "signup");
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("does not turn a concurrent Sign In into signup or merge a different sensitive intent", async () => {
    const config = deferred<AuthConfiguration>(), factory = accountFactory(), navigate = vi.fn();
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory, navigateExternal: navigate });
    const signIn = controller.beginSignIn();
    await expect(controller.beginSignUp()).rejects.toMatchObject({ code: "ACCOUNT_ENTRY_BUSY" });
    config.resolve(hybrid);
    await signIn;
    expect(factory.mock.results[0].value.begin).toHaveBeenCalledExactlyOnceWith(expect.anything(), "/dashboard", undefined, "signin");
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("clears the attempted transaction after canceled provider navigation without demo fallback", async () => {
    const factory = accountFactory();
    const controller = managedController({ loadConfiguration: async () => ({ ...hybrid, cognito: { ...hybrid.cognito!, self_registration_enabled: true } }), accountFactory: factory,
      navigateExternal: () => { throw new Error("Synthetic blocked navigation"); } });
    await expect(controller.beginSignUp()).rejects.toThrow();
    expect(factory.mock.results[0].value.clear).toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe("error");
    expect(loadDemoSession().session).toBeNull();
  });

  it.each(["closed", "unsupported", "malformed", "unavailable"])("blocks %s signup at the controller boundary without demo fallback", async (fault) => {
    const factory = accountFactory(), navigate = vi.fn();
    const controller = managedController({ loadConfiguration: async () => {
      if (fault === "malformed" || fault === "unavailable") throw new ApiError("AUTH_CONFIGURATION_INVALID", "Configuration unavailable.");
      return fault === "unsupported" ? { ...hybrid, capabilities: ["demo"], cognito: undefined } : hybrid;
    }, accountFactory: factory, navigateExternal: navigate });
    await expect(controller.beginSignUp()).rejects.toBeInstanceOf(ApiError);
    expect(navigate).not.toHaveBeenCalled();
    for (const result of factory.mock.results) expect(result.value.begin).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe("error");
    expect(loadDemoSession().session).toBeNull();
  });

  it("cancels stale signup and permits a fresh Sign In without replaying the canceled intent", async () => {
    const config = deferred<AuthConfiguration>(), factory = accountFactory(), navigate = vi.fn();
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory, navigateExternal: navigate });
    const signup = controller.beginSignUp();
    const canceled = expect(signup).rejects.toBeInstanceOf(StaleSessionError);
    controller.leave();
    const signIn = controller.beginSignIn();
    config.resolve({ ...hybrid, cognito: { ...hybrid.cognito!, self_registration_enabled: true } });
    await canceled; await signIn;
    expect(factory.mock.results[0].value.begin).toHaveBeenCalledExactlyOnceWith(expect.anything(), "/dashboard", undefined, "signin");
    expect(navigate).toHaveBeenCalledOnce();
  });
  it("never starts provider navigation after sign-in is canceled during configuration", async () => {
    const config = deferred<AuthConfiguration>();
    const factory = accountFactory();
    const navigate = vi.fn();
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory, navigateExternal: navigate });

    const signIn = controller.beginSignIn("/settings");
    const canceled = expect(signIn).rejects.toBeInstanceOf(StaleSessionError);
    expect(controller.getSnapshot().status).toBe("authenticating");
    expect(controller.leave()).toBe(true);
    config.resolve(hybrid);
    await canceled;

    expect(factory).toHaveBeenCalledOnce();
    const account = factory.mock.results[0].value;
    expect(account.clear).toHaveBeenCalled();
    expect(account.begin).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SELECTED)).toBe("none");
    expect(controller.getSnapshot().status).toBe("anonymous");
  });

  it("never exchanges a callback after canceling while configuration is pending", async () => {
    window.sessionStorage.setItem(SELECTED, "cognito");
    window.sessionStorage.setItem(TRANSACTION, "synthetic-transaction");
    const config = deferred<AuthConfiguration>();
    const factory = accountFactory();
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory });

    const completion = controller.completeOAuthCallback(callbackUrl);
    const canceled = expect(completion).rejects.toBeInstanceOf(StaleSessionError);
    expect(controller.getSnapshot().status).toBe("callback");
    controller.leave();
    expect(window.sessionStorage.getItem(TRANSACTION)).toBeNull();
    config.resolve(hybrid);
    await canceled;

    expect(factory.mock.results[0].value.callback).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe("anonymous");
    expect(window.sessionStorage.getItem(SELECTED)).toBe("none");
  });

  it("rejects a canceled callback after controller replacement before loading configuration", async () => {
    window.sessionStorage.setItem(SELECTED, "cognito");
    const first = managedController({ loadConfiguration: async () => hybrid });
    first.leave();
    first.disposeIfUnused();
    const load = vi.fn(async () => hybrid);
    const factory = accountFactory();
    const replacement = managedController({ loadConfiguration: load, accountFactory: factory });

    await expect(replacement.completeOAuthCallback(callbackUrl)).rejects.toMatchObject({ code: "OAUTH_CALLBACK_INVALID" });
    expect(load).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
    await replacement.initialize();
    expect(replacement.getSnapshot().status).toBe("anonymous");
    expect(factory.mock.results[0].value.restore).not.toHaveBeenCalled();
  });

  it("ignores late configuration after disposal without constructing an adapter or observing logout", async () => {
    const config = deferred<AuthConfiguration>();
    const factory = accountFactory();
    const observation = vi.spyOn(window, "addEventListener");
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory });
    const initialization = controller.initialize();
    controller.disposeIfUnused();

    window.sessionStorage.setItem(USER, "replacement-synthetic-user");
    window.sessionStorage.setItem(INSTANCE, "replacement-instance");
    window.sessionStorage.setItem(TRANSACTION, "replacement-transaction");
    const replacement = managedController({ loadConfiguration: async () => hybrid });
    const replacementScope = replacement.getSnapshot().scope;
    const storageObservers = () => observation.mock.calls.filter(([event]) => event === "storage").length;
    const observedBefore = storageObservers();
    config.resolve(hybrid);
    await initialization;

    expect(factory).not.toHaveBeenCalled();
    expect(storageObservers()).toBe(observedBefore);
    expect(controller.authenticationConfiguration).toBeUndefined();
    expect(replacementScope.isCurrent()).toBe(true);
    expect(window.sessionStorage.getItem(USER)).toBe("replacement-synthetic-user");
    expect(window.sessionStorage.getItem(INSTANCE)).toBe("replacement-instance");
    expect(window.sessionStorage.getItem(TRANSACTION)).toBe("replacement-transaction");
  });

  it("refuses stored demo credentials when the backend advertises Cognito only", async () => {
    window.sessionStorage.setItem(SELECTED, "demo");
    saveDemoSession({ access_token: "test.demo.credential.long.enough.123456", token_type: "Bearer", expires_at: "2099-08-11T12:00:00Z" });
    const factory = accountFactory();
    const controller = managedController({ loadConfiguration: async () => ({ ...hybrid, capabilities: ["cognito"] }), accountFactory: factory });

    await controller.initialize();

    expect(controller.getSnapshot().status).toBe("anonymous");
    expect(controller.demoEntryAvailable).toBe(false);
    expect(loadDemoSession().session).toBeNull();
    expect(factory.mock.results[0].value.restore).not.toHaveBeenCalled();
  });

  it("clears stored account credentials on the signed-out return even when configuration fails", async () => {
    window.sessionStorage.setItem(SELECTED, "cognito");
    window.sessionStorage.setItem(USER, "synthetic-stored-user");
    window.sessionStorage.setItem(INSTANCE, "synthetic-instance");
    window.sessionStorage.setItem(TRANSACTION, "synthetic-transaction");
    window.sessionStorage.setItem("hireflux.presentation.fixture", "keep-unrelated-state");
    const config = deferred<AuthConfiguration>();
    const factory = accountFactory();
    const controller = managedController({ loadConfiguration: () => config.promise, accountFactory: factory });
    const initialization = controller.initialize();

    controller.acceptSignedOut();
    expect(window.sessionStorage.getItem(USER)).toBeNull();
    expect(window.sessionStorage.getItem(INSTANCE)).toBeNull();
    expect(window.sessionStorage.getItem(TRANSACTION)).toBeNull();
    expect(window.sessionStorage.getItem("hireflux.presentation.fixture")).toBe("keep-unrelated-state");
    expect(window.sessionStorage.getItem(SELECTED)).toBe("none");
    config.reject(new ApiError("AUTH_CONFIGURATION_UNAVAILABLE", "Synthetic configuration outage."));
    await initialization;
    expect(controller.getSnapshot().status).toBe("anonymous");
    expect(factory).not.toHaveBeenCalled();

    controller.disposeIfUnused();
    const reload = managedController({ loadConfiguration: async () => { throw new ApiError("AUTH_CONFIGURATION_UNAVAILABLE", "Synthetic configuration outage."); }, accountFactory: factory });
    await reload.initialize();
    expect(reload.getSnapshot().status).toBe("anonymous");
    expect(window.sessionStorage.getItem(USER)).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });
});
