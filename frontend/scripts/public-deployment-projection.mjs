// Build-only target projection. No browser override, network lookup or identity discovery.
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { isLoopbackOrigin, validBinding } from "../src/publicDeploymentPolicy.mjs";

const manifestFile = fileURLToPath(new URL("../src/deployment-targets.json", import.meta.url));
const virtualFile = "\0hireflux-selected-public-deployment";

export function selectPublicContract(contract, siteOrigin, apiOrigin) {
  if (contract.version !== 1) throw new Error("Unsupported public contract.");
  if (isLoopbackOrigin(siteOrigin) && isLoopbackOrigin(apiOrigin)) return contract;
  const targets = { staging: null, production: null };
  for (const environment of ["staging", "production"]) {
    const binding = contract.targets[environment];
    if (binding?.siteOrigin === siteOrigin && binding.apiOrigin === apiOrigin && validBinding(binding, environment)) targets[environment] = binding;
  }
  return { ...contract, targets };
}

export function publicDeploymentProjection({ siteOrigin, apiOrigin, contract = JSON.parse(readFileSync(manifestFile, "utf8")) }) {
  const projected = selectPublicContract(contract, siteOrigin, apiOrigin);
  return {
    name: "hireflux-exact-public-target", enforce: "pre", apply: "build",
    resolveId(source, importer) {
      if (source === "./deployment-targets.json" && importer?.replaceAll("\\", "/").endsWith("/src/publicDeploymentPolicy.mjs")) return virtualFile;
    },
    load(id) {
      if (id === virtualFile) return `export default ${JSON.stringify(projected)};`;
    },
  };
}
