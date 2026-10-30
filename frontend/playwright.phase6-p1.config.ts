import { defineConfig } from "@playwright/test";

// Build into this isolated directory before running. No accepted release output
// or historical browser receipt is overwritten by this local fixture campaign.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase6-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: "../.tools/phase6-p1-validation-20261029/browser-results",
  reporter: [["line"], ["json", { outputFile: "../.tools/phase6-p1-validation-20261029/browser-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "dark",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [{ name: "local-fixture", use: { viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --outDir ../.tools/phase6-p1-validation-20261029/dist --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
