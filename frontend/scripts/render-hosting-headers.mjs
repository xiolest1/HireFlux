import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { load } from "js-yaml";
import { hostedHeaders, renderHostedHeaders, reviewedPublicDeployments } from "../src/publicDeploymentPolicy.mjs";

export const REVIEWED_COGNITO_ORIGINS = Object.freeze({
  staging: reviewedPublicDeployments.staging.cognito.domain,
  production: reviewedPublicDeployments.production?.cognito.domain ?? null,
});

function policyOptions(environment, policy) {
  assert.ok(["staging", "production"].includes(environment), "Unreviewed hosting environment");
  assert.ok(["exact", "legacy-staging"].includes(policy), "Unreviewed header policy");
  assert.ok(policy !== "legacy-staging" || environment === "staging", "Legacy headers are staging only");
  return { legacyStaging: policy === "legacy-staging" };
}

export function parseHostingHeaders(template, { environment = "staging", policy = environment === "staging" ? "legacy-staging" : "exact", bindings } = {}) {
  const options = policyOptions(environment, policy);
  const expected = hostedHeaders(environment, { ...options, ...(bindings ? { bindings } : {}) });
  const parsed = load(template);
  assert.deepEqual(Object.keys(parsed), ["applications"]);
  assert.equal(parsed.applications.length, 1);
  const application = parsed.applications[0];
  assert.deepEqual(Object.keys(application).sort(), ["appRoot", "customHeaders"]);
  assert.equal(application.appRoot, "frontend");
  assert.equal(application.customHeaders.length, 1);
  const rule = application.customHeaders[0];
  assert.equal(rule.pattern, "**/*");
  const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
  assert.equal(Object.keys(headers).length, rule.headers.length, "Duplicate hosting header");
  assert.deepEqual(Object.keys(headers).sort(), Object.keys(expected).sort());
  for (const key of Object.keys(expected)) {
    if (key === "Content-Security-Policy") {
      const normalize = (value) => value.split(";").map((part) => part.trim().replace(/\s+/g, " ")).sort();
      assert.deepEqual(normalize(headers[key]), normalize(expected[key]), "Hosted CSP must match the reviewed target policy");
    } else assert.equal(headers[key], expected[key]);
  }
  return headers;
}

export function renderHostingHeaders(template, { environment = "staging", policy = environment === "staging" ? "legacy-staging" : "exact", bindings } = {}) {
  policyOptions(environment, policy);
  // Retained historical input must remain valid; it is never rewritten in this batch.
  parseHostingHeaders(template);
  const rendered = policy === "legacy-staging" ? template : renderHostedHeaders(environment, bindings ? { bindings } : {});
  parseHostingHeaders(rendered, { environment, policy, ...(bindings ? { bindings } : {}) });
  return rendered;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { values } = parseArgs({ options: {
    environment: { type: "string", default: "staging" }, policy: { type: "string" }, output: { type: "string" },
  } });
  const policy = values.policy || (values.environment === "staging" ? "legacy-staging" : "exact");
  policyOptions(values.environment, policy);
  const stagingOutput = path.join(root, "customHttp.yml");
  const output = values.output ? path.resolve(values.output) : stagingOutput;
  assert.ok(values.environment !== "production" || (values.output && output !== stagingOutput),
    "Production requires a separate explicit output; do not overwrite the staging artifact");
  assert.ok(policy !== "exact" || (values.output && output !== stagingOutput),
    "Exact headers require a separate explicit output; root retirement is separately approved");
  const template = await readFile(path.join(root, "customHttp.template.yml"), "utf8");
  await writeFile(output, renderHostingHeaders(template, { environment: values.environment, policy }), "utf8");
  process.stdout.write(`Rendered ${values.environment} ${policy} header proposal; no publication occurred.\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
