import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load } from "js-yaml";
import { parseHostingHeaders, renderHostingHeaders } from "./render-hosting-headers.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const template = await readFile(path.join(repositoryRoot, "customHttp.template.yml"), "utf8");
const policy = await readFile(path.join(repositoryRoot, "customHttp.yml"), "utf8");

test("root policy and template have identical valid Amplify monorepo header semantics", () => {
  assert.deepEqual(parseHostingHeaders(policy), parseHostingHeaders(template));
  assert.deepEqual(load(policy), load(renderHostingHeaders(template)));
});

test("CSP permits regional HTTPS API access while preserving exact non-connect directives", () => {
  const headers = parseHostingHeaders(policy);
  assert.match(headers["Content-Security-Policy"], /https:\/\/\*\.execute-api\.us-east-1\.amazonaws\.com/);
  assert.doesNotMatch(policy, /connect-src\s+\*|connect-src[^;]*https:(?:\s|;)|__HIREFLUX_API_ORIGIN__|localhost/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /script-src 'self' 'unsafe-inline'/);
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
