import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollProductStory } from "./ScrollProductStory";
import {
  scrollChapterForProgress,
  scrollStoryDesktopQuery,
  scrollStoryTimelineLabels,
  scrollStoryTravelViewportHeights,
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
  });
});

const storyProps = { ctaLabel: "Start Demo Workspace", onCta: vi.fn() };

describe("ScrollProductStory", () => {
  it("creates one desktop timeline with the approved pin configuration", () => {
    setReducedMotion(false);
    render(<ScrollProductStory {...storyProps} />);

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
      expect.objectContaining({ autoAlpha: 0 }),
      0,
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
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledWith(
      "[data-workspace-story-cta]",
      expect.objectContaining({ autoAlpha: 0 }),
      expect.objectContaining({ autoAlpha: 1 }),
      0.8,
    );
  });

  it("commits React chapter state only when semantic boundaries change", () => {
    setReducedMotion(false);
    const { container } = render(<ScrollProductStory {...storyProps} />);
    const configuration = gsapMocks.getLastTimelineConfiguration() as {
      scrollTrigger: { onUpdate: (self: { progress: number }) => void };
    };
    const update = configuration.scrollTrigger.onUpdate as (self: { progress: number }) => void;
    const story = container.querySelector("[data-scroll-story]");

    act(() => update({ progress: 0.1 }));
    expect(story).toHaveAttribute("data-active-chapter", "applications");
    act(() => update({ progress: 0.25 }));
    expect(story).toHaveAttribute("data-active-chapter", "interviews");
    act(() => update({ progress: 0.7 }));
    expect(story).toHaveAttribute("data-active-chapter", "preparation");
    act(() => update({ progress: 0.9 }));
    expect(story).toHaveAttribute("data-active-chapter", "action-center");
    act(() => update({ progress: 0.3 }));
    expect(story).toHaveAttribute("data-active-chapter", "interviews");
  });

  it("creates no pinned timeline outside the desktop media query", () => {
    setReducedMotion(false);
    gsapMocks.setDesktopMatches(false);
    render(<ScrollProductStory {...storyProps} />);

    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    expect(screen.getByTestId("mobile-product-story")).toBeInTheDocument();
  });

  it("creates no GSAP lifecycle for reduced motion and exposes every chapter", () => {
    setReducedMotion(true);
    const { container } = render(<ScrollProductStory {...storyProps} />);

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
    expect(screen.getAllByRole("button", { name: "Start Demo Workspace" }).length).toBeGreaterThan(0);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("keeps every workspace endpoint mounted and wires the final CTA", () => {
    setReducedMotion(true);
    const onCta = vi.fn();
    const { container } = render(<ScrollProductStory ctaLabel="Start Demo Workspace" onCta={onCta} />);

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
    expect(container.querySelector("[data-scroll-story-release-buffer]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-rail]")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Start Demo Workspace" }).at(-1)!);
    expect(onCta).toHaveBeenCalledOnce();
  });

  it("cleans its owned trigger and never overlaps contexts in Strict Mode", () => {
    setReducedMotion(false);
    const { unmount } = render(<StrictMode><ScrollProductStory {...storyProps} /></StrictMode>);

    expect(gsapMocks.getMaximumActiveContexts()).toBe(1);
    expect(gsapMocks.getActiveContexts()).toBe(1);
    unmount();
    expect(gsapMocks.getActiveContexts()).toBe(0);
    expect(gsapMocks.trigger.kill).toHaveBeenCalled();
    expect(gsapMocks.timeline.kill).toHaveBeenCalled();
  });
});
