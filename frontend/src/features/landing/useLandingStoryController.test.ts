import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLandingStoryController } from "./useLandingStoryController";

afterEach(() => {
  vi.useRealTimers();
});

describe("useLandingStoryController", () => {
  it("autoplays once and leaves no timer after Prepare", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLandingStoryController(false));

    expect(result.current.currentStage).toBe("capture");
    for (const expected of ["progress", "prepare"]) {
      act(() => vi.runOnlyPendingTimers());
      expect(result.current.currentStage).toBe(expected);
    }
    expect(result.current.playbackMode).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("supports pause, manual selection, play, and replay deterministically", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLandingStoryController(false));

    act(() => result.current.pause());
    expect(result.current.playbackMode).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);

    act(() => result.current.selectStage("progress"));
    expect(result.current.playbackMode).toBe("manual");
    act(() => vi.runOnlyPendingTimers());
    expect(result.current.currentStage).toBe("progress");

    act(() => result.current.play());
    act(() => vi.runOnlyPendingTimers());
    expect(result.current.currentStage).toBe("prepare");

    act(() => result.current.replay());
    expect(result.current.currentStage).toBe("capture");
    expect(result.current.playbackMode).toBe("autoplay");
  });

  it("keeps a manual selection authoritative when an autoplay timer was pending", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLandingStoryController(false));

    act(() => result.current.selectStage("progress"));
    act(() => vi.runOnlyPendingTimers());

    expect(result.current).toMatchObject({
      currentStage: "progress",
      playbackMode: "manual",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps Act manually selectable without extending autoplay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLandingStoryController(false));

    act(() => result.current.selectStage("act"));
    act(() => result.current.play());

    expect(result.current).toMatchObject({
      currentStage: "act",
      playbackMode: "manual",
    });
    expect(vi.getTimerCount()).toBe(0);

    act(() => result.current.replay());
    expect(result.current).toMatchObject({
      currentStage: "capture",
      playbackMode: "autoplay",
    });
  });

  it("initializes and remains static in reduced motion", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLandingStoryController(true));

    expect(result.current).toMatchObject({ currentStage: "act", playbackMode: "reduced" });
    expect(vi.getTimerCount()).toBe(0);

    act(() => result.current.selectStage("capture"));
    act(() => result.current.play());
    expect(result.current).toMatchObject({ currentStage: "capture", playbackMode: "reduced" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels autoplay when reduced motion becomes active and stays settled when it clears", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ reducedMotion }) => useLandingStoryController(reducedMotion),
      { initialProps: { reducedMotion: false } },
    );

    rerender({ reducedMotion: true });
    expect(result.current).toMatchObject({ currentStage: "act", playbackMode: "reduced" });
    expect(vi.getTimerCount()).toBe(0);

    rerender({ reducedMotion: false });
    expect(result.current).toMatchObject({ currentStage: "act", playbackMode: "complete" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
