import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import authConfig from "./playwright.auth.config";

process.env.HIREFLUX_AUTH_FIXTURE_PHASE = "5D";
const frontend = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  ...authConfig,
  outputDir: "../.tools/phase5d-auth-browser/results",
  use: { ...authConfig.use, baseURL: "http://127.0.0.1:4176" },
  webServer: { command: "node scripts/serve-auth-fixture.mjs", cwd: frontend,
    url: "http://127.0.0.1:4176", reuseExistingServer: false, timeout: 120_000 },
});
