import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";

const TOKEN = "__HIREFLUX_API_ORIGIN__";
const REGIONAL_API_GATEWAY_WILDCARD = "*.execute-api";

export function normalizeApiOrigin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("Hosted HireFlux API origins must use HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("The HireFlux API origin must not contain credentials, a path, query, or fragment.");
  }
  if (parsed.hostname.includes("*")) {
    throw new Error("Wildcard API origins are forbidden in the hosted CSP.");
  }
  return parsed.origin;
}

export function renderHostingHeaders(template, apiOrigin) {
  const exactOrigin = normalizeApiOrigin(apiOrigin);
  if (!template.includes(TOKEN)) {
    throw new Error("The hosting-header template is missing its API-origin token.");
  }
  const rendered = template.replaceAll(TOKEN, exactOrigin);
  if (rendered.includes(REGIONAL_API_GATEWAY_WILDCARD) || rendered.includes(TOKEN)) {
    throw new Error("The rendered CSP contains an unresolved or wildcard API origin.");
  }
  return rendered;
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
  const templatePath = path.join(repositoryRoot, "customHttp.template.yml");
  const outputPath = path.join(repositoryRoot, "customHttp.yml");
  const apiOrigin = process.env.VITE_API_BASE_URL?.trim();
  if (!apiOrigin) {
    throw new Error("VITE_API_BASE_URL is required to render hosted security headers.");
  }
  const template = await readFile(templatePath, "utf8");
  await writeFile(outputPath, renderHostingHeaders(template, apiOrigin), "utf8");
  process.stdout.write(`Rendered customHttp.yml for ${normalizeApiOrigin(apiOrigin)}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
