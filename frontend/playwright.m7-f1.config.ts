import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "m7-connected-lifecycle.pw.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: { ...base.use, reducedMotion: "no-preference", video: "retain-on-failure" },
  projects: [{ name: "connected-lifecycle", use: { viewport: { width: 1280, height: 800 } } }],
});
