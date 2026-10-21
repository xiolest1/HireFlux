import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { load } from "js-yaml";

// Checked-in policy is the staging artifact. Production receives no speculative
// Cognito domain; its distinct publication remains a later reviewed release.
export const REVIEWED_COGNITO_ORIGINS = Object.freeze({
  staging: "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com",
  production: null,
});

function authOrigin(environment) {
  assert.ok(Object.hasOwn(REVIEWED_COGNITO_ORIGINS, environment), "Unreviewed hosting environment");
  return REVIEWED_COGNITO_ORIGINS[environment];
}

export function parseHostingHeaders(template, { environment = "staging" } = {}) {
  const cognitoOrigin = authOrigin(environment);
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
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.equal(headers["Permissions-Policy"], "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
  const directives = headers["Content-Security-Policy"].split(";").map((value) => value.trim().replace(/\s+/g, " "));
  assert.deepEqual(directives.sort(), [
    "default-src 'self'", "base-uri 'self'",
    `connect-src 'self' https://*.execute-api.us-east-1.amazonaws.com${cognitoOrigin ? ` ${cognitoOrigin}` : ""}`,
    "font-src 'self'", "form-action 'self'", "frame-ancestors 'none'", "img-src 'self' data:",
    "manifest-src 'self'", "media-src 'none'", "object-src 'none'", "script-src 'self'",
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", "worker-src 'self'", "upgrade-insecure-requests",
  ].sort(), "Hosted CSP must preserve the reviewed regional policy");
  return headers;
}

export function renderHostingHeaders(template, { environment = "staging" } = {}) {
  authOrigin(environment);
  parseHostingHeaders(template);
  const rendered = environment === "staging"
    ? template
    : template.replace(REVIEWED_COGNITO_ORIGINS.staging, "");
  parseHostingHeaders(rendered, { environment });
  return rendered;
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { values } = parseArgs({ options: {
    environment: { type: "string", default: "staging" }, output: { type: "string" },
  } });
  authOrigin(values.environment);
  const stagingOutput = path.join(repositoryRoot, "customHttp.yml");
  const output = values.output ? path.resolve(values.output) : stagingOutput;
  assert.ok(values.environment !== "production" || (values.output && output !== stagingOutput),
    "Production requires a separate explicit output; do not overwrite the staging artifact");
  const template = await readFile(path.join(repositoryRoot, "customHttp.template.yml"), "utf8");
  await writeFile(output, renderHostingHeaders(template, { environment: values.environment }), "utf8");
  process.stdout.write(`Rendered the reviewed ${values.environment} monorepo hosting-header policy.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
