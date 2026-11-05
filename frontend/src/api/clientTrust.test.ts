import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { newSessionScope } from "../auth/sessionGeneration";
import { apiDownload, apiOrigin, apiRequest } from "./client";
import { stagingPublicDeployment as reviewedStaging } from "../publicDeployment";

const stagingPublicDeployment = (() => {
  if (!reviewedStaging) throw new Error("Expected the normal staging test binding.");
  return reviewedStaging;
})();

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function atSite(origin: string) {
  const original = window;
  vi.stubGlobal("window", new Proxy(original, { get(target, key) {
    return key === "location" ? new URL(origin) : Reflect.get(target, key);
  } }));
}

describe("API transport trust before credentials", () => {
  it("retains the development default only on a loopback website", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    expect(apiOrigin()).toBe("http://localhost:8000");
    atSite(stagingPublicDeployment.siteOrigin);
    expect(() => apiOrigin()).toThrow();
  });

  it("accepts the complete staging tuple and rejects a mismatched compiled website", () => {
    const stage = stagingPublicDeployment;
    atSite(stage.siteOrigin);
    vi.stubEnv("VITE_API_BASE_URL", stage.apiOrigin);
    vi.stubEnv("VITE_PUBLIC_SITE_URL", stage.siteOrigin);
    expect(apiOrigin()).toBe(stage.apiOrigin);
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://localhost:5173");
    expect(() => apiOrigin()).toThrow();
  });

  it.each(["", "http://localhost:8000", "https://other.example.invalid"])("does not restore/refresh credentials or fetch for unsafe public API %s", async (origin) => {
    const stage = stagingPublicDeployment;
    atSite(stage.siteOrigin);
    vi.stubEnv("VITE_API_BASE_URL", origin);
    vi.stubEnv("VITE_PUBLIC_SITE_URL", stage.siteOrigin);
    const lease = vi.fn().mockRejectedValue(new Error("Must not contact the provider."));
    const scope = newSessionScope(null, () => {}, { lease, revision: () => 0 });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("/api/v1/me", z.object({ ok: z.boolean() }), { scope })).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_INVALID" });
    await expect(apiDownload("/api/v1/me/applications/export", scope)).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_INVALID" });
    expect(lease).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
