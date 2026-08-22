import { describe, expect, it } from "vitest";
import { createSecurityHeaders } from "./securityHeaders";

describe("security headers", () => {
  it("blocks inline script execution and browser embedding", () => {
    const headers = createSecurityHeaders(["https://api.example.com"]);
    const policy = headers["Content-Security-Policy"];

    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self' https://api.example.com");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("omits HSTS for local HTTP development", () => {
    const headers = createSecurityHeaders(["http://localhost:8000"], {
      includeTransportSecurity: false,
    });

    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("can allow only Vite's development bootstrap when requested", () => {
    const headers = createSecurityHeaders(["http://localhost:8000"], {
      allowInlineScripts: true,
      includeTransportSecurity: false,
    });

    expect(headers["Content-Security-Policy"]).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(headers["Content-Security-Policy"]).toContain(
      "script-src-attr 'none'",
    );
  });
});
