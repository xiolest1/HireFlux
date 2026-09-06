import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLandingRevealObserverOptions,
  landingRevealBottomRootMargin,
  landingRevealHandshakeMs,
  landingRevealObserverThreshold,
} from "./landingViewportRevealConfig";
import { LandingViewportReveal } from "./LandingViewportReveal";

function bounds(top: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 600,
    width: 600,
    height: bottom - top,
    toJSON: () => ({}),
  };
}

function motionPreference(initialReducedMotion = false) {
  let reducedMotion = initialReducedMotion;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    get matches() {
      return reducedMotion;
    },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    ),
    dispatchEvent: vi.fn(),
  } as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => media));

  return {
    set(nextReducedMotion: boolean) {
      reducedMotion = nextReducedMotion;
      const event = { matches: reducedMotion, media: media.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

class ObserverStub implements IntersectionObserver {
  static instances: ObserverStub[] = [];

  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly callback: IntersectionObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? "0px";
    this.thresholds = [typeof options?.threshold === "number" ? options.threshold : 0];
    ObserverStub.instances.push(this);
  }

  emit(target: Element, options: { intersecting?: boolean; top?: number; bottom?: number }) {
    const targetBounds = bounds(options.top ?? 900, options.bottom ?? 1000);
    this.callback([{
      time: 0,
      target,
      rootBounds: bounds(0, 800),
      boundingClientRect: targetBounds,
      intersectionRect: options.intersecting ? targetBounds : bounds(0, 0),
      isIntersecting: options.intersecting ?? false,
      intersectionRatio: options.intersecting ? 1 : 0,
    }], this);
  }
}

function reveal() {
  return screen.getByTestId("content").parentElement as HTMLElement;
}

function renderReveal() {
  return render(
    <LandingViewportReveal className="custom-class">
      <button data-testid="content">Focusable content</button>
    </LandingViewportReveal>,
  );
}

beforeEach(() => {
  ObserverStub.instances = [];
  motionPreference(false);
  vi.stubGlobal("IntersectionObserver", ObserverStub);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    bounds(900, 1000),
  );
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LandingViewportReveal", () => {
  it("keeps final-visible presentation as the semantic base state", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    renderReveal();

    expect(reveal()).toHaveClass("hf-landing-viewport-reveal", "custom-class");
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(reveal()).toHaveAttribute("data-reveal-motion", "none");
    expect(reveal()).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("places only safely-below geometry into pending observation", () => {
    renderReveal();

    expect(reveal()).toHaveAttribute("data-reveal-state", "pending");
    expect(ObserverStub.instances).toHaveLength(1);
    expect(ObserverStub.instances[0]?.observe).toHaveBeenCalledWith(reveal());
    expect(ObserverStub.instances[0]?.rootMargin).toBe(
      createLandingRevealObserverOptions(window.innerHeight).rootMargin,
    );
    expect(ObserverStub.instances[0]?.rootMargin).toContain(
      ` ${landingRevealBottomRootMargin} `,
    );
    expect(ObserverStub.instances[0]?.thresholds).toEqual([
      landingRevealObserverThreshold,
    ]);
  });

  it.each([
    ["already intersecting", 700, 900],
    ["already passed", -200, -10],
    ["just below the viewport boundary", 800.5, 900],
  ])("leaves %s geometry immediately revealed", (_label, top, bottom) => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      bounds(top, bottom),
    );
    renderReveal();

    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(ObserverStub.instances).toHaveLength(0);
  });

  it("reveals once on qualifying entry and disconnects", () => {
    renderReveal();
    const observer = ObserverStub.instances[0] as ObserverStub;

    act(() => observer.emit(reveal(), { intersecting: true, top: 700, bottom: 800 }));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(reveal()).toHaveAttribute("data-reveal-motion", "entry");
    expect(observer.disconnect).toHaveBeenCalledOnce();

    act(() => observer.emit(reveal(), { intersecting: false, top: 900, bottom: 1000 }));
    act(() => observer.emit(reveal(), { intersecting: true, top: 700, bottom: 800 }));
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(reveal()).toHaveAttribute("data-reveal-motion", "entry");
  });

  it("fails open when a fast scroll passes the pending instance", () => {
    renderReveal();
    const observer = ObserverStub.instances[0] as ObserverStub;

    act(() => observer.emit(reveal(), { top: -200, bottom: -1 }));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(reveal()).toHaveAttribute("data-reveal-motion", "none");
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("fails open when observer construction or observation fails", () => {
    const constructionFailure = vi.fn(() => {
      throw new Error("constructor failed");
    });
    vi.stubGlobal("IntersectionObserver", constructionFailure);
    const first = renderReveal();
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    first.unmount();

    class ObserveFailure extends ObserverStub {
      override observe = vi.fn(() => {
        throw new Error("observe failed");
      });
    }
    vi.stubGlobal("IntersectionObserver", ObserveFailure);
    renderReveal();
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(ObserveFailure.instances.at(-1)?.disconnect).toHaveBeenCalled();
  });

  it("uses one bounded watchdog only until the initial observer handshake", () => {
    vi.useFakeTimers();
    const first = renderReveal();
    const firstObserver = ObserverStub.instances[0] as ObserverStub;

    act(() => vi.advanceTimersByTime(landingRevealHandshakeMs));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(reveal()).toHaveAttribute("data-reveal-motion", "none");
    expect(firstObserver.disconnect).toHaveBeenCalledOnce();
    first.unmount();

    renderReveal();
    const secondObserver = ObserverStub.instances.at(-1) as ObserverStub;
    act(() => secondObserver.emit(reveal(), { top: 900, bottom: 1000 }));
    act(() => vi.advanceTimersByTime(landingRevealHandshakeMs * 2));
    expect(reveal()).toHaveAttribute("data-reveal-state", "pending");
    expect(secondObserver.disconnect).not.toHaveBeenCalled();
  });

  it("does not arm the watchdog after a synchronous initial observer result", () => {
    vi.useFakeTimers();
    class SynchronousObserver extends ObserverStub {
      override observe = vi.fn((target: Element) => {
        this.emit(target, { top: 900, bottom: 1000 });
      });
    }
    vi.stubGlobal("IntersectionObserver", SynchronousObserver);
    renderReveal();

    act(() => vi.advanceTimersByTime(landingRevealHandshakeMs * 2));
    expect(reveal()).toHaveAttribute("data-reveal-state", "pending");
    expect(SynchronousObserver.instances.at(-1)?.disconnect).not.toHaveBeenCalled();
  });

  it("resolves reduced motion permanently without constructing an observer", () => {
    const preference = motionPreference(true);
    renderReveal();

    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(ObserverStub.instances).toHaveLength(0);

    act(() => preference.set(false));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(ObserverStub.instances).toHaveLength(0);
  });

  it("resolves pending content permanently when reduced motion becomes active", () => {
    const preference = motionPreference(false);
    renderReveal();
    const observer = ObserverStub.instances[0] as ObserverStub;

    act(() => preference.set(true));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(reveal()).toHaveAttribute("data-reveal-motion", "none");
    expect(observer.disconnect).toHaveBeenCalled();

    act(() => preference.set(false));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(ObserverStub.instances).toHaveLength(1);
  });

  it("makes focus-triggered resolution permanent without moving focus", () => {
    renderReveal();
    const observer = ObserverStub.instances[0] as ObserverStub;
    const button = screen.getByRole("button");

    act(() => button.focus());
    expect(button).toHaveFocus();
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    expect(reveal()).toHaveAttribute("data-reveal-motion", "none");
    expect(observer.disconnect).toHaveBeenCalledOnce();

    act(() => button.blur());
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
  });

  it("cleans pending observers and watchdogs on unmount", () => {
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = renderReveal();
    const observer = ObserverStub.instances[0] as ObserverStub;
    const target = reveal();

    unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(timeoutSpy).toHaveBeenCalled();
    act(() => observer.emit(target, { intersecting: true }));
    act(() => vi.advanceTimersByTime(landingRevealHandshakeMs * 2));
  });

  it("keeps only the current observer active under Strict Mode effect replay", () => {
    render(
      <StrictMode>
        <LandingViewportReveal>
          <button data-testid="content">Focusable content</button>
        </LandingViewportReveal>
      </StrictMode>,
    );

    expect(ObserverStub.instances).toHaveLength(2);
    expect(ObserverStub.instances[0]?.disconnect).toHaveBeenCalledOnce();
    expect(ObserverStub.instances[1]?.disconnect).not.toHaveBeenCalled();

    act(() => ObserverStub.instances[0]?.emit(reveal(), { intersecting: true }));
    expect(reveal()).toHaveAttribute("data-reveal-state", "pending");
    act(() => ObserverStub.instances[1]?.emit(reveal(), { intersecting: true }));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
  });

  it("starts a fresh lifecycle only after a fresh mount", () => {
    const first = renderReveal();
    act(() => ObserverStub.instances[0]?.emit(reveal(), { intersecting: true }));
    expect(reveal()).toHaveAttribute("data-reveal-state", "revealed");
    first.unmount();

    renderReveal();
    expect(reveal()).toHaveAttribute("data-reveal-state", "pending");
    expect(ObserverStub.instances).toHaveLength(2);
  });
});
