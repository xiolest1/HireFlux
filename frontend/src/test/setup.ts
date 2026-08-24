import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
}

// Full-suite parallelism can delay lazy route imports on slower Windows runners.
configure({ asyncUtilTimeout: 3_000 });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeAll(() => document.documentElement.setAttribute("lang", "en"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});
afterAll(() => server.close());
