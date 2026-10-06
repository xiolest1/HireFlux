import { ApiError } from "../api/client";
import { createDemoSession } from "../api/demoSessions";
import type { DemoSession } from "../api/schemas";
import { bootstrapWorkspace, type WorkspaceBootstrap } from "../api/workspaceBootstrap";
import { DEMO_SESSION_EVENT, loadDemoSession, removeStoredDemoSession, saveDemoSession } from "./sessionStore";
import type { SessionScope } from "./sessionGeneration";
import type { WorkspaceLifetime } from "./workspaceCapabilities";

export interface AdapterWorkspace {
  lifetime: WorkspaceLifetime;
  identityKind: "DEMO" | "LOCAL" | "PERSISTENT";
  authorization: string | null;
  presentationKey?: string;
  demo?: DemoSession;
  bootstrap?: WorkspaceBootstrap;
}

export interface SessionAdapter {
  readonly id: string;
  readonly lifetime: WorkspaceLifetime;
  restore(scope: SessionScope): Promise<AdapterWorkspace | "expired" | null> | AdapterWorkspace | "expired" | null;
  activate(scope: SessionScope, operationKey: string): Promise<AdapterWorkspace>;
  persist(workspace: AdapterWorkspace): void;
  clear(): void;
  valid(workspace: AdapterWorkspace): boolean;
  observe?(workspace: AdapterWorkspace, invalidate: (reason: "expired" | "invalidated") => void): () => void;
}

function demoWorkspace(demo: DemoSession): AdapterWorkspace {
  // Opaque, non-authoritative UI marker preserves optional simulations on tab reload.
  let marker = 2_166_136_261;
  for (const character of demo.access_token) marker = Math.imul(marker ^ character.charCodeAt(0), 16_777_619);
  return { lifetime: "temporary", identityKind: "DEMO", authorization: `Bearer ${demo.access_token}`, demo, presentationKey: `demo-${(marker >>> 0).toString(16).padStart(8, "0")}` };
}

export function createDemoAdapter(): SessionAdapter {
  return {
    id: "demo", lifetime: "temporary",
    restore() {
      const { session, expired } = loadDemoSession();
      return session ? demoWorkspace(session) : expired ? "expired" : null;
    },
    async activate(scope, key) {
      const demo = await createDemoSession(key, scope);
      if (Date.parse(demo.expires_at) <= Date.now()) throw new ApiError("DEMO_SESSION_EXPIRED", "The prepared demo has expired. Start a fresh workspace.", 401);
      return demoWorkspace(demo);
    },
    persist(workspace) { if (workspace.demo) saveDemoSession(workspace.demo); },
    clear: removeStoredDemoSession,
    valid: (workspace) => Boolean(workspace.demo && Date.parse(workspace.demo.expires_at) > Date.now()),
    observe(workspace, invalidate) {
      const expiresAt = workspace.demo?.expires_at;
      let timer: number | undefined;
      const schedule = () => {
        if (!expiresAt) return;
        const remaining = Date.parse(expiresAt) - Date.now();
        if (remaining <= 0) invalidate("expired");
        else timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
      };
      schedule();
      const onEvent = (event: Event) => {
        const reason = (event as CustomEvent<{ reason: string }>).detail?.reason;
        if (reason === "expired") invalidate("expired");
        else if (reason === "cleared") invalidate("invalidated");
      };
      window.addEventListener(DEMO_SESSION_EVENT, onEvent);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener(DEMO_SESSION_EVENT, onEvent);
      };
    },
  };
}

const LOCAL_LEFT_KEY = "hireflux.local-workspace-left.v1";
function localLeft(): boolean {
  try { return window.sessionStorage.getItem(LOCAL_LEFT_KEY) === "true"; } catch { return false; }
}

/** Fixed backend identity only; this adapter never selects or authenticates a user. */
export function createLocalDurableAdapter(): SessionAdapter {
  const activate = async (scope: SessionScope): Promise<AdapterWorkspace> => {
    const bootstrap = await bootstrapWorkspace(scope);
    if (bootstrap.identity_kind !== "LOCAL") {
      throw new ApiError("INVALID_RESPONSE", "The local backend returned an unexpected identity kind.");
    }
    return { lifetime: "durable", identityKind: "LOCAL", authorization: null, bootstrap };
  };
  return {
    id: "local", lifetime: "durable",
    restore: (scope) => localLeft() ? Promise.resolve(null) : activate(scope),
    activate,
    persist() { try { window.sessionStorage.removeItem(LOCAL_LEFT_KEY); } catch { /* No credential is stored. */ } },
    clear() { try { window.sessionStorage.setItem(LOCAL_LEFT_KEY, "true"); } catch { /* Current tab still leaves. */ } },
    valid: () => true,
  };
}

export function configuredSessionAdapter(
  mode = import.meta.env.VITE_WORKSPACE_MODE?.trim() || "demo",
  development = import.meta.env.DEV,
): SessionAdapter {
  if (mode === "demo") return createDemoAdapter();
  if (mode === "local" && development) {
    // The configured backend mode wins over an unrelated stored demo token.
    removeStoredDemoSession();
    return createLocalDurableAdapter();
  }
  throw new ApiError("SESSION_CONFIGURATION", "Workspace mode is unavailable. Local durable workspaces require a development build and AUTH_MODE=local.");
}
