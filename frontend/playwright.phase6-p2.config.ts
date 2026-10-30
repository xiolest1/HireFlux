import { defineConfig } from "@playwright/test";

// Run against the separately built local P2 bundle; preserve all P1 receipts.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase6-p2-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: "../.tools/phase6-p2-validation-20261029/browser-results",
  reporter: [["line"], ["json", { outputFile: "../.tools/phase6-p2-validation-20261029/browser-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
    trace: "off",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --outDir ../.tools/phase6-p2-validation-20261029/dist-loopback --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
