import { z } from "zod";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";
import { isLoopbackOrigin, resolvePublicDeployment, type PublicDeploymentBindings } from "../publicDeployment";
import { ApiError, apiOrigin } from "./client";

export { isLoopbackOrigin } from "../publicDeployment";

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
  domain: z.string().regex(/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.auth\.us-east-1\.amazoncognito\.com$/),
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
      (value.environment === "production" && !value.capabilities.includes("cognito")) ||
      value.account_data_policy !== (value.environment === "staging" ? "disposable_staging" : value.environment === "production" ? "production" : "local_development")) {
    ctx.addIssue({ code: "custom", message: "Authentication configuration is inconsistent." });
  }
});
export type AuthConfiguration = z.infer<typeof authConfigurationSchema>;

export function validateAuthConfiguration(value: unknown, siteOrigin = window.location.origin, backendOrigin = apiOrigin(), bindings?: PublicDeploymentBindings): AuthConfiguration {
  const parsed = authConfigurationSchema.safeParse(value);
  if (!parsed.success) throw new ApiError("AUTH_CONFIGURATION_INVALID", "Account configuration is unavailable. Please contact the operator.");
  const config = parsed.data;
  try {
    const binding = resolvePublicDeployment(siteOrigin, backendOrigin, import.meta.env.VITE_PUBLIC_SITE_URL?.trim(), bindings);
    if (binding) {
      if (config.environment !== binding.environment ||
          config.capabilities.length !== binding.capabilities.length ||
          !config.capabilities.every((capability) => binding.capabilities.includes(capability)) ||
          config.cognito?.issuer !== binding.cognito.issuer ||
          config.cognito.client_id !== binding.cognito.clientId ||
          config.cognito.domain !== binding.cognito.domain ||
          config.cognito.self_registration_enabled !== binding.selfRegistrationEnabled) throw new Error("Untrusted metadata.");
    } else if (!["local", "test"].includes(config.environment) ||
        (config.cognito && config.cognito.domain !== STAGING_COGNITO_ORIGIN)) {
      throw new Error("Untrusted development metadata.");
    }
  } catch {
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
    // apiOrigin validates the build/site/API tuple before any network activity.
    const backendOrigin = apiOrigin();
    return await Promise.race([
      (async () => {
        const response = await fetch(`${backendOrigin}/api/v1/auth/config`, {
          headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", signal: abort.signal,
        });
        if (response.status === 404 && isLoopbackOrigin(window.location.origin) && isLoopbackOrigin(backendOrigin)) return legacyDemoConfiguration();
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
