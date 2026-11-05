import { describe, expect, it } from "vitest";
import { exactOrigin, isLoopbackOrigin, resolvePublicDeployment, reviewedPublicDeployments, stagingPublicDeployment as reviewedStaging, type PublicDeploymentBinding, type PublicDeploymentBindings } from "./publicDeployment";

const stagingPublicDeployment = (() => {
  if (!reviewedStaging) throw new Error("Expected the normal staging test binding.");
  return reviewedStaging;
})();

const fictionalProduction: PublicDeploymentBinding = {
  environment: "production",
  siteOrigin: "https://hireflux.example.invalid",
  apiOrigin: "https://api.hireflux.example.invalid",
  capabilities: ["demo", "cognito"],
  cognito: {
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_FICTIONAL",
    clientId: "FICTIONALPUBLICCLIENT",
    domain: "https://fictional-hireflux.auth.us-east-1.amazoncognito.com",
  },
  callbackUrl: "https://hireflux.example.invalid/auth/callback",
  logoutUrl: "https://hireflux.example.invalid/auth/signed-out",
  selfRegistrationEnabled: false,
};

describe("reviewed public deployment binding", () => {
  it("retains the exact staging trust tuple and leaves production unbound", () => {
    const stage = stagingPublicDeployment;
    expect(resolvePublicDeployment(stage.siteOrigin, stage.apiOrigin, stage.siteOrigin)).toBe(stage);
    expect(reviewedPublicDeployments.production).toBeNull();
    expect(() => resolvePublicDeployment(fictionalProduction.siteOrigin, fictionalProduction.apiOrigin, fictionalProduction.siteOrigin)).toThrow();
  });

  it.each([{ capabilities: ["cognito"] }, { capabilities: ["demo", "cognito"] }] as const)("can qualify a fictional exact production binding %#", ({ capabilities }) => {
    const production = { ...fictionalProduction, capabilities };
    const bindings: PublicDeploymentBindings = { staging: null, production };
    expect(resolvePublicDeployment(production.siteOrigin, production.apiOrigin, production.siteOrigin, bindings)).toBe(production);
  });

  it("requires compiled/current website and API agreement before metadata is fetched", () => {
    const stage = stagingPublicDeployment;
    for (const [site, api, compiled] of [
      [stage.siteOrigin, stage.apiOrigin, undefined],
      [stage.siteOrigin, "http://localhost:8000", stage.siteOrigin],
      ["http://localhost:5173", stage.apiOrigin, undefined],
      [stage.siteOrigin + ".attacker.invalid", stage.apiOrigin, stage.siteOrigin + ".attacker.invalid"],
      [stage.siteOrigin, stage.apiOrigin, "https://other.example.invalid"],
    ]) expect(() => resolvePublicDeployment(site!, api!, compiled)).toThrow();
  });

  it.each([
    { environment: "staging" }, { capabilities: [] }, { capabilities: ["demo"] },
    { capabilities: ["cognito", "cognito"] }, { capabilities: ["cognito", "other"] },
    { siteOrigin: "http://hireflux.example.invalid" }, { apiOrigin: "http://api.hireflux.example.invalid" },
    { apiOrigin: "https://api.hireflux.example.invalid/path" },
    { callbackUrl: "https://other.example.invalid/auth/callback" },
    { callbackUrl: "https://hireflux.example.invalid/other" },
    { logoutUrl: "https://other.example.invalid/auth/signed-out" },
    { selfRegistrationEnabled: undefined },
    { cognito: { ...fictionalProduction.cognito, issuer: "https://other.example.invalid/pool" } },
    { cognito: { ...fictionalProduction.cognito, clientId: "" } },
    { cognito: { ...fictionalProduction.cognito, domain: "https://other.example.invalid" } },
  ])("rejects an incomplete or unsafe reviewed target %#", (overrides) => {
    const production = { ...fictionalProduction, ...overrides } as PublicDeploymentBinding;
    expect(() => resolvePublicDeployment(production.siteOrigin, production.apiOrigin, production.siteOrigin, { staging: null, production })).toThrow();
  });

  it("limits legacy development to two exact loopback origins", () => {
    expect(resolvePublicDeployment("http://localhost:5173", "http://127.0.0.1:8000", undefined)).toBeNull();
    expect(resolvePublicDeployment("http://[::1]:5173", "http://localhost:8000", "http://[::1]:5173")).toBeNull();
    for (const value of ["http://localhost.attacker.invalid", "http://user@localhost", "http://localhost/path", "file://localhost", "http://localhost?query=1"]) {
      expect(isLoopbackOrigin(value)).toBe(false);
    }
  });

  it.each(["", "not-url", "javascript:alert(1)", "https://user@example.invalid", "https://example.invalid/path", "https://example.invalid?x", "https://example.invalid/#x", "https://example.invalid\\path"])("rejects malformed origins %s", (value) => {
    expect(() => exactOrigin(value)).toThrow();
  });
});
