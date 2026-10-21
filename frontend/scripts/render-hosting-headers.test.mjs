import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load } from "js-yaml";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { parseHostingHeaders, renderHostingHeaders, REVIEWED_COGNITO_ORIGINS } from "./render-hosting-headers.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const template = await readFile(path.join(repositoryRoot, "customHttp.template.yml"), "utf8");
const policy = await readFile(path.join(repositoryRoot, "customHttp.yml"), "utf8");

test("root policy and template have identical valid Amplify monorepo header semantics", () => {
  assert.deepEqual(parseHostingHeaders(policy), parseHostingHeaders(template));
  assert.deepEqual(load(policy), load(renderHostingHeaders(template)));
});

test("CSP preserves regional API access and adds only the reviewed staging Cognito fixture", () => {
  const headers = parseHostingHeaders(policy);
  assert.match(headers["Content-Security-Policy"], /https:\/\/\*\.execute-api\.us-east-1\.amazonaws\.com/);
  assert.doesNotMatch(policy, /connect-src\s+\*|connect-src[^;]*https:(?:\s|;)|__HIREFLUX_API_ORIGIN__|localhost/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /script-src 'self' 'unsafe-inline'/);
  assert.ok(headers["Content-Security-Policy"].includes(REVIEWED_COGNITO_ORIGINS.staging));
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.doesNotMatch(headers["Content-Security-Policy"], /\*\.amazoncognito\.com|cognito-idp/);
});

test("production rendering is separate and cannot silently retain staging Cognito trust", () => {
  const production = renderHostingHeaders(template, { environment: "production" });
  const headers = parseHostingHeaders(production, { environment: "production" });
  assert.doesNotMatch(headers["Content-Security-Policy"], /amazoncognito\.com/);
  assert.match(headers["Content-Security-Policy"], /https:\/\/\*\.execute-api\.us-east-1\.amazonaws\.com/);
  assert.throws(() => parseHostingHeaders(policy, { environment: "production" }));
  assert.throws(() => renderHostingHeaders(template, { environment: "unreviewed" }));
  assert.equal(load(policy).applications[0].appRoot, "frontend");
});

test("production CLI cannot overwrite the checked-in staging artifact", async () => {
  const renderer = path.join(repositoryRoot, "frontend/scripts/render-hosting-headers.mjs");
  for (const extra of [[], ["--output", path.join(repositoryRoot, "customHttp.yml")]]) {
    const result = spawnSync(process.execPath, [renderer, "--environment", "production", ...extra], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production requires a separate explicit output/);
    assert.equal(await readFile(path.join(repositoryRoot, "customHttp.yml"), "utf8"), policy);
  }
});

test("unreviewed Cognito domains and metadata cannot weaken the fixed hosted allowlist", () => {
  for (const origin of ["https://other.auth.us-east-1.amazoncognito.com", "https://*.amazoncognito.com",
    "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com.attacker.invalid",
    "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com/path", "https:"]) {
    assert.throws(() => renderHostingHeaders(policy.replace(REVIEWED_COGNITO_ORIGINS.staging, origin)));
  }
});

test("the existing actual Amplify rewrite admits auth SPA routes while excluding missing static assets", async () => {
  const source = await readFile(path.join(repositoryRoot, "infra/lib/hosting/frontend-hosting.ts"), "utf8");
  const match = source.match(/export const SPA_REWRITE_SOURCE = '([^']+)';/);
  assert.ok(match, "Reviewed SPA rewrite declaration missing");
  const pattern = match[1].replaceAll("\\\\", "\\");
  const expression = new RegExp(pattern.slice(2, -2));
  for (const route of ["/auth/callback", "/auth/signed-out", "/applications/a", "/settings"]) {
    assert.ok(expression.test(route), route);
  }
  for (const route of ["/assets/missing.js", "/assets/missing.css", "/assets/missing.json", "/favicon.ico"]) {
    assert.equal(expression.test(route), false, route);
  }
});

test("single-app or wrong-root YAML cannot silently bypass frontend monorepo headers", () => {
  assert.throws(() => parseHostingHeaders(policy.replace("appRoot: frontend", "appRoot: backend")));
  assert.throws(() => parseHostingHeaders("customHeaders: []"));
});

test("missing, duplicate or weakened security headers fail validation", () => {
  for (const changed of [policy.replace('value: "nosniff"', 'value: "sniff"'),
    policy.replace("connect-src 'self'", "connect-src *"),
    policy.replace("script-src 'self'", "script-src *"),
    policy.replace('key: "X-Frame-Options"', 'key: "X-Content-Type-Options"')]) {
    assert.throws(() => renderHostingHeaders(changed));
  }
});
