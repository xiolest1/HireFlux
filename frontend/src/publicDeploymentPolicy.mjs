// Shared pure contract for browser trust, offline rendering and CDK app headers.
import contract from "./deployment-targets.json" with { type: "json" };

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
freeze(contract);
if (contract.version !== 1) throw new Error("Unsupported public deployment/header contract.");

export const reviewedPublicDeployments = contract.targets;
export const stagingPublicDeployment = reviewedPublicDeployments.staging;

export function exactOrigin(value) {
  const url = new globalThis.URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*") ||
      (value !== url.origin && value !== `${url.origin}/`)) throw new Error("An exact HTTP(S) origin is required.");
  return url.origin;
}

export function isLoopbackOrigin(value) {
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new globalThis.URL(exactOrigin(value)).hostname); }
  catch { return false; }
}

export function validBinding(binding, key) {
  return binding.environment === key &&
    exactOrigin(binding.siteOrigin) === binding.siteOrigin && binding.siteOrigin.startsWith("https://") &&
    exactOrigin(binding.apiOrigin) === binding.apiOrigin && binding.apiOrigin.startsWith("https://") &&
    !isLoopbackOrigin(binding.siteOrigin) && !isLoopbackOrigin(binding.apiOrigin) &&
    binding.capabilities.length > 0 && binding.capabilities.length <= 2 && binding.capabilities.includes("cognito") &&
    binding.capabilities.every((value) => value === "cognito" || value === "demo") &&
    new Set(binding.capabilities).size === binding.capabilities.length &&
    /^https:\/\/cognito-idp\.us-east-1\.amazonaws\.com\/us-east-1_[A-Za-z0-9]{1,55}$/.test(binding.cognito.issuer) &&
    /^[A-Za-z0-9]{1,128}$/.test(binding.cognito.clientId) &&
    /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.auth\.us-east-1\.amazoncognito\.com$/.test(binding.cognito.domain) &&
    binding.callbackUrl === `${binding.siteOrigin}/auth/callback` &&
    binding.logoutUrl === `${binding.siteOrigin}/auth/signed-out` && typeof binding.selfRegistrationEnabled === "boolean";
}

export function resolvePublicDeployment(siteOrigin, apiOrigin, compiledSiteOrigin, bindings = reviewedPublicDeployments) {
  const site = exactOrigin(siteOrigin), api = exactOrigin(apiOrigin);
  if (compiledSiteOrigin && exactOrigin(compiledSiteOrigin) !== site) throw new Error("Build/site mismatch.");
  if (isLoopbackOrigin(site) && isLoopbackOrigin(api)) return null;
  if (!compiledSiteOrigin) throw new Error("Public build identity is missing.");
  for (const [key, binding] of Object.entries(bindings)) {
    if (binding?.siteOrigin === site && binding.apiOrigin === api && validBinding(binding, key)) return binding;
  }
  throw new Error("Public deployment is unbound or mismatched.");
}

export function createPolicyHeaders(apiOrigins, { allowInlineScripts = false, includeTransportSecurity = true, cognitoOrigin = null, hosted = false } = {}) {
  const origins = apiOrigins.map(exactOrigin);
  if (cognitoOrigin !== null && !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.auth\.us-east-1\.amazoncognito\.com$/.test(cognitoOrigin)) throw new Error("Unreviewed provider origin.");
  return policyHeaders(origins, { allowInlineScripts, includeTransportSecurity, cognitoOrigin, hosted });
}

function policyHeaders(apiOrigins, { allowInlineScripts, includeTransportSecurity, cognitoOrigin, hosted }) {
  const directives = contract.security.directives.map((directive) => directive === "script-src 'self'" && allowInlineScripts ? "script-src 'self' 'unsafe-inline'" : directive);
  const headers = { ...contract.security.headers,
    "Content-Security-Policy": [...directives, `connect-src ${["'self'", ...apiOrigins, ...(cognitoOrigin ? [cognitoOrigin] : [])].join(" ")}`, ...(hosted ? contract.security.hostedDirectives : [])].join("; ") };
  if (!includeTransportSecurity) delete headers["Strict-Transport-Security"];
  return headers;
}

export function hostedHeaders(environment, { bindings = reviewedPublicDeployments, legacyStaging = false } = {}) {
  if (!["staging", "production"].includes(environment)) throw new Error("Unreviewed hosting environment.");
  if (legacyStaging) {
    if (environment !== "staging" || bindings !== reviewedPublicDeployments) throw new Error("Legacy policy belongs only to retained staging authority.");
    return policyHeaders(["https://*.execute-api.us-east-1.amazonaws.com"], { allowInlineScripts: false, includeTransportSecurity: true, cognitoOrigin: stagingPublicDeployment.cognito.domain, hosted: true });
  }
  const binding = bindings[environment];
  if (binding === null) return createPolicyHeaders([], { hosted: true });
  if (!validBinding(binding, environment)) throw new Error("Unreviewed hosting target.");
  return createPolicyHeaders([binding.apiOrigin], { cognitoOrigin: binding.cognito.domain, hosted: true });
}

export function renderHostedHeaders(environment, options = {}) {
  const headers = hostedHeaders(environment, options);
  return "applications:\n  - appRoot: frontend\n    customHeaders:\n      - pattern: \"**/*\"\n        headers:\n" +
    Object.entries(headers).map(([key, value]) => `          - key: ${JSON.stringify(key)}\n            value: ${JSON.stringify(value)}\n`).join("");
}
