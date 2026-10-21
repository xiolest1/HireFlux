import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";
import { ApiError } from "./client";
import {
  authConfigurationSchema,
  isLoopbackOrigin,
  legacyDemoConfiguration,
  loadAuthConfiguration,
  validateAuthConfiguration,
} from "./authConfiguration";

const LOCAL_SITE = "http://localhost:5173";
const LOCAL_API = "http://localhost:8000";
const STAGING_SITE = "https://main.d31vp0nq9fzl6q.amplifyapp.com";
const STAGING_API = "https://0z0fpmukik.execute-api.us-east-1.amazonaws.com";
const cognito = {
  issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY",
  client_id: "FAKEPUBLICCLIENTID",
  domain: STAGING_COGNITO_ORIGIN,
  scopes: ["openid", "email", "profile"],
};
function config(overrides: Record<string, unknown> = {}) {
  return { version: 1, environment: "test", capabilities: ["demo", "cognito"],
    account_data_policy: "local_development", account_management_enabled: false,
    cognito: { ...cognito, scopes: [...cognito.scopes] }, ...overrides };
}

function invalid(value: unknown, site = LOCAL_SITE, api = LOCAL_API) {
  expect(() => validateAuthConfiguration(value, site, api)).toThrow(ApiError);
  try { validateAuthConfiguration(value, site, api); }
  catch (error) { expect(error).toMatchObject({ code: "AUTH_CONFIGURATION_INVALID" }); }
}

beforeEach(() => {
  vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
  vi.stubEnv("VITE_API_BASE_URL", LOCAL_API);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public authentication metadata", () => {
  it("accepts actual enabled local/test capability subsets without inventing Cognito", () => {
    const enabled = validateAuthConfiguration(config(), LOCAL_SITE, LOCAL_API);
    expect(enabled.capabilities).toEqual(["demo", "cognito"]);
    expect(enabled.cognito).toEqual({ ...cognito, self_registration_enabled: false });
    expect(validateAuthConfiguration(config({ account_management_enabled: true }), LOCAL_SITE, LOCAL_API).account_management_enabled).toBe(true);
    for (const capabilities of [[], ["demo"]]) {
      const withoutProvider: Record<string, unknown> = config();
      delete withoutProvider.cognito;
      expect(validateAuthConfiguration({ ...withoutProvider, capabilities }, LOCAL_SITE, LOCAL_API).cognito).toBeUndefined();
    }
    expect(validateAuthConfiguration(config({ capabilities: ["cognito"] }), LOCAL_SITE, LOCAL_API).capabilities).toEqual(["cognito"]);
    expect(validateAuthConfiguration(config({ environment: "local" }), "http://127.0.0.1:4175", LOCAL_API).environment).toBe("local");
  });

  it("admits only the exact accepted staging site and API pair for staging metadata", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", STAGING_SITE);
    const stage = config({ environment: "staging", account_data_policy: "disposable_staging" });
    expect(validateAuthConfiguration(stage, STAGING_SITE, STAGING_API).environment).toBe("staging");
    invalid(stage, STAGING_SITE, "https://other.execute-api.us-east-1.amazonaws.com");
    invalid(stage, "https://main.other.amplifyapp.com", STAGING_API);
    invalid(stage, STAGING_SITE, LOCAL_API);
    invalid(stage, LOCAL_SITE, STAGING_API);
  });

  it("requires agreement between compiled site, selected frontend environment and backend", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", LOCAL_SITE);
    expect(validateAuthConfiguration(config(), LOCAL_SITE, LOCAL_API).environment).toBe("test");
    invalid(config(), "http://127.0.0.1:4175", LOCAL_API);
    invalid(config({ environment: "staging", account_data_policy: "disposable_staging" }));
    vi.stubEnv("VITE_PUBLIC_SITE_URL", STAGING_SITE);
    invalid(config(), STAGING_SITE, STAGING_API);
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    invalid(config(), "https://unreviewed.example.com", "https://api.unreviewed.example.com");
  });

  it("fails closed for production rather than borrowing the staging provider domain", () => {
    const production = config({ environment: "production", account_data_policy: "production", capabilities: ["cognito"] });
    expect(authConfigurationSchema.safeParse(production).success).toBe(true);
    invalid(production);
    invalid(production, STAGING_SITE, STAGING_API);
    invalid(production, "https://production.example.com", "https://api.production.example.com");
  });

  it.each([
    { version: 2 }, { version: "1" }, { capabilities: ["local"] },
    { capabilities: ["demo", "demo"] }, { capabilities: ["cognito", "cognito"] },
    { capabilities: ["demo", "cognito", "other"] }, { account_management_enabled: "true" },
    { account_data_policy: "production" }, { account_data_policy: "disposable_staging" },
    { environment: "other" }, { role: "ADMIN" }, { access_token: "never-expose-fixture" },
    { cognito: undefined }, { capabilities: ["demo"] },
  ])("rejects invalid version/capability/policy or unknown fields %#", (overrides) => {
    invalid(config(overrides));
  });

  it.each([
    { issuer: "http://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY" },
    { issuer: "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_TESTONLY" },
    { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY/" },
    { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY?other=1" },
    { issuer: "https://cognito-idp.us-east-1.amazonaws.com.attacker.invalid/us-east-1_TESTONLY" },
    { client_id: "" }, { client_id: "client with spaces" }, { client_id: "a".repeat(129) },
    { domain: "https://other.auth.us-east-1.amazoncognito.com" },
    { domain: STAGING_COGNITO_ORIGIN + "/path" }, { domain: STAGING_COGNITO_ORIGIN + "?query=1" },
    { domain: STAGING_COGNITO_ORIGIN + ".attacker.invalid" },
    { domain: STAGING_COGNITO_ORIGIN.replace("https://", "http://") },
    { domain: STAGING_COGNITO_ORIGIN.replace("https://", "https://user@") },
    { scopes: ["openid", "email"] }, { scopes: ["openid", "profile", "email"] },
    { scopes: ["openid", "email", "profile", "aws.cognito.signin.user.admin"] },
    { scopes: "openid email profile" }, { extra_token_endpoint: "https://attacker.invalid/token" },
  ])("rejects unreviewed provider metadata %#", (overrides) => {
    invalid(config({ cognito: { ...cognito, ...overrides } }));
  });

  it("returns safe errors rather than exposing malformed compiled configuration", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "invalid-public-site-fixture");
    invalid(config());
    try { validateAuthConfiguration(config(), LOCAL_SITE, LOCAL_API); }
    catch (error) { expect(String(error)).not.toContain("invalid-public-site-fixture"); }
  });

  it("recognizes loopback hosts without accepting similarly named external hosts", () => {
    for (const origin of [LOCAL_SITE, "http://127.0.0.1:4175", "http://[::1]:5173"]) expect(isLoopbackOrigin(origin)).toBe(true);
    for (const origin of [STAGING_SITE, "http://localhost.attacker.invalid", "not a URL"]) expect(isLoopbackOrigin(origin)).toBe(false);
  });
});

describe("public auth configuration retrieval", () => {
  it("fetches the fixed endpoint once without credentials, follows no redirects and validates the result", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(config()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadAuthConfiguration()).resolves.toMatchObject({ version: 1, capabilities: ["demo", "cognito"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(LOCAL_API + "/api/v1/auth/config");
    expect(options).toMatchObject({ credentials: "omit", redirect: "error" });
    expect(new Headers(options?.headers).get("authorization")).toBeNull();
    expect(options?.body).toBeUndefined();
  });

  it("uses only the expected 404 as legacy demo fallback without reading its body", async () => {
    const response = new Response("unused legacy error text", { status: 404 });
    const read = vi.spyOn(response, "text");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadAuthConfiguration()).resolves.toEqual(legacyDemoConfiguration());
    expect(read).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(legacyDemoConfiguration()).not.toHaveProperty("cognito");
  });

  it.each([400, 401, 403, 429, 500, 503])("does not turn HTTP %s into demo/Cognito admission", async (status) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("unused sensitive upstream diagnostic", { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadAuthConfiguration()).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE", status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["not-json", '{"version":', "null", "[]", JSON.stringify({ version: 1, credentials: "never-expose-fixture" })])("rejects malformed/unknown response content %#", async (body) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    const error = await loadAuthConfiguration().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(["AUTH_CONFIGURATION_INVALID", "AUTH_CONFIGURATION_UNAVAILABLE"]).toContain((error as ApiError).code);
    expect(String(error)).not.toContain("never-expose-fixture");
  });

  it("bounds a single fetch attempt at ten seconds and clears the timer", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchMock = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Ignored upstream timeout diagnostic", "AbortError"));
      }, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = loadAuthConfiguration().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(9999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
    expect(aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts the inclusive 16-KiB body limit but rejects one excess byte", async () => {
    const base = JSON.stringify(config());
    for (const length of [16384, 16385]) {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(base + " ".repeat(length - base.length))));
      if (length === 16384) await expect(loadAuthConfiguration()).resolves.toMatchObject({ version: 1 });
      else await expect(loadAuthConfiguration()).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
    }
  });

  it("cancels an oversized stream before buffering the entire response", async () => {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(4096).fill(32));
        if (pulls === 32) controller.close();
      },
      cancel() { cancelled = true; },
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)));
    await expect(loadAuthConfiguration()).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
    expect(pulls).toBeLessThan(32);
    expect(cancelled).toBe(true);
  });

  it("counts UTF-8 bytes rather than JavaScript characters for the body bound", async () => {
    const body = `"${"é".repeat(9000)}"`;
    expect(body.length).toBeLessThan(16384);
    expect(new TextEncoder().encode(body).length).toBeGreaterThan(16384);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    await expect(loadAuthConfiguration()).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
  });

  it("hides network diagnostics and never retries or reconstructs an account", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("raw-upstream-fixture-secret"));
    vi.stubGlobal("fetch", fetchMock);
    const error = await loadAuthConfiguration().catch((error: unknown) => error);
    expect(error).toMatchObject({ code: "AUTH_CONFIGURATION_UNAVAILABLE" });
    expect(String(error)).not.toContain("raw-upstream-fixture-secret");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
