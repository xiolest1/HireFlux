import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollProductStory } from "./ScrollProductStory";
import {
  scrollChapterForProgress,
  scrollStoryAdaptedQuery,
  scrollStoryAdaptedTravelViewportHeights,
  scrollStoryDesktopQuery,
  scrollStoryFullQuery,
  scrollStoryModeConfiguration,
  scrollStoryTimelineLabels,
  scrollStoryTravelViewportHeights,
} from "./scrollStoryConfig";

const gsapMocks = vi.hoisted(() => {
  let matchedMode: "full" | "adapted" | "static" = "full";
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
    eventCallback: vi.fn(),
    progress: vi.fn(() => 0),
    duration: vi.fn(() => 0.88),
    kill: vi.fn(),
    scrollTrigger: trigger,
  };
  for (const method of [timeline.addLabel, timeline.set, timeline.fromTo, timeline.to, timeline.eventCallback]) {
    method.mockReturnValue(timeline);
  }

  const media = {
    add: vi.fn((_conditions: Record<string, string>, setup: (context: { conditions: Record<string, boolean> }) => void | (() => void)) => {
      if (matchedMode === "static") return;
      const cleanup = setup({
        conditions: {
          full: matchedMode === "full",
          adapted: matchedMode === "adapted",
        },
      });
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
    setMatchedMode: (mode: "full" | "adapted" | "static") => { matchedMode = mode; },
    getActiveContexts: () => activeContexts,
    getMaximumActiveContexts: () => maximumActiveContexts,
    getLastTimelineConfiguration: () => lastTimelineConfiguration,
    reset: () => {
      matchedMode = "full";
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
  for (const method of [gsapMocks.timeline.addLabel, gsapMocks.timeline.set, gsapMocks.timeline.fromTo, gsapMocks.timeline.to, gsapMocks.timeline.eventCallback]) {
    method.mockReturnValue(gsapMocks.timeline);
  }
  gsapMocks.timeline.progress.mockReturnValue(0);
});

afterEach(() => vi.unstubAllGlobals());

describe("scroll story configuration", () => {
  it("maps the four semantic workspaces and settled endpoint", () => {
    expect(scrollStoryTimelineLabels).toEqual({
      applications: 0,
      interviews: 0.24,
      preparation: 0.46,
      actionCenter: 0.76,
      settled: 0.94,
    });
    expect([0, 0.24, 0.46, 0.76].map(scrollChapterForProgress)).toEqual([
      "applications",
      "interviews",
      "preparation",
      "action-center",
    ]);
    expect(scrollStoryTravelViewportHeights).toBe(2.5);
    expect(scrollStoryAdaptedTravelViewportHeights).toBe(2);
    expect(scrollStoryDesktopQuery).toBe(scrollStoryFullQuery);
    expect(scrollStoryAdaptedQuery).toContain("max-width: 1023.99px");
    expect(scrollStoryAdaptedQuery).toContain("max-height: 719.99px");
    expect(scrollStoryModeConfiguration.adapted).toMatchObject({
      travelViewportHeights: 2,
      interviewEnterX: 32,
      preparationEnterY: 20,
      actionEnterY: 8,
    });
  });
});

describe("ScrollProductStory", () => {
  it("creates one desktop timeline with the approved pin configuration", () => {
    setReducedMotion(false);
    render(<ScrollProductStory />);

    expect(gsapMocks.media.add).toHaveBeenCalledWith(
      { full: scrollStoryFullQuery, adapted: scrollStoryAdaptedQuery },
      expect.any(Function),
    );
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
    for (const [label, position] of [
      ["applications", scrollStoryTimelineLabels.applications],
      ["interviews", scrollStoryTimelineLabels.interviews],
      ["preparation", scrollStoryTimelineLabels.preparation],
      ["action-center", scrollStoryTimelineLabels.actionCenter],
      ["settled", scrollStoryTimelineLabels.settled],
    ] as const) {
      expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith(
        label,
        position,
      );
    }
    expect(gsapMocks.timeline.set).toHaveBeenCalledWith(
      "[data-workspace-shell]",
      expect.objectContaining({ x: 0, y: 0, scale: 1 }),
      0,
    );
    expect(gsapMocks.timeline.set).toHaveBeenCalledWith(
      '[data-scroll-copy-stage]:not([data-scroll-copy-stage="applications"])',
      expect.objectContaining({ autoAlpha: 0, y: 4 }),
      0,
    );
    for (const [outgoing, incoming, boundary] of [
      ["applications", "interviews", scrollStoryTimelineLabels.interviews],
      ["interviews", "preparation", scrollStoryTimelineLabels.preparation],
      ["preparation", "action-center", scrollStoryTimelineLabels.actionCenter],
    ] as const) {
      expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
        `[data-scroll-copy-stage="${outgoing}"]`,
        expect.objectContaining({ autoAlpha: 0, y: -4, duration: 0.88 * 0.012, ease: "power1.out" }),
        0.88 * (boundary - 0.012),
      );
      expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
        `[data-scroll-copy-stage="${incoming}"]`,
        expect.objectContaining({ autoAlpha: 1, y: 0, duration: 0.88 * 0.012, ease: "power2.out" }),
        0.88 * (boundary - 0.004),
      );
    }
    expect(gsapMocks.timeline.set).not.toHaveBeenCalledWith(
      expect.stringContaining("data-scroll-copy-stage"),
      expect.objectContaining({ y: -7 }),
      expect.any(Number),
    );
    expect(gsapMocks.timeline.set).toHaveBeenCalledWith(
      "[data-workspace-panel]:not([data-workspace-applications])",
      expect.objectContaining({ autoAlpha: 0 }),
      0,
    );
    expect(gsapMocks.timeline.set).not.toHaveBeenCalledWith(
      "[data-workspace-panel]",
      expect.anything(),
      0,
    );
    expect(gsapMocks.timeline.to).not.toHaveBeenCalledWith(
      "[data-workspace-shell]",
      expect.anything(),
      expect.anything(),
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-workspace-applications]",
      expect.objectContaining({ scaleX: 0.28, duration: 0.13 }),
      0.08,
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-workspace-applications]",
      expect.objectContaining({ autoAlpha: 0, duration: 0.04 }),
      0.17,
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-workspace-handoff-line]",
      expect.objectContaining({ scaleX: 1 }),
      0.12,
    );
    expect(gsapMocks.timeline.set).toHaveBeenCalledWith(
      "[data-workspace-interviews]",
      expect.objectContaining({ zIndex: 30, autoAlpha: 1 }),
      0.15,
    );
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-interview-content]",
      expect.objectContaining({ autoAlpha: 0.4 }),
      expect.objectContaining({ autoAlpha: 1, duration: 0.18 }),
      0.15,
    );
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-preparation]",
      expect.objectContaining({ scaleY: 0.62, autoAlpha: 0 }),
      expect.objectContaining({ scaleY: 1, autoAlpha: 1 }),
      0.41,
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-workspace-preparation]",
      expect.objectContaining({ scaleY: 0.26, autoAlpha: 0, duration: 0.06 }),
      0.655,
    );
    expect(gsapMocks.timeline.set).toHaveBeenCalledWith(
      "[data-workspace-actions]",
      expect.objectContaining({ zIndex: 40, autoAlpha: 1 }),
      0.67,
    );
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-action-content]",
      expect.objectContaining({ autoAlpha: 0.45 }),
      expect.objectContaining({ autoAlpha: 1, duration: 0.11 }),
      0.68,
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith("[data-workspace-actions]", { duration: 0.055 }, 0.825);
    expect(gsapMocks.timeline.fromTo).not.toHaveBeenCalledWith(
      "[data-workspace-story-cta]",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(screen.getByTestId("desktop-product-story").closest("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "full");
  });

  it("uses one compact timeline for adapted-capability viewports", () => {
    setReducedMotion(false);
    gsapMocks.setMatchedMode("adapted");
    const { container } = render(<ScrollProductStory />);

    expect(gsapMocks.timelineFactory).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
    const configuration = gsapMocks.getLastTimelineConfiguration() as {
      scrollTrigger: { end: () => string };
    };
    expect(configuration.scrollTrigger.end()).toBe(`+=${Math.round(window.innerHeight * 2)}`);
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-interviews]",
      expect.objectContaining({ x: 32 }),
      expect.anything(),
      0.15,
    );
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-preparation]",
      expect.objectContaining({ y: 20 }),
      expect.anything(),
      0.41,
    );
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-actions]",
      expect.objectContaining({ y: 8 }),
      expect.anything(),
      0.67,
    );
  });

  it("commits React chapter state from the rendered timeline only when semantic boundaries change", () => {
    setReducedMotion(false);
    const { container } = render(<ScrollProductStory />);
    const update = gsapMocks.timeline.eventCallback.mock.calls.find(
      ([event]) => event === "onUpdate",
    )?.[1] as () => void;
    const story = container.querySelector("[data-scroll-story]");

    gsapMocks.timeline.progress.mockReturnValue(0.1);
    act(() => update());
    expect(story).toHaveAttribute("data-active-chapter", "applications");
    gsapMocks.timeline.progress.mockReturnValue(0.25);
    act(() => update());
    expect(story).toHaveAttribute("data-active-chapter", "interviews");
    expect(container.querySelectorAll("[data-scroll-progress-segment][data-active]")).toHaveLength(1);
    expect(container.querySelector('[data-scroll-progress-segment="interviews"]')).toHaveAttribute("data-active", "true");
    gsapMocks.timeline.progress.mockReturnValue(0.7);
    act(() => update());
    expect(story).toHaveAttribute("data-active-chapter", "preparation");
    expect(container.querySelector('[data-scroll-progress-segment="preparation"]')).toHaveAttribute("data-active", "true");
    gsapMocks.timeline.progress.mockReturnValue(0.9);
    act(() => update());
    expect(story).toHaveAttribute("data-active-chapter", "action-center");
    expect(container.querySelector('[data-scroll-progress-segment="action-center"]')).toHaveAttribute("data-active", "true");
    gsapMocks.timeline.progress.mockReturnValue(0.3);
    act(() => update());
    expect(story).toHaveAttribute("data-active-chapter", "interviews");
    expect(container.querySelector('[data-scroll-progress-segment="interviews"]')).toHaveAttribute("data-active", "true");
  });

  it("creates no pinned timeline for static-capability viewports", () => {
    setReducedMotion(false);
    gsapMocks.setMatchedMode("static");
    const { container } = render(<ScrollProductStory />);

    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    expect(container.querySelector("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "static");
    expect(screen.getByTestId("mobile-product-story")).toBeInTheDocument();
  });

  it("prevents a stale same-mode cleanup from clearing the current branch", () => {
    setReducedMotion(false);
    gsapMocks.setMatchedMode("static");
    const { container } = render(<ScrollProductStory />);
    const responsiveSetup = gsapMocks.media.add.mock.calls[0]?.[1] as (
      context: { conditions: { full: boolean; adapted: boolean } },
    ) => (() => void);
    const story = container.querySelector("[data-scroll-story]");

    const adaptedContext = { conditions: { full: false, adapted: true } };
    const cleanupPrevious = responsiveSetup(adaptedContext);
    const cleanupCurrent = responsiveSetup(adaptedContext);
    cleanupPrevious();
    expect(story).toHaveAttribute("data-scroll-mode", "adapted");
    cleanupCurrent();
    expect(story).toHaveAttribute("data-scroll-mode", "static");
  });

  it("creates no GSAP lifecycle for reduced motion and exposes every chapter", () => {
    setReducedMotion(true);
    const { container } = render(<ScrollProductStory />);

    expect(gsapMocks.context).not.toHaveBeenCalled();
    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    for (const question of [
      "How do I keep the search organized?",
      "How does the history stay connected?",
      "How does that context improve preparation?",
      "What deserves attention next?",
    ]) {
      expect(screen.getAllByText(question).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll("[data-scroll-static-stage]")).toHaveLength(4);
    expect(screen.getAllByText("Atlas Systems").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Harborline").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Start Demo Workspace" })).not.toBeInTheDocument();
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("keeps every workspace endpoint mounted and ends with stable chapter progress", () => {
    setReducedMotion(true);
    const { container } = render(<ScrollProductStory />);

    expect(container.querySelectorAll("[data-workspace-opportunity]")).not.toHaveLength(0);
    expect(container.querySelector("[data-workspace-interviews]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-interview-content]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-handoff]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-preparation]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-preparation-readiness]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-preparation-primary]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-preparation-supporting]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-history-origin]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-action-content]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-stage-envelope]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-priority-primary]")).toBeInTheDocument();
    expect(container.querySelector("[data-workspace-priority-supporting]")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-workspace-priority]")).not.toHaveLength(0);
    expect(container.querySelector("[data-scroll-narrative]")).toBeInTheDocument();
    expect(container.querySelector("[data-scroll-progress]")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-scroll-copy-content]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-scroll-copy-label]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-scroll-copy-question]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-scroll-copy-headline]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-scroll-copy-body]")).toHaveLength(4);
    const narrative = container.querySelector("[data-scroll-narrative]")!;
    expect(narrative.querySelector("[data-scroll-copy-stack]")?.nextElementSibling).toBe(
      narrative.querySelector("[data-scroll-progress]"),
    );
    expect(narrative.querySelector("[data-scroll-progress]")?.nextElementSibling).toBeNull();
    expect(container.querySelectorAll("[data-scroll-progress-segment]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-scroll-progress-segment][data-active]")).toHaveLength(1);
    expect(container.querySelector('[data-scroll-progress-segment="applications"]')).toHaveAttribute("data-active", "true");
    expect(container.querySelector("[data-workspace-story-cta]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-scroll-story-release-buffer]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-rail]")).not.toBeInTheDocument();

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
