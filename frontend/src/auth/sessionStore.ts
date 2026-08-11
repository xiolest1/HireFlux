import { demoSessionSchema, type DemoSession } from "../api/schemas";

const STORAGE_KEY = "hireflux.demo-session.v1";

export const DEMO_SESSION_EVENT = "hireflux:demo-session";

export type DemoSessionEventReason = "changed" | "cleared" | "expired";

export interface LoadedDemoSession {
  session: DemoSession | null;
  expired: boolean;
}

export function loadDemoSession(): LoadedDemoSession {
  if (typeof window === "undefined") {
    return { session: null, expired: false };
  }
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { session: null, expired: false };
  }
  try {
    const parsed = demoSessionSchema.safeParse(JSON.parse(stored));
    if (!parsed.success) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return { session: null, expired: false };
    }
    if (new Date(parsed.data.expires_at).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return { session: null, expired: true };
    }
    return { session: parsed.data, expired: false };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return { session: null, expired: false };
  }
}

export function getDemoSession(): DemoSession | null {
  return loadDemoSession().session;
}

export function saveDemoSession(session: DemoSession): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearDemoSession(reason: DemoSessionEventReason = "cleared"): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(DEMO_SESSION_EVENT, { detail: { reason } }),
  );
}
