import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollProductStory } from "./ScrollProductStory";
import {
  scrollChapterForProgress,
  scrollStoryDesktopQuery,
  scrollStoryTimelineLabels,
} from "./scrollStoryConfig";

const gsapMocks = vi.hoisted(() => {
  let desktopMatches = true;
  let activeContexts = 0;
  let maximumActiveContexts = 0;
  let lastTimelineConfiguration: unknown;
  const branchCleanups: Array<() => void> = [];
  const trigger = { kill: vi.fn() };
  const timeline = {
    addLabel: vi.fn(),
    set: vi.fn(),
    fromTo: vi.fn(),
    to: vi.fn(),
    kill: vi.fn(),
    scrollTrigger: trigger,
  };
  for (const method of [timeline.addLabel, timeline.set, timeline.fromTo, timeline.to]) {
    method.mockReturnValue(timeline);
  }

  const media = {
    add: vi.fn((_query: string, setup: () => void | (() => void)) => {
      if (!desktopMatches) return;
      const cleanup = setup();
      if (cleanup) branchCleanups.push(cleanup);
    }),
    revert: vi.fn(() => {
      branchCleanups.splice(0).forEach((cleanup) => cleanup());
    }),
  };

  return {
    registerPlugin: vi.fn(),
    timelineFactory: vi.fn((configuration?: unknown) => {
      lastTimelineConfiguration = configuration;
      return timeline;
    }),
    timeline,
    trigger,
    media,
    matchMedia: vi.fn(() => media),
    context: vi.fn((setup: () => void) => {
      activeContexts += 1;
      maximumActiveContexts = Math.max(maximumActiveContexts, activeContexts);
      setup();
      return { revert: vi.fn(() => { activeContexts -= 1; }) };
    }),
    setDesktopMatches: (matches: boolean) => { desktopMatches = matches; },
    getActiveContexts: () => activeContexts,
    getMaximumActiveContexts: () => maximumActiveContexts,
    getLastTimelineConfiguration: () => lastTimelineConfiguration,
    reset: () => {
      desktopMatches = true;
      activeContexts = 0;
      maximumActiveContexts = 0;
      lastTimelineConfiguration = undefined;
      branchCleanups.splice(0);
    },
  };
});

vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: gsapMocks.registerPlugin,
    timeline: gsapMocks.timelineFactory,
    matchMedia: gsapMocks.matchMedia,
    context: gsapMocks.context,
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

function setReducedMotion(reducedMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  gsapMocks.reset();
  for (const method of [gsapMocks.timeline.addLabel, gsapMocks.timeline.set, gsapMocks.timeline.fromTo, gsapMocks.timeline.to]) {
    method.mockReturnValue(gsapMocks.timeline);
  }
});

afterEach(() => vi.unstubAllGlobals());

describe("scroll story configuration", () => {
  it("maps the four semantic chapters across six internal labels", () => {
    expect(scrollStoryTimelineLabels).toEqual({
      capture: 0,
      context: 0.2,
      progress: 0.32,
      prepare: 0.4,
      resolve: 0.68,
      act: 0.85,
      settled: 0.94,
    });
    expect([0, 0.2, 0.4, 0.85].map(scrollChapterForProgress)).toEqual([
      "capture",
      "progress",
      "prepare",
      "act",
    ]);
  });
});

describe("ScrollProductStory", () => {
  it("creates one desktop timeline with the approved pin configuration", () => {
    setReducedMotion(false);
    render(<ScrollProductStory />);

    expect(gsapMocks.media.add).toHaveBeenCalledWith(scrollStoryDesktopQuery, expect.any(Function));
    expect(gsapMocks.timelineFactory).toHaveBeenCalledOnce();
    expect(gsapMocks.timelineFactory).toHaveBeenCalledWith(expect.objectContaining({
      scrollTrigger: expect.objectContaining({
        pinSpacing: true,
        start: "top top",
        scrub: 0.35,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      }),
    }));
    for (const label of ["capture", "context", "progress", "prepare", "resolve", "act", "settled"]) {
      expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith(
        label,
        scrollStoryTimelineLabels[label as keyof typeof scrollStoryTimelineLabels],
      );
    }
  });

  it("commits React chapter state only when semantic boundaries change", () => {
    setReducedMotion(false);
    const { container } = render(<ScrollProductStory />);
    const configuration = gsapMocks.getLastTimelineConfiguration() as {
      scrollTrigger: { onUpdate: (self: { progress: number }) => void };
    };
    const update = configuration.scrollTrigger.onUpdate as (self: { progress: number }) => void;
    const story = container.querySelector("[data-scroll-story]");

    act(() => update({ progress: 0.1 }));
    expect(story).toHaveAttribute("data-active-chapter", "capture");
    act(() => update({ progress: 0.25 }));
    expect(story).toHaveAttribute("data-active-chapter", "progress");
    act(() => update({ progress: 0.7 }));
    expect(story).toHaveAttribute("data-active-chapter", "prepare");
    act(() => update({ progress: 0.9 }));
    expect(story).toHaveAttribute("data-active-chapter", "act");
    act(() => update({ progress: 0.3 }));
    expect(story).toHaveAttribute("data-active-chapter", "progress");
  });

  it("creates no pinned timeline outside the desktop media query", () => {
    setReducedMotion(false);
    gsapMocks.setDesktopMatches(false);
    render(<ScrollProductStory />);

    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    expect(screen.getByTestId("mobile-product-story")).toBeInTheDocument();
  });

  it("creates no GSAP lifecycle for reduced motion and exposes every chapter", () => {
    setReducedMotion(true);
    const { container } = render(<ScrollProductStory />);

    expect(gsapMocks.context).not.toHaveBeenCalled();
    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    for (const question of [
      "What should HireFlux remember first?",
      "How does the history stay connected?",
      "How does context guide interview preparation?",
      "Why does this action come next?",
    ]) {
      expect(screen.getAllByText(question).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll("[data-scroll-static-stage]")).toHaveLength(4);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("cleans its owned trigger and never overlaps contexts in Strict Mode", () => {
    setReducedMotion(false);
    const { unmount } = render(<StrictMode><ScrollProductStory /></StrictMode>);

    expect(gsapMocks.getMaximumActiveContexts()).toBe(1);
    expect(gsapMocks.getActiveContexts()).toBe(1);
    unmount();
    expect(gsapMocks.getActiveContexts()).toBe(0);
    expect(gsapMocks.trigger.kill).toHaveBeenCalled();
    expect(gsapMocks.timeline.kill).toHaveBeenCalled();
  });
});
