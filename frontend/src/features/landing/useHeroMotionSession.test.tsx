import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHeroMotionSession } from "./useHeroMotionSession";

function controllableMotionPreference(initialReducedMotion: boolean) {
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
    setReducedMotion(nextReducedMotion: boolean) {
      reducedMotion = nextReducedMotion;
      const event = { matches: reducedMotion, media: media.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("useHeroMotionSession", () => {
  it("keeps live preference updates while revoking Hero motion for the mount", () => {
    const preference = controllableMotionPreference(false);
    const { result } = renderHook(() => useHeroMotionSession());

    expect(result.current).toEqual({
      currentReducedMotion: false,
      heroMotionEligible: true,
      heroMotionActive: true,
    });

    act(() => preference.setReducedMotion(true));
    expect(result.current).toEqual({
      currentReducedMotion: true,
      heroMotionEligible: false,
      heroMotionActive: false,
    });

    act(() => preference.setReducedMotion(false));
    expect(result.current).toEqual({
      currentReducedMotion: false,
      heroMotionEligible: false,
      heroMotionActive: false,
    });
  });

  it("never activates motion after a reduced-motion mount", () => {
    const preference = controllableMotionPreference(true);
    const { result } = renderHook(() => useHeroMotionSession());

    expect(result.current.heroMotionEligible).toBe(false);
    expect(result.current.heroMotionActive).toBe(false);

    act(() => preference.setReducedMotion(false));
    expect(result.current.currentReducedMotion).toBe(false);
    expect(result.current.heroMotionEligible).toBe(false);
    expect(result.current.heroMotionActive).toBe(false);
  });

  it("restores eligibility only for a fresh normal-motion mount", () => {
    const preference = controllableMotionPreference(false);
    const first = renderHook(() => useHeroMotionSession());

    act(() => preference.setReducedMotion(true));
    act(() => preference.setReducedMotion(false));
    expect(first.result.current.heroMotionEligible).toBe(false);
    first.unmount();

    const fresh = renderHook(() => useHeroMotionSession());
    expect(fresh.result.current).toEqual({
      currentReducedMotion: false,
      heroMotionEligible: true,
      heroMotionActive: true,
    });
  });
});
