import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiDownload, apiRequest } from "./client";
import { newSessionScope, StaleSessionError, type CredentialSource } from "../auth/sessionGeneration";
import { API_ORIGIN } from "../test/server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const schema = z.object({ ok: z.boolean() });
const rejected = () => Response.json({ error: { code: "SESSION_EXPIRED", message: "Sign in again.", request_id: "safe-request-id" } }, { status: 401 });

afterEach(() => vi.restoreAllMocks());

describe("asynchronous account request credentials", () => {
  it("waits for a valid lease and pins credentials to the configured API without redirects/cookies", async () => {
    const pending = deferred<{ authorization: string; revision: number }>();
    const credentials: CredentialSource = { lease: vi.fn(() => pending.promise), revision: () => 7 };
    const scope = newSessionScope(null, vi.fn(), credentials);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    const request = apiRequest("/api/v1/me", schema, { scope, headers: { Authorization: "Bearer caller-supplied" } });
    expect(fetch).not.toHaveBeenCalled();
    pending.resolve({ authorization: "Bearer fictional-current-access", revision: 7 });
    await expect(request).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${API_ORIGIN}/api/v1/me`);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fictional-current-access");
    expect(init).toMatchObject({ credentials: "omit", redirect: "error" });
  });

  it("fences an identity switch while a credential lease is pending before sending anything", async () => {
    const pending = deferred<{ authorization: string; revision: number }>();
    const scope = newSessionScope(null, vi.fn(), { lease: () => pending.promise, revision: () => 1 });
    const fetch = vi.spyOn(globalThis, "fetch");
    const request = apiRequest("/api/v1/me", schema, { scope });
    newSessionScope("Bearer replacement-account");
    pending.resolve({ authorization: "Bearer fictional-old-account", revision: 1 });
    await expect(request).rejects.toBeInstanceOf(StaleSessionError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["//untrusted.example/api", "https://untrusted.example/api", "/\\untrusted.example/api"])("refuses an escaping API path %s", async (path) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const scope = newSessionScope("Bearer fictional-private-access");
    await expect(apiRequest(path, schema, { scope })).rejects.toMatchObject({ code: "INVALID_API_PATH" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not obtain or send account credentials on an explicitly public request", async () => {
    const lease = vi.fn();
    const scope = newSessionScope(null, vi.fn(), { lease, revision: () => 2 });
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    await apiRequest("/api/v1/public", schema, { scope, publicRequest: true, headers: { Authorization: "Bearer injected" } });
    expect(lease).not.toHaveBeenCalled();
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBeNull();
  });

  it("ignores a delayed old-revision 401 after successful renewal, while the current revision can invalidate", async () => {
    let revision = 1;
    const unauthorized = vi.fn();
    const scope = newSessionScope(null, unauthorized, { lease: async () => ({ authorization: `Bearer fictional-${revision}`, revision }), revision: () => revision });
    const pending = deferred<Response>();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(rejected());
    const oldRequest = apiRequest("/api/v1/me", schema, { scope });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    revision = 2;
    pending.resolve(rejected());
    await expect(oldRequest).rejects.toMatchObject({ code: "SESSION_EXPIRED", requestId: "safe-request-id" });
    expect(unauthorized).not.toHaveBeenCalled();
    expect(scope.isCurrent()).toBe(true);
    await expect(apiRequest("/api/v1/me", schema, { scope })).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(unauthorized).toHaveBeenCalledExactlyOnceWith("expired");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never automatically replays an ambiguous write or a rejected write", async () => {
    const scope = newSessionScope("Bearer fictional-access");
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fictional network loss")).mockResolvedValueOnce(rejected());
    await expect(apiRequest("/api/v1/applications", schema, { scope, method: "POST", json: { company: "Fictional" } })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(apiRequest("/api/v1/applications/fictional", schema, { scope, method: "PATCH", json: { expected_version: 1 } })).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("discards a delayed successful mutation body after switching accounts", async () => {
    const body = deferred<unknown>();
    const scope = newSessionScope("Bearer fictional-user-A");
    const response = Response.json({ ok: true });
    vi.spyOn(response, "json").mockImplementation(() => body.promise);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const request = apiRequest("/api/v1/applications/fictional", schema, { scope, method: "PATCH", json: { expected_version: 1 } });
    await vi.waitFor(() => expect(response.json).toHaveBeenCalled());
    newSessionScope("Bearer fictional-user-B");
    body.resolve({ ok: true });
    await expect(request).rejects.toBeInstanceOf(StaleSessionError);
  });

  it("never exposes an export whose blob finishes after logout", async () => {
    const body = deferred<Blob>();
    const scope = newSessionScope("Bearer fictional-access");
    const response = new Response("fictional export", { headers: { "Content-Type": "text/csv" } });
    vi.spyOn(response, "blob").mockImplementation(() => body.promise);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const download = apiDownload("/api/v1/me/applications/export", scope);
    await vi.waitFor(() => expect(response.blob).toHaveBeenCalled());
    newSessionScope();
    body.resolve(new Blob(["fictional-private-export"]));
    await expect(download).rejects.toBeInstanceOf(StaleSessionError);
  });
});
