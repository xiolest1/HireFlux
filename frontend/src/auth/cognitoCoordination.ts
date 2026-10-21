import { COGNITO_LOGOUT_EPOCH_KEY } from "./cognitoSessionStore";

const CHANNEL = "hireflux.cognito.logout.v1";
export function broadcastAccountLogout(epoch: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  let channel: BroadcastChannel | undefined;
  try { channel = new BroadcastChannel(CHANNEL); channel.postMessage({ type: "logout", epoch }); }
  catch { /* Storage-event invalidation remains the credential-free fallback. */ }
  finally { try { channel?.close(); } catch { /* Local cleanup never depends on messaging. */ } }
}

export function observeAccountLogout(onLogout: () => void): () => void {
  let channel: BroadcastChannel | null = null;
  try { channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL); } catch { /* Register storage fallback regardless. */ }
  const receive = (event: MessageEvent) => {
    const value: unknown = event.data;
    if (value && typeof value === "object" && "type" in value && value.type === "logout" && "epoch" in value && typeof value.epoch === "string" && /^[A-Za-z0-9-]{20,100}$/.test(value.epoch)) onLogout();
  };
  const storage = (event: StorageEvent) => { if (event.key === COGNITO_LOGOUT_EPOCH_KEY && event.newValue !== event.oldValue) onLogout(); };
  channel?.addEventListener("message", receive);
  window.addEventListener("storage", storage);
  return () => { try { channel?.close(); } catch { /* Always remove storage observer. */ } window.removeEventListener("storage", storage); };
}

export type SessionOwnership = { status: "owned"; release(): void } | { status: "busy" | "unsupported" };
export async function acquireSessionOwnership(instanceId: string): Promise<SessionOwnership> {
  if (!navigator.locks) return { status: "unsupported" };
  return new Promise((resolve) => {
    void navigator.locks.request(`hireflux-cognito-${instanceId}`, { ifAvailable: true }, async (lock) => {
      if (!lock) { resolve({ status: "busy" }); return; }
      await new Promise<void>((release) => resolve({ status: "owned", release }));
    }).catch(() => resolve({ status: "unsupported" }));
  });
}
