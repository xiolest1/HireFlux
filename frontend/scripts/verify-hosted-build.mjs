import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { reviewedPublicDeployments, resolvePublicDeployment } from "../src/publicDeploymentPolicy.mjs";

async function scanHostedBuild(directory, { apiBaseUrl, siteUrl, workspaceMode }, fixtureOnly = false) {
  for (const value of [apiBaseUrl, siteUrl]) {
    const url = new URL(value);
    assert.equal(url.protocol, "https:");
    assert.ok(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash);
    assert.ok(!/localhost|127\.0\.0\.1|\*/i.test(url.hostname));
    assert.ok(fixtureOnly || !/\.invalid$/i.test(url.hostname), "Fictional targets are test-only");
  }
  assert.equal(workspaceMode, "demo", "Hosted workspace mode must use the existing demo adapter");
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "Hosted assets cannot contain symlinks");
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else files.push(filename);
    }
  }
  await visit(directory);
  assert.ok(files.includes(path.join(directory, "index.html")));
  assert.ok(files.some((filename) => filename.endsWith(".js") && filename.includes(`${path.sep}assets${path.sep}`)));
  let apiFound = false;
  let siteFound = false;
  for (const filename of files) {
    assert.ok(!/(^|[\\/])(\.env[^\\/]*|\.aws|credentials)([\\/]|$)|\.map$/i.test(filename), "Private configuration or unrequested source map in hosted assets");
    const contents = await readFile(filename);
    const text = contents.toString("utf8");
    assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1)(?=[:/"'])|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]+|AKIA[0-9A-Z]{16}|-----BEGIN [^-]*PRIVATE KEY-----|CURSOR_SIGNING_(?:KEY|SECRET_ARN)|DEMO_SESSION_SIGNING_(?:KEY|SECRET_ARN)|AWS_SECRET_ACCESS_KEY|synthetic-private|__HIREFLUX_API_ORIGIN__|%VITE_/i.test(text), `Forbidden material in built file ${path.basename(filename)}`);
    apiFound ||= text.includes(apiBaseUrl);
    siteFound ||= text.includes(siteUrl);
  }
  assert.ok(apiFound, "Expected public API URL missing from build");
  assert.ok(siteFound, "Expected public site URL missing from build");
  return { file_count: files.length, source_maps: false, public_urls_present: true, private_material_and_local_endpoints: "absent" };
}

export async function verifyHostedBuild(directory, options) {
  return scanHostedBuild(directory, options);
}

async function verifyBoundArtifact(directory, options, bindings, fixtureOnly = false) {
  assert.ok(["staging", "production"].includes(options.environment), "Select an explicit publication environment");
  const binding = bindings[options.environment];
  assert.ok(binding, "Publication target remains unbound");
  assert.equal(resolvePublicDeployment(options.siteUrl, options.apiBaseUrl, options.siteUrl, bindings), binding,
    "Build and reviewed publication target must agree exactly");
  assert.equal(binding.selfRegistrationEnabled, false, "This candidate must keep registration closed");
  const result = await scanHostedBuild(directory, options, fixtureOnly);
  const text = (await Promise.all((await readdir(path.join(directory, "assets"))).filter((name) => name.endsWith(".js"))
    .map((name) => readFile(path.join(directory, "assets", name), "utf8")))).join("\n");
  for (const value of [binding.cognito.issuer, binding.cognito.clientId, binding.cognito.domain]) assert.ok(text.includes(value), "Reviewed public provider metadata missing from artifact");
  if (options.environment === "production") {
    const staging = reviewedPublicDeployments.staging;
    if (staging) for (const value of [staging.siteOrigin, staging.apiOrigin,
      staging.cognito.issuer, staging.cognito.clientId, staging.cognito.domain]) assert.ok(!text.includes(value), "Production artifact contains staging identity");
  }
  return { ...result, environment: options.environment, exact_target_and_provider: true, registration: "CLOSED" };
}

export async function verifyPublicationBuild(directory, options) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  if (options.environment === "production") assert.ok(!existsSync(path.join(root, "customHttp.yml")),
    "Production publication blocked pending separately approved root-header migration");
  return { ...await verifyBoundArtifact(directory, options, reviewedPublicDeployments), publishable: true };
}

// Explicit pure fixture input is available only to tests; no CLI or Vite override
// can turn fictional targets into a reviewed runtime/publication binding.
export async function verifyHostedBuildFixture(directory, options, bindings) {
  return { ...await verifyBoundArtifact(directory, options, bindings, true), publishable: false, fixture_only: true };
}

async function main() {
  const { values } = parseArgs({ options: { directory: { type: "string", default: "dist" },
    publication: { type: "boolean", default: false }, environment: { type: "string" } } });
  const options = {
    apiBaseUrl: process.env.VITE_API_BASE_URL, siteUrl: process.env.VITE_PUBLIC_SITE_URL,
    workspaceMode: process.env.VITE_WORKSPACE_MODE, environment: values.environment,
  };
  const result = values.publication
    ? await verifyPublicationBuild(path.resolve(values.directory), options)
    : { ...await verifyHostedBuild(path.resolve(values.directory), options), publishable: false, artifact_scan_only: true };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
