import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontend = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  testDir: "./e2e",
  testMatch: "cognito-auth.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["line"]],
  outputDir: "../.tools/phase5c-auth-browser/results",
  use: {
    baseURL: "http://127.0.0.1:4175", colorScheme: "dark", reducedMotion: "reduce",
    locale: "en-US", timezoneId: "UTC", trace: "off", screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "node scripts/serve-auth-fixture.mjs", cwd: frontend,
    url: "http://127.0.0.1:4175", reuseExistingServer: false, timeout: 120_000,
  },
});
