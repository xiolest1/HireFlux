import { stagingPublicDeployment } from "./publicDeployment";
import { createPolicyHeaders } from "./publicDeploymentPolicy.mjs";

export type SecurityHeaders = Record<string, string>;
// A projected public production bundle carries no staging provider. Empty is
// deliberately not a valid origin; loopback provider compatibility then closes.
export const STAGING_COGNITO_ORIGIN = stagingPublicDeployment?.cognito.domain ?? "";
export const reviewedCognitoOrigins = { staging: STAGING_COGNITO_ORIGIN, production: null } as const;
export type HostingAuthEnvironment = keyof typeof reviewedCognitoOrigins;

export function hostingAuthEnvironment(publicSiteUrl: string): HostingAuthEnvironment {
  try {
    const url = new URL(publicSiteUrl);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) return "production";
    if (url.origin === stagingPublicDeployment?.siteOrigin ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "staging";
  } catch { /* Invalid configuration never expands the allowlist. */ }
  return "production";
}

export function createSecurityHeaders(apiOrigins: readonly string[], options: {
  allowInlineScripts?: boolean;
  includeTransportSecurity?: boolean;
  cognitoEnvironment?: HostingAuthEnvironment;
} = {}): SecurityHeaders {
  const environment = options.cognitoEnvironment;
  if (environment !== undefined && !Object.hasOwn(reviewedCognitoOrigins, environment)) throw new Error("Unreviewed authentication header environment.");
  return createPolicyHeaders(apiOrigins, { ...options, cognitoOrigin: environment ? reviewedCognitoOrigins[environment] : null });
}
