import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedStoryJ3 } from "./ConnectedStoryJ3";
import { scrollStoryTimelineLabels, scrollStoryTravelViewportHeights } from "./scrollStoryConfig";

const mocks = vi.hoisted(() => {
  let activeContexts = 0;
  let maximumContexts = 0;
  let configuration: unknown;
  const trigger = { kill: vi.fn(), progress: 0, getTween: vi.fn() };
  const timeline = {
    addLabel: vi.fn(), set: vi.fn(), fromTo: vi.fn(), to: vi.fn(),
    eventCallback: vi.fn(), progress: vi.fn(() => 0), duration: vi.fn(() => 0.88),
    kill: vi.fn(), scrollTrigger: trigger,
  };
  for (const method of [timeline.addLabel, timeline.set, timeline.fromTo, timeline.to, timeline.eventCallback]) method.mockReturnValue(timeline);
  return {
    timeline,
    trigger,
    timelineFactory: vi.fn((value: unknown) => { configuration = value; return timeline; }),
    registerPlugin: vi.fn(),
    context: vi.fn((setup: () => void) => {
      activeContexts += 1;
      maximumContexts = Math.max(maximumContexts, activeContexts);
      setup();
      return { revert: vi.fn(() => { activeContexts -= 1; }) };
    }),
    reset: () => { activeContexts = 0; maximumContexts = 0; configuration = undefined; },
    counts: () => ({ activeContexts, maximumContexts }),
    configuration: () => configuration as { scrollTrigger: { end: () => string; onRefresh: (trigger: { progress: number }) => void } },
  };
});

vi.mock("gsap", () => ({ gsap: { registerPlugin: mocks.registerPlugin, timeline: mocks.timelineFactory, context: mocks.context } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reset();
  for (const method of [mocks.timeline.addLabel, mocks.timeline.set, mocks.timeline.fromTo, mocks.timeline.to, mocks.timeline.eventCallback]) method.mockReturnValue(mocks.timeline);
  mocks.timeline.progress.mockReturnValue(0);
});

afterEach(() => vi.restoreAllMocks());

describe("ConnectedStoryJ3", () => {
  it("preserves the frozen timeline, one trigger, S2 envelope settlement, and R68 release", () => {
    const { container } = render(<ConnectedStoryJ3 />);
    expect(mocks.timelineFactory).toHaveBeenCalledOnce();
    expect(mocks.configuration().scrollTrigger).toMatchObject({ pinSpacing: true, start: "top top", scrub: 0.35, anticipatePin: 1, invalidateOnRefresh: true });
    expect(mocks.configuration().scrollTrigger.end()).toBe(`+=${Math.round(window.innerHeight * scrollStoryTravelViewportHeights)}`);
    expect(mocks.timeline.addLabel).toHaveBeenCalledWith("applications", scrollStoryTimelineLabels.applications);
    expect(mocks.timeline.addLabel).toHaveBeenCalledWith("interviews", scrollStoryTimelineLabels.interviews);
    expect(mocks.timeline.addLabel).toHaveBeenCalledWith("preparation", scrollStoryTimelineLabels.preparation);
    expect(mocks.timeline.addLabel).toHaveBeenCalledWith("action-center", scrollStoryTimelineLabels.actionCenter);
    expect(mocks.timeline.addLabel).toHaveBeenCalledWith("settled", scrollStoryTimelineLabels.settled);
    expect(mocks.timeline.fromTo).toHaveBeenCalledWith("[data-workspace-stage-envelope]", { y: 0 }, expect.objectContaining({ duration: 0.135 }), 0.67);
    expect(container.querySelector("[data-scroll-story-release-buffer]")).toBeInTheDocument();
    expect(container.querySelector("[data-connected-j3]")).toHaveAttribute("data-connected-timeline-active", "true");
    expect(container.querySelectorAll("[data-scroll-story-pin]")).toHaveLength(1);
  });

  it("reports semantic chapter changes only across authored boundaries", () => {
    const onChapterChange = vi.fn();
    render(<ConnectedStoryJ3 onChapterChange={onChapterChange} />);
    const update = mocks.timeline.eventCallback.mock.calls.find(([event]) => event === "onUpdate")?.[1] as () => void;
    mocks.timeline.progress.mockReturnValue(0.25);
    act(() => update());
    expect(onChapterChange).toHaveBeenLastCalledWith("interviews");
    act(() => update());
    expect(onChapterChange).toHaveBeenCalledTimes(1);
    mocks.timeline.progress.mockReturnValue(0.8);
    act(() => update());
    expect(onChapterChange).toHaveBeenLastCalledWith("action-center");
  });

  it("is Strict Mode-safe and cleans only its owned lifecycle", () => {
    const { unmount } = render(<StrictMode><ConnectedStoryJ3 /></StrictMode>);
    expect(mocks.counts().maximumContexts).toBe(1);
    expect(mocks.counts().activeContexts).toBe(1);
    unmount();
    expect(mocks.counts().activeContexts).toBe(0);
    expect(mocks.trigger.kill).toHaveBeenCalled();
    expect(mocks.timeline.kill).toHaveBeenCalled();
  });
});
