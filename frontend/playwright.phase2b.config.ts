import { defineConfig } from "@playwright/test";

if (process.env.HIREFLUX_LOCAL_SMOKE !== "1") {
  throw new Error("Prepare a disposable AUTH_MODE=local backend on port 8012, then set HIREFLUX_LOCAL_SMOKE=1 explicitly.");
}

// Requires an explicitly prepared disposable AUTH_MODE=local backend.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "local-durable-smoke.pw.ts",
  outputDir: "test-results/phase2b",
  workers: 1,
  timeout: 90_000,
  reporter: "line",
  use: {
    actionTimeout: 10_000,
    baseURL: "http://127.0.0.1:5175", viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce", timezoneId: "UTC", screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    env: { VITE_WORKSPACE_MODE: "local", VITE_API_BASE_URL: "http://127.0.0.1:8012" },
  },
});
