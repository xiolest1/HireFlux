import { useRef, type ComponentType } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedStoryFitProbe } from "./ConnectedStoryFitProbe";
import { resetConnectedStoryModuleForTests, useConnectedStoryArchitecture } from "./useConnectedStoryArchitecture";

interface MediaHarness {
  reduced: boolean;
  listeners: Set<() => void>;
}

const FakeJ3: ComponentType = () => (
  <div data-connected-j3 data-connected-progress="0"><div className="pin-spacer"><div data-scroll-story-pin /></div></div>
);

const UnreadyJ3: ComponentType = () => (
  <div data-connected-j3 data-connected-progress="0"><div data-scroll-story-pin /></div>
);

function Harness({ loadJ3 }: { loadJ3: () => Promise<{ ConnectedStoryJ3: ComponentType }> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const state = useConnectedStoryArchitecture(rootRef, { loadJ3 });
  return (
    <div ref={rootRef} data-testid="root" data-family={state.family ?? "unresolved"}>
      <ConnectedStoryFitProbe />
      {state.family === "j3" && state.J3 ? <state.J3 /> : null}
      {state.family === "c" || state.family === "a" ? <div data-connected-chapter="applications" /> : null}
    </div>
  );
}

function installEnvironment(width: number, height: number) {
  const media: MediaHarness = { reduced: false, listeners: new Set() };
  const viewport = { width, height };
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return media.reduced; },
    addEventListener: (_: string, listener: () => void) => media.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => media.listeners.delete(listener),
  })));
  vi.spyOn(window, "innerHeight", "get").mockImplementation(() => viewport.height);
  vi.spyOn(window, "innerWidth", "get").mockImplementation(() => viewport.width);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement) return viewport.width;
    if (this.hasAttribute("data-testid")) return viewport.width - 120;
    return 576;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this === document.documentElement ? viewport.height : 576;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-connected-j3-fit-stage")) return 688;
    if (this.hasAttribute("data-connected-j3-fit-shell")) return 512;
    return 240;
  });
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({ fontSize: "16px" }) as CSSStyleDeclaration);
  Object.defineProperty(document, "fonts", { configurable: true, value: undefined });
  return { media, viewport };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetConnectedStoryModuleForTests();
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useConnectedStoryArchitecture", () => {
  it("loads and commits J3 only after capacity and inert fit succeed", async () => {
    installEnvironment(1280, 900);
    const loadJ3 = vi.fn(async () => ({ ConnectedStoryJ3: FakeJ3 }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "j3"));
    expect(loadJ3).toHaveBeenCalledOnce();
    expect(getByTestId("root").querySelectorAll("[data-connected-j3]")).toHaveLength(1);
  });

  it("selects C and never requests J3 when independent capacity is insufficient", async () => {
    installEnvironment(900, 720);
    const loadJ3 = vi.fn(async () => ({ ConnectedStoryJ3: FakeJ3 }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "c"));
    expect(loadJ3).not.toHaveBeenCalled();
    expect(getByTestId("root").querySelector("[data-connected-j3]")).not.toBeInTheDocument();
  });

  it("invalidates a pending J3 import immediately when reduced motion becomes active", async () => {
    const { media } = installEnvironment(1280, 900);
    let resolveModule: ((module: { ConnectedStoryJ3: ComponentType }) => void) | undefined;
    const loadJ3 = vi.fn(() => new Promise<{ ConnectedStoryJ3: ComponentType }>((resolve) => { resolveModule = resolve; }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await waitFor(() => expect(loadJ3).toHaveBeenCalledOnce());
    act(() => {
      media.reduced = true;
      media.listeners.forEach((listener) => listener());
    });
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "c"));
    await act(async () => resolveModule?.({ ConnectedStoryJ3: FakeJ3 }));
    expect(getByTestId("root")).toHaveAttribute("data-family", "c");
    expect(getByTestId("root").querySelector("[data-connected-j3]")).not.toBeInTheDocument();
  });

  it("removes its motion listener on unmount", () => {
    const { media } = installEnvironment(900, 720);
    const { unmount } = render(<Harness loadJ3={async () => ({ ConnectedStoryJ3: FakeJ3 })} />);
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("commits a bounded fallback and treats a late J3 import as cache-only", async () => {
    vi.useFakeTimers();
    const { viewport } = installEnvironment(1280, 900);
    let resolveModule: ((module: { ConnectedStoryJ3: ComponentType }) => void) | undefined;
    const loadJ3 = vi.fn(() => new Promise<{ ConnectedStoryJ3: ComponentType }>((resolve) => { resolveModule = resolve; }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await act(async () => vi.advanceTimersByTime(801));
    expect(getByTestId("root")).toHaveAttribute("data-family", "c");

    await act(async () => resolveModule?.({ ConnectedStoryJ3: FakeJ3 }));
    expect(getByTestId("root")).toHaveAttribute("data-family", "c");
    expect(getByTestId("root").querySelector("[data-connected-j3]")).not.toBeInTheDocument();

    viewport.width = 1279;
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(20);
    });
    expect(getByTestId("root")).toHaveAttribute("data-family", "j3");
    expect(loadJ3).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("degrades to C when the J3 import fails", async () => {
    installEnvironment(1280, 900);
    const { getByTestId } = render(<Harness loadJ3={async () => Promise.reject(new Error("chunk unavailable"))} />);
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "c"));
    expect(getByTestId("root").querySelector("[data-connected-j3]")).not.toBeInTheDocument();
  });

  it("prevents a pending J3 import from claiming ownership after an A-eligible resize", async () => {
    const { viewport } = installEnvironment(1280, 900);
    let resolveModule: ((module: { ConnectedStoryJ3: ComponentType }) => void) | undefined;
    const loadJ3 = vi.fn(() => new Promise<{ ConnectedStoryJ3: ComponentType }>((resolve) => { resolveModule = resolve; }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await waitFor(() => expect(loadJ3).toHaveBeenCalledOnce());
    viewport.width = 390;
    act(() => window.dispatchEvent(new Event("resize")));
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "a"));
    await act(async () => resolveModule?.({ ConnectedStoryJ3: FakeJ3 }));
    expect(getByTestId("root")).toHaveAttribute("data-family", "a");
    expect(getByTestId("root").querySelector("[data-connected-j3]")).not.toBeInTheDocument();
  });

  it("does not authorize J3 until fonts are ready, then promotes from the bounded fallback", async () => {
    vi.useFakeTimers();
    installEnvironment(1280, 900);
    let resolveFonts!: () => void;
    const ready = new Promise<void>((resolve) => { resolveFonts = resolve; });
    const fontListeners = new Set<() => void>();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        status: "loading",
        ready,
        addEventListener: (_: string, listener: () => void) => fontListeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => fontListeners.delete(listener),
      },
    });
    const loadJ3 = vi.fn(async () => ({ ConnectedStoryJ3: FakeJ3 }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    expect(getByTestId("root")).toHaveAttribute("data-family", "unresolved");
    await act(async () => vi.advanceTimersByTime(240));
    expect(getByTestId("root")).toHaveAttribute("data-family", "c");
    expect(loadJ3).not.toHaveBeenCalled();

    await act(async () => {
      resolveFonts();
      await ready;
      vi.advanceTimersByTime(20);
    });
    expect(getByTestId("root")).toHaveAttribute("data-family", "j3");
    expect(loadJ3).toHaveBeenCalledOnce();
  });

  it("falls back safely when the FontFaceSet readiness promise rejects", async () => {
    installEnvironment(1280, 900);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        status: "loading",
        ready: Promise.reject(new Error("font readiness unavailable")),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    const loadJ3 = vi.fn(async () => ({ ConnectedStoryJ3: FakeJ3 }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "c"));
    expect(loadJ3).not.toHaveBeenCalled();
  });

  it.each([
    ["unavailable", () => vi.stubGlobal("ResizeObserver", undefined)],
    ["construction failure", () => vi.stubGlobal("ResizeObserver", class {
      constructor() { throw new Error("observer unavailable"); }
    })],
    ["observation failure", () => vi.stubGlobal("ResizeObserver", class {
      observe() { throw new Error("observation unavailable"); }
      disconnect() { /* fault-path cleanup contract */ }
    })],
  ])("degrades deterministically to A when ResizeObserver is %s", async (_, installFault) => {
    installEnvironment(1280, 900);
    installFault();
    const loadJ3 = vi.fn(async () => ({ ConnectedStoryJ3: FakeJ3 }));
    const { getByTestId } = render(<Harness loadJ3={loadJ3} />);
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "a"));
    expect(loadJ3).not.toHaveBeenCalled();
    expect(getByTestId("root").querySelectorAll("[data-connected-j3]")).toHaveLength(0);
  });

  it("settles a destination-readiness failure and permits a later valid reconciliation", async () => {
    const { viewport } = installEnvironment(1280, 900);
    let destinationReady = false;
    const DeferredReadinessJ3: ComponentType = () => destinationReady ? <FakeJ3 /> : <UnreadyJ3 />;
    const { getByTestId } = render(
      <Harness loadJ3={async () => ({ ConnectedStoryJ3: DeferredReadinessJ3 })} />,
    );
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "j3"));
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-connected-transition", "settled"));
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(getByTestId("root").querySelectorAll(".pin-spacer")).toHaveLength(0);

    viewport.width = 900;
    act(() => window.dispatchEvent(new Event("resize")));
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "c"));
    destinationReady = true;
    viewport.width = 1280;
    act(() => window.dispatchEvent(new Event("resize")));
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "j3"));
    expect(getByTestId("root").querySelectorAll(".pin-spacer")).toHaveLength(1);
  });

  it("returns to the normal J3 path after fault mocks are restored", async () => {
    installEnvironment(1280, 900);
    const { getByTestId } = render(
      <Harness loadJ3={async () => ({ ConnectedStoryJ3: FakeJ3 })} />,
    );
    await waitFor(() => expect(getByTestId("root")).toHaveAttribute("data-family", "j3"));
    expect(getByTestId("root").querySelectorAll(".pin-spacer")).toHaveLength(1);
  });
});
