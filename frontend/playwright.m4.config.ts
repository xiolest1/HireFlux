import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./harness/m4",
  testMatch: "m4-reveal.pw.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    colorScheme: "dark",
    reducedMotion: "no-preference",
    locale: "en-US",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "desktop-1024", use: { viewport: { width: 1024, height: 768 } } },
    { name: "compact-900", use: { viewport: { width: 900, height: 768 } } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "narrow-320", use: { viewport: { width: 320, height: 568 } } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/harness/m4/index.html",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
