import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { createSecurityHeaders } from "./src/securityHeaders";

function localSecurityHeaders(
  mode: string,
  options: { allowInlineScripts?: boolean } = {},
) {
  const env = loadEnv(mode, "..", "");
  let apiOrigin = "http://localhost:8000";
  try {
    apiOrigin = new URL(env.VITE_API_BASE_URL || apiOrigin).origin;
  } catch {
    // Keep the local default so Vite still starts with a clear, safe policy.
  }

  return createSecurityHeaders([apiOrigin, "http://127.0.0.1:8000"], {
    allowInlineScripts: options.allowInlineScripts,
    includeTransportSecurity: false,
  });
}

export default defineConfig(({ mode }) => ({
  envDir: "..",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Vite injects an inline React-refresh module during development only.
    headers: localSecurityHeaders(mode, { allowInlineScripts: true }),
  },
  preview: {
    host: "127.0.0.1",
    headers: localSecurityHeaders(mode),
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    restoreMocks: true,
    exclude: [...configDefaults.exclude, "e2e/**", "scripts/**"],
  },
}));
