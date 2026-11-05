import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import test from "node:test";
import { selectPublicContract, publicDeploymentProjection } from "./public-deployment-projection.mjs";
import { hostedHeaders, renderHostedHeaders, reviewedPublicDeployments } from "../src/publicDeploymentPolicy.mjs";

const contract = JSON.parse(await readFile(new URL("../src/deployment-targets.json", import.meta.url), "utf8"));
export const fictionalProduction = {
  environment: "production", siteOrigin: "https://fictional-production.example.com", apiOrigin: "https://fictional-api.example.com",
  capabilities: ["demo", "cognito"], cognito: { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_FICTIONAL",
    clientId: "FICTIONALPUBLICCLIENT", domain: "https://fictional-provider.auth.us-east-1.amazoncognito.com" },
  callbackUrl: "https://fictional-production.example.com/auth/callback", logoutUrl: "https://fictional-production.example.com/auth/signed-out", selfRegistrationEnabled: false,
};

test("public builds include only the selected exact target; fictional production cannot borrow staging", () => {
  const input = { ...contract, targets: { ...contract.targets, production: fictionalProduction } };
  const output = selectPublicContract(input, fictionalProduction.siteOrigin, fictionalProduction.apiOrigin);
  assert.equal(output.targets.production, fictionalProduction);
  assert.equal(output.targets.staging, null);
  for (const value of [contract.targets.staging.siteOrigin, contract.targets.staging.apiOrigin, ...Object.values(contract.targets.staging.cognito)]) assert.ok(!JSON.stringify(output).includes(value));
  assert.equal(contract.targets.production, null);
});

test("loopback keeps explicit development fixtures and unknown public pairs get no trusted target", () => {
  assert.equal(selectPublicContract(contract, "http://localhost:5173", "http://127.0.0.1:8000"), contract);
  for (const pair of [[fictionalProduction.siteOrigin, fictionalProduction.apiOrigin],
    [contract.targets.staging.siteOrigin, fictionalProduction.apiOrigin]]) {
    assert.deepEqual(selectPublicContract(contract, ...pair).targets, { staging: null, production: null });
  }
});

test("projection is a build-only canonical import hook, not a runtime environment override", () => {
  const plugin = publicDeploymentProjection({ siteOrigin: contract.targets.staging.siteOrigin, apiOrigin: contract.targets.staging.apiOrigin });
  assert.equal(plugin.apply, "build");
  const id = plugin.resolveId("./deployment-targets.json", "/fixture/src/publicDeploymentPolicy.mjs");
  assert.ok(id);
  assert.equal(plugin.resolveId("./other.json", "/fixture/src/publicDeploymentPolicy.mjs"), undefined);
  assert.equal(plugin.resolveId("./deployment-targets.json", "/unrelated/module.mjs"), undefined);
  assert.match(plugin.load(id), /^export default /);
});

test("exact fictional production CSP has one API/provider and no staging, while unbound production stays self-only", () => {
  const headers = hostedHeaders("production", { bindings: { staging: contract.targets.staging, production: fictionalProduction } });
  const csp = headers["Content-Security-Policy"];
  assert.ok(csp.includes(`connect-src 'self' ${fictionalProduction.apiOrigin} ${fictionalProduction.cognito.domain}`));
  assert.doesNotMatch(csp, /\*\.execute-api|localhost|hireflux-staging|0z0fpmukik/);
  assert.ok(hostedHeaders("production")["Content-Security-Policy"].split("; ").includes("connect-src 'self'"));
  assert.doesNotMatch(renderHostedHeaders("production"), /execute-api|amazoncognito|staging/);
  assert.equal(reviewedPublicDeployments.production, null);
  assert.throws(() => { reviewedPublicDeployments.production = fictionalProduction; });
});
