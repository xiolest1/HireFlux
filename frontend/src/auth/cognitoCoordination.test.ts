import { afterEach, describe, expect, it, vi } from "vitest";
import { broadcastAccountLogout, observeAccountLogout } from "./cognitoCoordination";
import { COGNITO_LOGOUT_EPOCH_KEY } from "./cognitoSessionStore";

const epoch = "00000000-0000-4000-8000-000000000001";
function changedEpoch(key = COGNITO_LOGOUT_EPOCH_KEY, oldValue: string | null = null, newValue: string | null = epoch) {
  window.dispatchEvent(new StorageEvent("storage", { key, oldValue, newValue }));
}

afterEach(() => vi.unstubAllGlobals());

describe("credential-free cross-tab logout fallback", () => {
  it("keeps storage invalidation available when BroadcastChannel construction is forbidden", () => {
    vi.stubGlobal("BroadcastChannel", class {
      constructor() { throw new DOMException("Synthetic browser policy", "SecurityError"); }
    });
    const onLogout = vi.fn();
    expect(() => broadcastAccountLogout(epoch)).not.toThrow();
    const stop = observeAccountLogout(onLogout);

    changedEpoch("unrelated.key");
    changedEpoch(COGNITO_LOGOUT_EPOCH_KEY, epoch, epoch);
    expect(onLogout).not.toHaveBeenCalled();
    changedEpoch();
    expect(onLogout).toHaveBeenCalledOnce();
    stop();
    changedEpoch();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("never lets message or close failures interrupt local logout and observer cleanup", () => {
    const postMessage = vi.fn(() => { throw new DOMException("Synthetic delivery failure", "InvalidStateError"); });
    const close = vi.fn(() => { throw new Error("Synthetic close failure"); });
    vi.stubGlobal("BroadcastChannel", class extends EventTarget {
      postMessage = postMessage;
      close = close;
    });
    expect(() => broadcastAccountLogout(epoch)).not.toThrow();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "logout", epoch });
    expect(close).toHaveBeenCalledOnce();
    const onLogout = vi.fn();
    const stop = observeAccountLogout(onLogout);

    changedEpoch();
    expect(onLogout).toHaveBeenCalledOnce();
    expect(stop).not.toThrow();
    changedEpoch();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("accepts only bounded logout messages and sends only the opaque epoch", () => {
    const channels: EventTarget[] = [];
    const postMessage = vi.fn();
    vi.stubGlobal("BroadcastChannel", class extends EventTarget {
      constructor() { super(); channels.push(this); }
      postMessage = postMessage;
      close() {}
    });
    const onLogout = vi.fn();
    const stop = observeAccountLogout(onLogout);
    const send = (data: unknown) => channels[0].dispatchEvent(new MessageEvent("message", { data }));
    send(null);
    send({ type: "other", epoch });
    send({ type: "logout", epoch: "short" });
    send({ type: "logout", epoch: "x".repeat(101) });
    send({ type: "logout", epoch: 42 });
    expect(onLogout).not.toHaveBeenCalled();
    send({ type: "logout", epoch });
    expect(onLogout).toHaveBeenCalledOnce();

    broadcastAccountLogout(epoch);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "logout", epoch });
    expect(Object.keys(postMessage.mock.calls[0][0])).toEqual(["type", "epoch"]);
    stop();
  });
});
