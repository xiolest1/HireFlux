import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";

export async function verifyHostedBuild(directory, { apiBaseUrl, siteUrl, workspaceMode }) {
  for (const value of [apiBaseUrl, siteUrl]) {
    const url = new URL(value);
    assert.equal(url.protocol, "https:");
    assert.ok(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash);
    assert.ok(!/localhost|127\.0\.0\.1|\.invalid|\*/i.test(url.hostname));
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

async function main() {
  const { values } = parseArgs({ options: { directory: { type: "string", default: "dist" } } });
  const result = await verifyHostedBuild(path.resolve(values.directory), {
    apiBaseUrl: process.env.VITE_API_BASE_URL, siteUrl: process.env.VITE_PUBLIC_SITE_URL,
    workspaceMode: process.env.VITE_WORKSPACE_MODE,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
