/** Reviewed public identities are build inputs, never discovered from API metadata.
 * Production stays unbound until its separately authorized provisioning/review.
 */
export interface PublicDeploymentBinding {
  environment: "staging" | "production";
  siteOrigin: string;
  apiOrigin: string;
  capabilities: readonly ("demo" | "cognito")[];
  cognito: { issuer: string; clientId: string; domain: string };
  callbackUrl: string;
  logoutUrl: string;
  selfRegistrationEnabled: boolean;
}

export type PublicDeploymentBindings = Readonly<Record<"staging" | "production", PublicDeploymentBinding | null>>;

// Public IDs from the retained Phase 5E Execution 3/4 sanitized deployment evidence.
// This is an exact source trust binding, not fresh verification of deployed state.
export const stagingPublicDeployment: PublicDeploymentBinding = {
    environment: "staging",
    siteOrigin: "https://main.d31vp0nq9fzl6q.amplifyapp.com",
    apiOrigin: "https://0z0fpmukik.execute-api.us-east-1.amazonaws.com",
    capabilities: ["demo", "cognito"],
    cognito: {
      issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_A8ogxr5nI",
      clientId: "7shrt9ejr715i8accus6a0u1e3",
      domain: "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com",
    },
    callbackUrl: "https://main.d31vp0nq9fzl6q.amplifyapp.com/auth/callback",
    logoutUrl: "https://main.d31vp0nq9fzl6q.amplifyapp.com/auth/signed-out",
    selfRegistrationEnabled: false,
};
export const reviewedPublicDeployments: PublicDeploymentBindings = {
  staging: stagingPublicDeployment,
  production: null,
};

export function exactOrigin(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      (value !== url.origin && value !== `${url.origin}/`)) {
    throw new Error("An exact HTTP(S) origin is required.");
  }
  return url.origin;
}

export function isLoopbackOrigin(value: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(exactOrigin(value)).hostname);
  } catch { return false; }
}

function validBinding(binding: PublicDeploymentBinding, key: string): boolean {
  return binding.environment === key &&
    exactOrigin(binding.siteOrigin) === binding.siteOrigin && binding.siteOrigin.startsWith("https://") &&
    exactOrigin(binding.apiOrigin) === binding.apiOrigin && binding.apiOrigin.startsWith("https://") &&
    !isLoopbackOrigin(binding.siteOrigin) && !isLoopbackOrigin(binding.apiOrigin) &&
    binding.capabilities.length > 0 && binding.capabilities.length <= 2 &&
    binding.capabilities.includes("cognito") &&
    binding.capabilities.every((value) => value === "cognito" || value === "demo") &&
    new Set(binding.capabilities).size === binding.capabilities.length &&
    /^https:\/\/cognito-idp\.us-east-1\.amazonaws\.com\/us-east-1_[A-Za-z0-9]{1,55}$/.test(binding.cognito.issuer) &&
    /^[A-Za-z0-9]{1,128}$/.test(binding.cognito.clientId) &&
    /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.auth\.us-east-1\.amazoncognito\.com$/.test(binding.cognito.domain) &&
    binding.callbackUrl === `${binding.siteOrigin}/auth/callback` &&
    binding.logoutUrl === `${binding.siteOrigin}/auth/signed-out` &&
    typeof binding.selfRegistrationEnabled === "boolean";
}

/** Pure resolver shared by API admission and metadata validation. A loopback
 * compatibility path requires both origins to be local; public builds require
 * all three compiled/current/API origins and a complete reviewed target.
 */
export function resolvePublicDeployment(
  siteOrigin: string,
  apiOrigin: string,
  compiledSiteOrigin: string | undefined,
  bindings = reviewedPublicDeployments,
): PublicDeploymentBinding | null {
  const site = exactOrigin(siteOrigin);
  const api = exactOrigin(apiOrigin);
  if (compiledSiteOrigin && exactOrigin(compiledSiteOrigin) !== site) throw new Error("Build/site mismatch.");
  if (isLoopbackOrigin(site) && isLoopbackOrigin(api)) return null;
  if (!compiledSiteOrigin) throw new Error("Public build identity is missing.");
  for (const [key, binding] of Object.entries(bindings)) {
    if (binding?.siteOrigin === site && binding.apiOrigin === api && validBinding(binding, key)) return binding;
  }
  throw new Error("Public deployment is unbound or mismatched.");
}
