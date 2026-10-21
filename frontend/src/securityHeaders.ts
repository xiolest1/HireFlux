export type SecurityHeaders = Record<string, string>;

// Offline Phase 5A proposal, not proof of a reserved or deployed Cognito domain.
export const STAGING_COGNITO_ORIGIN =
  "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com";
export const reviewedCognitoOrigins = {
  staging: STAGING_COGNITO_ORIGIN,
  production: null,
} as const;
export type HostingAuthEnvironment = keyof typeof reviewedCognitoOrigins;

export function hostingAuthEnvironment(publicSiteUrl: string): HostingAuthEnvironment {
  try {
    const url = new URL(publicSiteUrl);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) return "production";
    if (url.origin === "https://main.d31vp0nq9fzl6q.amplifyapp.com" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "staging";
  } catch {
    // Invalid public configuration never expands the header allowlist.
  }
  return "production";
}

const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
];

export function createSecurityHeaders(
  apiOrigins: readonly string[],
  options: {
    allowInlineScripts?: boolean;
    includeTransportSecurity?: boolean;
    cognitoEnvironment?: HostingAuthEnvironment;
  } = {},
): SecurityHeaders {
  const environment = options.cognitoEnvironment;
  if (environment !== undefined && !Object.hasOwn(reviewedCognitoOrigins, environment)) {
    throw new Error("Unreviewed authentication header environment.");
  }
  const cognitoOrigin = environment ? reviewedCognitoOrigins[environment] : null;
  const connectSources = ["'self'", ...apiOrigins, ...(cognitoOrigin ? [cognitoOrigin] : [])];
  const scriptSource = options.allowInlineScripts
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'";
  const headers: SecurityHeaders = {
    "Content-Security-Policy": [
      ...contentSecurityPolicyDirectives.filter(
        (directive) => directive !== "script-src 'self'",
      ),
      scriptSource,
      `connect-src ${connectSources.join(" ")}`,
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  if (options.includeTransportSecurity !== false) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }

  return headers;
}
