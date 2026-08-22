export type SecurityHeaders = Record<string, string>;

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
  } = {},
): SecurityHeaders {
  const connectSources = ["'self'", ...apiOrigins];
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
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  if (options.includeTransportSecurity !== false) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }

  return headers;
}
