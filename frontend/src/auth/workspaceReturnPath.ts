export function safeWorkspaceReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || /[\\\s]/.test(value) || Array.from(value).some((character) => character.charCodeAt(0) < 33) || !value.startsWith("/") || value.startsWith("//")) return;
  try {
    const url = new URL(value, "https://hireflux.invalid");
    if (url.origin !== "https://hireflux.invalid" || /%2f|%5c|%2e/i.test(url.pathname)) return;
    if (["/dashboard", "/applications", "/interviews", "/analytics", "/settings"].some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return `${url.pathname}${url.search}${url.hash}`;
  } catch { /* Untrusted navigation state is ignored. */ }
}

