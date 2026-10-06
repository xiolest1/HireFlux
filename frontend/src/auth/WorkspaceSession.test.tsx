import { StrictMode, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { apiDownload, apiRequest, ApiError } from "../api/client";
import { workspaceBootstrapSchema, type WorkspaceBootstrap } from "../api/workspaceBootstrap";
import { testDashboard, testSettings, testUser } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";
import { renderApp } from "../test/renderApp";
import { createDemoAdapter, createLocalDurableAdapter, configuredSessionAdapter, type AdapterWorkspace, type SessionAdapter } from "./sessionAdapters";
import { WorkspaceSessionController } from "./workspaceSessionController";
import { WorkspaceSessionProvider } from "./WorkspaceSessionProvider";
import { useWorkspaceSession } from "./workspaceSessionContext";
import { useWorkspaceMutation } from "./workspaceQueries";
import { downloadInSession, inSessionScope, StaleSessionError } from "./sessionGeneration";
import { saveDemoSession } from "./sessionStore";
import { safeWorkspaceReturnPath } from "./workspaceReturnPath";

const bootstrap: WorkspaceBootstrap = {
  state: "ACTIVE", identity_kind: "LOCAL", bootstrap_version: 1,
  created_at: "2026-08-10T13:00:00Z", updated_at: "2026-08-10T13:00:00Z",
  profile: { ...testUser, user_id: "00000000-0000-4000-8000-000000000001", name: "Local Workspace User", last_login_at: null },
  settings: { ...testSettings, time_zone: "Asia/Tokyo", theme: "LIGHT" },
};
const demo = { access_token: "test.demo.credential.long.enough.123456", token_type: "Bearer" as const, expires_at: "2099-08-11T12:00:00Z" };
const workspaceA: AdapterWorkspace = { lifetime: "temporary", identityKind: "DEMO", authorization: "Bearer workspace-A", demo };
const workspaceB: AdapterWorkspace = { lifetime: "durable", identityKind: "LOCAL", authorization: null, bootstrap };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function adapter(restored: AdapterWorkspace | null = workspaceA, activate = () => Promise.resolve(workspaceB)): SessionAdapter {
  return { id: "test", lifetime: restored?.lifetime ?? "durable", restore: () => restored, activate, persist: vi.fn(), clear: vi.fn(), valid: () => true };
}
async function controllerFor(restored: AdapterWorkspace | null = workspaceA) {
  const controller = new WorkspaceSessionController(adapter(restored));
  await controller.initialize();
  return controller;
}
function ready(controller: WorkspaceSessionController) {
  const state = controller.getSnapshot();
  if (state.status !== "ready") throw new Error("Expected a ready workspace.");
  return state;
}

describe("workspace activation and lifecycle", () => {
  it("initializes anonymous, restores a demo, and recognizes an expired stored demo", async () => {
    const anonymous = new WorkspaceSessionController(createDemoAdapter());
    expect(anonymous.getSnapshot().status).toBe("initializing");
    await anonymous.initialize();
    expect(anonymous.getSnapshot().status).toBe("anonymous");
    saveDemoSession(demo);
    const restored = new WorkspaceSessionController(createDemoAdapter());
    await restored.initialize();
    expect(ready(restored).capabilities.temporary).toBe(true);
    saveDemoSession({ ...demo, expires_at: "2020-01-01T00:00:00Z" });
    const expired = new WorkspaceSessionController(createDemoAdapter());
    await expired.initialize();
    expect(expired.getSnapshot().status).toBe("expired");
  });

  it("runs one bootstrap in StrictMode and seeds profile/settings before ordinary queries", async () => {
    let bootstraps = 0;
    let ordinaryReads = 0;
    const pending = deferred<void>();
    server.use(
      http.post(`${API_ORIGIN}/api/v1/me/bootstrap`, async ({ request }) => {
        expect(request.headers.get("authorization")).toBeNull();
        expect(await request.json()).toEqual({});
        bootstraps++;
        await pending.promise;
        return HttpResponse.json(bootstrap);
      }),
      http.get(`${API_ORIGIN}/api/v1/me`, () => { ordinaryReads++; return HttpResponse.json(bootstrap.profile); }),
      http.get(`${API_ORIGIN}/api/v1/settings`, () => { ordinaryReads++; return HttpResponse.json(bootstrap.settings); }),
    );
    const controller = new WorkspaceSessionController(createLocalDurableAdapter());
    function Probe() { const { state } = useWorkspaceSession(); return <p>{state.status}</p>; }
    render(<StrictMode><WorkspaceSessionProvider controller={controller}><Probe /></WorkspaceSessionProvider></StrictMode>);
    expect(screen.getByText("bootstrapping")).toBeVisible();
    await waitFor(() => expect(bootstraps).toBe(1));
    expect(ordinaryReads).toBe(0);
    await act(async () => pending.resolve());
    expect(await screen.findByText("ready")).toBeVisible();
    expect(ready(controller).queryClient.getQueryData(["settings"])).toEqual(bootstrap.settings);
    expect(ready(controller).queryClient.getQueryData(["me"])).toEqual(bootstrap.profile);
    expect(ordinaryReads).toBe(0);
  });

  it("replays local bootstrap on refresh without changing data or preferences", async () => {
    let calls = 0;
    server.use(http.post(`${API_ORIGIN}/api/v1/me/bootstrap`, () => { calls++; return HttpResponse.json(bootstrap); }));
    const first = new WorkspaceSessionController(createLocalDurableAdapter());
    await first.initialize();
    const refreshed = new WorkspaceSessionController(createLocalDurableAdapter());
    await refreshed.initialize();
    expect(ready(refreshed).workspace.bootstrap).toEqual(ready(first).workspace.bootstrap);
    expect(calls).toBe(2);
    expect(refreshed.leave()).toBe(true);
    expect(refreshed.getSnapshot().queryClient.getQueryCache().getAll()).toHaveLength(0);
    const leftOnRefresh = new WorkspaceSessionController(createLocalDurableAdapter());
    await leftOnRefresh.initialize();
    expect(leftOnRefresh.getSnapshot().status).toBe("anonymous");
    expect(calls).toBe(2);
    await leftOnRefresh.activate();
    expect(ready(leftOnRefresh).workspace.bootstrap).toEqual(bootstrap);
    expect(calls).toBe(3);
  });

  it.each([503, 409])("keeps bootstrap %s stable and retries only on explicit activation", async (status) => {
    let attempts = 0;
    server.use(http.post(`${API_ORIGIN}/api/v1/me/bootstrap`, () => {
      attempts++;
      return attempts === 1 ? HttpResponse.json({ error: { code: status === 409 ? "WORKSPACE_BOOTSTRAP_CONFLICT" : "DEPENDENCY_UNAVAILABLE", message: "Workspace preparation is unavailable.", request_id: "bootstrap-test" } }, { status }) : HttpResponse.json(bootstrap);
    }));
    const controller = new WorkspaceSessionController(createLocalDurableAdapter());
    await controller.initialize();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", error: { status, requestId: "bootstrap-test" } });
    expect(attempts).toBe(1);
    await controller.activate();
    expect(ready(controller).workspace.bootstrap?.settings).toEqual(bootstrap.settings);
    expect(attempts).toBe(2);
  });

  it("restores only a still-valid previous demo after reset failure", async () => {
    const failure = new ApiError("RESET_FAILED", "Try again.", 503);
    const failing = adapter(workspaceA, () => Promise.reject(failure));
    const controller = new WorkspaceSessionController(failing);
    await controller.initialize();
    const before = ready(controller);
    await expect(controller.activate(true)).rejects.toBe(failure);
    expect(ready(controller).workspace).toBe(workspaceA);
    expect(ready(controller).scope.generation).toBeGreaterThan(before.scope.generation);
    expect(ready(controller).queryClient).not.toBe(before.queryClient);
    failing.valid = () => false;
    await expect(controller.activate(true)).rejects.toBe(failure);
    expect(controller.getSnapshot().status).toBe("error");
  });

  it("never publishes an already expired issued demo as ready", async () => {
    server.use(http.post(`${API_ORIGIN}/api/v1/demo-sessions`, () => HttpResponse.json({ ...demo, expires_at: "2020-01-01T00:00:00Z" }, { status: 201 })));
    const controller = new WorkspaceSessionController(createDemoAdapter());
    await controller.initialize();
    await expect(controller.activate()).rejects.toMatchObject({ code: "DEMO_SESSION_EXPIRED" });
    expect(controller.getSnapshot().status).toBe("error");
    expect(window.sessionStorage.getItem("hireflux.demo-session.v1")).toBeNull();
  });

  it("discards a late bootstrap after leave and a late reset after a newer activation", async () => {
    const delayedBootstrap = deferred<AdapterWorkspace>();
    const durable = adapter(null, () => delayedBootstrap.promise);
    durable.restore = () => delayedBootstrap.promise;
    const controller = new WorkspaceSessionController(durable);
    const initialization = controller.initialize();
    expect(controller.getSnapshot().status).toBe("bootstrapping");
    controller.leave();
    delayedBootstrap.resolve(workspaceB);
    await initialization;
    expect(controller.getSnapshot().status).toBe("anonymous");

    const delayedReset = deferred<AdapterWorkspace>();
    let attempts = 0;
    const resetting = new WorkspaceSessionController(adapter(workspaceA, () => ++attempts === 1 ? delayedReset.promise : Promise.resolve(workspaceB)));
    await resetting.initialize();
    const reset = resetting.activate(true);
    const rejectedReset = expect(reset).rejects.toBeInstanceOf(StaleSessionError);
    resetting.leave({ discard: true });
    await resetting.activate();
    delayedReset.resolve(workspaceA);
    await rejectedReset;
    expect(ready(resetting).workspace).toBe(workspaceB);
  });

  it("keeps every cache family empty and disposes old queries/mutations before replacement readiness", async () => {
    const controller = await controllerFor();
    const old = ready(controller);
    const families = [["applications", "list"], ["applications", "detail", "a"], ["dashboard"], ["analytics"], ["pipeline"], ["settings"], ["me"], ["interviews"], ["applications", "a", "notes"]];
    for (const key of families) old.queryClient.setQueryData(key, { private: "A" });
    old.queryClient.getMutationCache().build(old.queryClient, { mutationFn: async () => "A" });
    controller.leave();
    expect(old.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(old.queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(old.scope.isCurrent()).toBe(false);
    const next = await controller.activate();
    expect(next.queryClient).not.toBe(old.queryClient);
    for (const key of families.filter((key) => key[0] !== "settings" && key[0] !== "me")) expect(next.queryClient.getQueryData(key)).toBeUndefined();
    expect(next.queryClient.getQueryData(["settings"])).toEqual(bootstrap.settings);
  });

  it("clears identity UI state while preserving harmless device preferences", async () => {
    const controller = await controllerFor();
    for (const key of ["hireflux-search-tour", "hireflux-recruiter-guide", "hireflux-account-preview.v1", "hireflux.time-zone-manual.v1"]) window.sessionStorage.setItem(key, "true");
    window.localStorage.setItem("hireflux-sidebar-collapsed", "true");
    controller.invalidate("expired");
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.getItem("hireflux-sidebar-collapsed")).toBe("true");
    expect(controller.getSnapshot()).toMatchObject({ status: "expired", reason: "expired" });
  });

  it("fails closed for production local mode and ignores a stored demo in configured local development", () => {
    expect(() => configuredSessionAdapter("local", false)).toThrow(/development build/);
    expect(() => configuredSessionAdapter("unknown", true)).toThrow();
    saveDemoSession(demo);
    expect(configuredSessionAdapter("local", true).lifetime).toBe("durable");
    expect(window.sessionStorage.getItem("hireflux.demo-session.v1")).toBeNull();
  });

  it.each([
    { state: "PROVISIONING" }, { identity_kind: "DEMO" }, { bootstrap_version: 2 },
    { created_at: "2026-10-10T12:00:00" }, { updated_at: "2020-01-01T00:00:00Z" },
    { profile: { ...bootstrap.profile, user_id: "selected-user" } }, { settings: { ...bootstrap.settings, time_zone: "Invalid/Zone" } },
    { settings: { ...bootstrap.settings, time_zone: "+01:00" } },
  ])("rejects invalid bootstrap evidence %j", (change) => {
    expect(workspaceBootstrapSchema.safeParse({ ...bootstrap, ...change }).success).toBe(false);
  });
});

describe("async session fencing", () => {
  it("remounts protected observers so cached dashboard data and keepPreviousData never cross a generation", async () => {
    const oldResponse = deferred<void>(); const newResponse = deferred<void>();
    const oldStarted = deferred<void>(); const newStarted = deferred<void>();
    server.use(http.get(`${API_ORIGIN}/api/v1/dashboard`, async ({ request }) => {
      const old = request.headers.get("authorization") === workspaceA.authorization;
      (old ? oldStarted : newStarted).resolve();
      await (old ? oldResponse : newResponse).promise;
      return HttpResponse.json({ ...testDashboard, summary: { ...testDashboard.summary, total_tracked: old ? 17 : 20 } });
    }));
    const controller = await controllerFor(); const previous = ready(controller);
    previous.queryClient.setQueryData(["dashboard", "30d"], { ...testDashboard, summary: { ...testDashboard.summary, total_tracked: 17 } });
    renderApp("/dashboard", { controller });
    expect(await screen.findByText(/17 tracked/)).toBeVisible();
    act(() => { void previous.queryClient.invalidateQueries({ queryKey: ["dashboard"] }); });
    await oldStarted.promise;
    await act(async () => { await controller.activate(true); });
    await newStarted.promise;
    expect(screen.queryByText(/17 tracked/)).not.toBeInTheDocument();
    await act(async () => oldResponse.resolve());
    expect(previous.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(ready(controller).queryClient.getQueryData(["dashboard", "30d"])).toBeUndefined();
    expect(screen.queryByText(/17 tracked/)).not.toBeInTheDocument();
    await act(async () => newResponse.resolve());
    expect(await screen.findByText(/20 tracked/)).toBeVisible();
  });

  it.each([200, 401])("discards an old JSON response (%s) without changing the newer session", async (status) => {
    const pending = deferred<void>();
    const started = deferred<void>();
    server.use(http.get(`${API_ORIGIN}/api/v1/fenced`, async ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer workspace-A");
      started.resolve(); await pending.promise;
      return status === 200 ? HttpResponse.json({ private: "A" }) : HttpResponse.json({ error: { code: "DEMO_SESSION_EXPIRED", message: "Expired." } }, { status });
    }));
    const controller = await controllerFor();
    const request = apiRequest("/api/v1/fenced", z.object({ private: z.string() }));
    const rejected = expect(request).rejects.toBeInstanceOf(StaleSessionError);
    await started.promise;
    controller.leave(); await controller.activate();
    pending.resolve(); await rejected;
    expect(ready(controller).workspace).toBe(workspaceB);
  });

  it("fences JSON body parsing after headers were already received", async () => {
    const body = deferred<unknown>();
    const parsed = deferred<void>();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: () => { parsed.resolve(); return body.promise; } } as Response);
    try {
      const controller = await controllerFor();
      const request = apiRequest("/api/v1/fenced", z.object({ private: z.string() }));
      const rejected = expect(request).rejects.toBeInstanceOf(StaleSessionError);
      await parsed.promise;
      controller.leave(); await controller.activate();
      body.resolve({ private: "A" }); await rejected;
      expect(ready(controller).workspace).toBe(workspaceB);
    } finally { fetchSpy.mockRestore(); }
  });

  it.each([200, 401])("discards a stale download (%s) and never creates an object URL", async (status) => {
    const pending = deferred<void>(); const started = deferred<void>();
    server.use(http.get(`${API_ORIGIN}/api/v1/download-fenced`, async () => {
      started.resolve(); await pending.promise;
      return status === 200 ? new HttpResponse("private A", { headers: { "Content-Type": "text/csv" } }) : HttpResponse.json({ error: { code: "DEMO_SESSION_EXPIRED", message: "Expired." } }, { status });
    }));
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const controller = await controllerFor(); const scope = ready(controller).scope;
    const request = apiDownload("/api/v1/download-fenced").then((file) => downloadInSession(scope, file.blob, file.filename));
    const rejected = expect(request).rejects.toBeInstanceOf(StaleSessionError);
    await started.promise; controller.leave(); await controller.activate(); pending.resolve(); await rejected;
    expect(createUrl).not.toHaveBeenCalled(); createUrl.mockRestore();
    expect(ready(controller).workspace).toBe(workspaceB);
  });

  it("downloads locally without a fabricated bearer and revokes the object URL", async () => {
    const controller = await controllerFor(workspaceB);
    server.use(http.get(`${API_ORIGIN}/api/v1/local-download`, ({ request }) => {
      expect(request.headers.get("authorization")).toBeNull();
      return new HttpResponse("Company\nLocal", { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="local.csv"' } });
    }));
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      const file = await apiDownload("/api/v1/local-download");
      downloadInSession(ready(controller).scope, file.blob, file.filename);
      expect(click).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith("blob:test");
    } finally { createUrl.mockRestore(); revoke.mockRestore(); click.mockRestore(); }
  });

  it("rejects a stale blob read and revokes a URL even if generation changes during URL creation", async () => {
    const controller = await controllerFor(); const origin = ready(controller).scope;
    const body = deferred<Blob>(); const reading = deferred<void>();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "text/csv" }), blob: () => { reading.resolve(); return body.promise; } } as Response);
    const request = apiDownload("/api/v1/fenced"); const rejected = expect(request).rejects.toBeInstanceOf(StaleSessionError);
    await reading.promise; controller.leave(); body.resolve(new Blob(["private"])); await rejected; fetchSpy.mockRestore();
    expect(() => downloadInSession(origin, new Blob(), "old.csv")).toThrow(StaleSessionError);
    await controller.activate(); const current = ready(controller).scope;
    const createUrl = vi.spyOn(URL, "createObjectURL").mockImplementation(() => { controller.leave(); return "blob:stale"; });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try { expect(() => downloadInSession(current, new Blob(), "current.csv")).toThrow(StaleSessionError); expect(revoke).toHaveBeenCalledWith("blob:stale"); }
    finally { createUrl.mockRestore(); revoke.mockRestore(); }
  });

  it("fences a late settings continuation and the mutation's cache, invalidation, navigation and toast callbacks", async () => {
    const pending = deferred<string>(); const started = deferred<void>();
    const sideEffect = vi.fn(); const perCall = vi.fn(); const settled = vi.fn();
    const controller = await controllerFor(); const old = ready(controller);
    const invalidate = vi.spyOn(old.queryClient, "invalidateQueries");
    let result: Promise<string> | undefined;
    function Harness() {
      const { state } = useWorkspaceSession();
      const [text, setText] = useState("waiting");
      const mutation = useWorkspaceMutation({
        mutationFn: async () => { started.resolve(); return pending.promise; },
        onSuccess: (value) => { state.queryClient.setQueryData(["settings"], value); void state.queryClient.invalidateQueries(); setText(value); sideEffect("navigate/toast"); },
        onError: sideEffect, onSettled: settled,
      });
      return <button onClick={() => { result = mutation.mutateAsync(undefined, { onSuccess: perCall, onError: perCall, onSettled: perCall }); void result.catch(() => {}); }}>{text}</button>;
    }
    render(<WorkspaceSessionProvider controller={controller}><Harness /></WorkspaceSessionProvider>);
    fireEvent.click(screen.getByRole("button")); await started.promise;
    await act(async () => { controller.leave(); await controller.activate(); });
    const newClient = ready(controller).queryClient;
    const newInvalidate = vi.spyOn(newClient, "invalidateQueries");
    const rejected = expect(result).rejects.toBeInstanceOf(StaleSessionError);
    await act(async () => { pending.resolve("private A"); await rejected; });
    expect(sideEffect).not.toHaveBeenCalled(); expect(perCall).not.toHaveBeenCalled(); expect(settled).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled(); expect(newInvalidate).not.toHaveBeenCalled();
    expect(screen.queryByText("private A")).not.toBeInTheDocument();
    expect(newClient.getQueryData(["settings"])).toEqual(bootstrap.settings);
    const late = deferred<string>(); const scope = ready(controller).scope;
    const setting = inSessionScope(scope, () => late.promise).then(sideEffect);
    const rejectedSetting = expect(setting).rejects.toBeInstanceOf(StaleSessionError);
    controller.leave(); late.resolve("old time zone"); await rejectedSetting;
    expect(sideEffect).not.toHaveBeenCalled();
  });
});

describe("routing, preferences, and unsaved work", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/auth/callback", "/applications/%2f%2fevil", "/applications/\u0000bad", "javascript:alert(1)"])("rejects return path %s", (path) => {
    expect(safeWorkspaceReturnPath(path)).toBeUndefined();
  });
  it("accepts an intended workspace path with a query and fragment", () => {
    expect(safeWorkspaceReturnPath("/applications/new?status=DRAFT#form")).toBe("/applications/new?status=DRAFT#form");
  });

  it("waits for authoritative restoration without redirect or protected reads, then preserves the deep link", async () => {
    const pending = deferred<AdapterWorkspace | null>();
    const delayed = adapter(null); delayed.restore = () => pending.promise;
    const { router } = renderApp("/applications/new?status=DRAFT", { adapter: delayed });
    expect(router.state.location.pathname).toBe("/applications/new");
    expect(screen.getByText("Preparing your workspace…")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Company/ })).not.toBeInTheDocument();
    await act(async () => pending.resolve(null));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Keep every opportunity");
    expect(router.state.location.state).toMatchObject({ from: "/applications/new?status=DRAFT" });
  });

  it.each(["Asia/Tokyo", "UTC"])("preserves durable saved time zone %s without a tab marker and suppresses demo UI", async (timeZone) => {
    let settingsWrites = 0; let meReads = 0; let settingsReads = 0;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/me/bootstrap`, () => HttpResponse.json({ ...bootstrap, settings: { ...bootstrap.settings, time_zone: timeZone } })),
      http.patch(`${API_ORIGIN}/api/v1/settings`, () => { settingsWrites++; return HttpResponse.json(testSettings); }),
      http.get(`${API_ORIGIN}/api/v1/me`, () => { meReads++; return HttpResponse.json(bootstrap.profile); }),
      http.get(`${API_ORIGIN}/api/v1/settings`, () => { settingsReads++; return HttpResponse.json(bootstrap.settings); }),
    );
    renderApp("/settings", { adapter: createLocalDurableAdapter(), autoDetectTimeZone: true });
    expect(await screen.findByRole("combobox", { name: "Time zone" })).toHaveValue(timeZone);
    expect(screen.getByText("Local Workspace User")).toBeVisible();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset demo" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
    expect(screen.queryByText("Personal account preview")).not.toBeInTheDocument();
    expect(settingsWrites).toBe(0); expect(meReads).toBe(0); expect(settingsReads).toBe(0);
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("warns before intentionally leaving a dirty application, but forced expiry clears it promptly", async () => {
    const { user, controller } = renderApp("/applications/new");
    const company = await screen.findByRole("textbox", { name: /Company/ });
    await user.type(company, "Unsaved private company");
    await user.click(screen.getByRole("button", { name: "More navigation" }));
    await user.click(screen.getByRole("button", { name: "Exit demo" }));
    expect(screen.getByRole("alertdialog", { name: "Leave with unsaved changes?" })).toBeVisible();
    expect(ready(controller).workspace.lifetime).toBe("temporary");
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(company).toHaveValue("Unsaved private company");
    act(() => controller.invalidate("expired"));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Keep every opportunity");
    expect(screen.queryByDisplayValue("Unsaved private company")).not.toBeInTheDocument();
    expect(controller.getSnapshot().queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("leaves a dirty form only after the user confirms discarding edits", async () => {
    const { user, controller } = renderApp("/applications/new");
    await user.type(await screen.findByRole("textbox", { name: /Company/ }), "Unsaved company");
    await user.click(screen.getByRole("button", { name: "More navigation" }));
    await user.click(screen.getByRole("button", { name: "Exit demo" }));
    await user.click(screen.getByRole("button", { name: "Discard changes and leave" }));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Keep every opportunity");
    expect(controller.getSnapshot().status).toBe("anonymous");
    expect(screen.queryByDisplayValue("Unsaved company")).not.toBeInTheDocument();
  });

  it("expires the active demo at its signed boundary without a server request", async () => {
    vi.useFakeTimers();
    try {
      saveDemoSession({ ...demo, expires_at: new Date(Date.now() + 1_000).toISOString() });
      const controller = new WorkspaceSessionController(createDemoAdapter());
      function Probe() { const { state } = useWorkspaceSession(); return <p>{state.status}</p>; }
      render(<WorkspaceSessionProvider controller={controller}><Probe /></WorkspaceSessionProvider>);
      expect(screen.getByText("ready")).toBeVisible();
      act(() => vi.advanceTimersByTime(1_001));
      expect(screen.getByText("expired")).toBeVisible();
      expect(controller.getSnapshot().queryClient.getQueryCache().getAll()).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});
