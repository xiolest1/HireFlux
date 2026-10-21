import { describe, expect, it } from "vitest";
import { createSecurityHeaders, hostingAuthEnvironment, STAGING_COGNITO_ORIGIN, type HostingAuthEnvironment } from "./securityHeaders";

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
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
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

  it("adds only the reviewed Cognito fixture for local staging qualification", () => {
    const headers = createSecurityHeaders(["http://localhost:8000"], { cognitoEnvironment: "staging" });
    const policy = headers["Content-Security-Policy"];
    expect(policy).toContain(`connect-src 'self' http://localhost:8000 ${STAGING_COGNITO_ORIGIN}`);
    expect(policy).not.toContain("*.amazoncognito.com");
    expect(policy).not.toContain("cognito-idp");
    expect(policy).toContain("form-action 'self'");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("keeps production isolated and rejects an unreviewed environment", () => {
    expect(createSecurityHeaders(["https://api.example.com"], {
      cognitoEnvironment: "production",
    })["Content-Security-Policy"]).not.toContain("amazoncognito.com");
    expect(() => createSecurityHeaders([], {
      cognitoEnvironment: "unreviewed" as HostingAuthEnvironment,
    })).toThrow("Unreviewed authentication header environment");
  });

  it("selects only the accepted staging site or loopback for Vite's offline fixture", () => {
    expect(hostingAuthEnvironment("https://main.d31vp0nq9fzl6q.amplifyapp.com")).toBe("staging");
    expect(hostingAuthEnvironment("http://127.0.0.1:4174")).toBe("staging");
    expect(hostingAuthEnvironment("http://localhost:5173")).toBe("staging");
    for (const site of ["https://production.example.com", "https://unreviewed.amplifyapp.com",
      "https://main.d31vp0nq9fzl6q.amplifyapp.com.attacker.invalid", "invalid", "javascript:alert(1)"]) {
      expect(hostingAuthEnvironment(site)).toBe("production");
    }
  });
});
