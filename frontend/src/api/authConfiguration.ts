import { z } from "zod";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";
import { ApiError, apiOrigin } from "./client";

export interface PublicCognitoConfiguration {
  issuer: string;
  client_id: string;
  domain: string;
  scopes: readonly string[];
  self_registration_enabled?: boolean;
}

const cognitoSchema = z.strictObject({
  issuer: z.string().regex(/^https:\/\/cognito-idp\.us-east-1\.amazonaws\.com\/us-east-1_[A-Za-z0-9]{1,55}$/),
  client_id: z.string().regex(/^[A-Za-z0-9]{1,128}$/),
  domain: z.literal(STAGING_COGNITO_ORIGIN),
  scopes: z.tuple([z.literal("openid"), z.literal("email"), z.literal("profile")]),
  self_registration_enabled: z.boolean().default(false),
});
export const authConfigurationSchema = z.strictObject({
  version: z.literal(1),
  environment: z.enum(["local", "test", "staging", "production"]),
  capabilities: z.array(z.enum(["demo", "cognito"])).max(2),
  account_data_policy: z.enum(["local_development", "disposable_staging", "production"]),
  account_management_enabled: z.boolean(),
  cognito: cognitoSchema.optional(),
}).superRefine((value, ctx) => {
  if (new Set(value.capabilities).size !== value.capabilities.length ||
      value.capabilities.includes("cognito") !== Boolean(value.cognito) ||
      (value.account_management_enabled && !value.capabilities.includes("cognito")) ||
      value.account_data_policy !== (value.environment === "staging" ? "disposable_staging" : value.environment === "production" ? "production" : "local_development")) {
    ctx.addIssue({ code: "custom", message: "Authentication configuration is inconsistent." });
  }
});
export type AuthConfiguration = z.infer<typeof authConfigurationSchema>;

export function isLoopbackOrigin(origin: string): boolean {
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname); } catch { return false; }
}

export function validateAuthConfiguration(value: unknown, siteOrigin = window.location.origin, backendOrigin = apiOrigin()): AuthConfiguration {
  const parsed = authConfigurationSchema.safeParse(value);
  if (!parsed.success) throw new ApiError("AUTH_CONFIGURATION_INVALID", "Account configuration is unavailable. Please contact the operator.");
  const config = parsed.data;
  const compiledSite = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  if (compiledSite) {
    try {
      const compiled = new URL(compiledSite);
      if (compiled.origin !== siteOrigin || !["https:", "http:"].includes(compiled.protocol) || compiled.username || compiled.password || compiled.search || compiled.hash || compiled.pathname !== "/") throw new Error("Invalid public site.");
    } catch { throw new ApiError("AUTH_CONFIGURATION_INVALID", "This build does not match the current site."); }
  }
  const local = isLoopbackOrigin(siteOrigin) && isLoopbackOrigin(backendOrigin);
  const staging = siteOrigin === "https://main.d31vp0nq9fzl6q.amplifyapp.com" && backendOrigin === "https://0z0fpmukik.execute-api.us-east-1.amazonaws.com";
  if ((!local && !staging) || (local && !["local", "test"].includes(config.environment)) || (staging && config.environment !== "staging")) {
    // A production trust map/domain is not approved by the staging-only contract.
    throw new ApiError("AUTH_CONFIGURATION_INVALID", "This account configuration does not match this environment.");
  }
  return config;
}

export function legacyDemoConfiguration(): AuthConfiguration {
  return { version: 1, environment: "local", capabilities: ["demo"], account_data_policy: "local_development", account_management_enabled: false };
}

async function boundedBody(response: Response, signal: AbortSignal): Promise<string> {
  const limit = 16_384;
  if (Number(response.headers.get("Content-Length")) > limit) {
    await response.body?.cancel();
    throw new Error("Invalid public configuration.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing public configuration.");
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  let length = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  try {
    while (true) {
      if (signal.aborted) throw new Error("Public configuration timed out.");
      const chunk = await reader.read();
      if (signal.aborted) throw new Error("Public configuration timed out.");
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error("Invalid public configuration."); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return body + decoder.decode();
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

export async function loadAuthConfiguration(): Promise<AuthConfiguration> {
  const abort = new AbortController();
  let timer: number | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${apiOrigin()}/api/v1/auth/config`, {
          headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", signal: abort.signal,
        });
        if (response.status === 404) return legacyDemoConfiguration();
        if (!response.ok) throw new ApiError("AUTH_CONFIGURATION_UNAVAILABLE", "Account configuration could not be loaded. Please retry when the service is available.", response.status);
        return validateAuthConfiguration(JSON.parse(await boundedBody(response, abort.signal)));
      })(),
      new Promise<never>((_, reject) => { timer = window.setTimeout(() => { abort.abort(); reject(new Error("Public configuration timed out.")); }, 10_000); }),
    ]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("AUTH_CONFIGURATION_UNAVAILABLE", "Account configuration could not be loaded. You can retry without starting a workspace.");
  } finally { window.clearTimeout(timer); }
}
