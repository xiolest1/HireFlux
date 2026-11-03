import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { server } from "./server";
import { newSessionScope } from "../auth/sessionGeneration";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
}

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Full-suite parallelism can delay lazy route imports on slower Windows runners.
configure({ asyncUtilTimeout: 3_000 });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeAll(() => document.documentElement.setAttribute("lang", "en"));
beforeEach(() => {
  // Keep HTTP fixtures independent of a developer's private deployment env file.
  // Public trust tests explicitly override these local defaults in their own hooks.
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
  vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
});
afterEach(() => {
  cleanup();
  newSessionScope();
  server.resetHandlers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.unstubAllEnvs();
});
afterAll(() => server.close());
