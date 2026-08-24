import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeApiOrigin, renderHostingHeaders } from "./render-hosting-headers.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const template = await readFile(path.join(repositoryRoot, "customHttp.template.yml"), "utf8");
const committedPolicy = await readFile(path.join(repositoryRoot, "customHttp.yml"), "utf8");

test("renders one exact environment API origin without a regional wildcard", () => {
  const origin = "https://abc123.execute-api.us-east-1.amazonaws.com";
  const rendered = renderHostingHeaders(template, origin);
  assert.match(rendered, new RegExp(`connect-src 'self'\\s+${origin}`));
  assert.doesNotMatch(rendered, /\*\.execute-api/);
  assert.doesNotMatch(rendered, /__HIREFLUX_API_ORIGIN__/);
});

test("rejects wildcard, path-bearing, and non-HTTPS origins", () => {
  assert.throws(() => normalizeApiOrigin("https://*.execute-api.us-east-1.amazonaws.com"));
  assert.throws(() => normalizeApiOrigin("https://api.example.com/stage"));
  assert.throws(() => normalizeApiOrigin("http://api.example.com"));
});

test("committed fail-closed policy permits no external API before release rendering", () => {
  assert.match(committedPolicy, /connect-src 'self';/);
  assert.doesNotMatch(committedPolicy, /connect-src 'self'\s+https:\/\//);
  assert.doesNotMatch(committedPolicy, /\*\.execute-api/);
});
