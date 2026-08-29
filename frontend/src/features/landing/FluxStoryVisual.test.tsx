import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FluxStoryVisual } from "./FluxStoryVisual";

const gsapMocks = vi.hoisted(() => {
  const targetTweens: Array<{ kill: ReturnType<typeof vi.fn> }> = [];
  let activeContexts = 0;
  let maximumActiveContexts = 0;
  const timeline = {
    addLabel: vi.fn(),
    to: vi.fn(),
    tweenTo: vi.fn(),
    kill: vi.fn(),
  };
  timeline.addLabel.mockReturnValue(timeline);
  timeline.to.mockReturnValue(timeline);
  timeline.tweenTo.mockImplementation(() => {
    const tween = { kill: vi.fn() };
    targetTweens.push(tween);
    return tween;
  });
  return {
    context: vi.fn((setup: () => void) => {
      activeContexts += 1;
      maximumActiveContexts = Math.max(maximumActiveContexts, activeContexts);
      setup();
      return {
        revert: vi.fn(() => {
          activeContexts -= 1;
        }),
      };
    }),
    set: vi.fn(),
    timelineFactory: vi.fn(() => timeline),
    timeline,
    targetTweens,
    getActiveContexts: () => activeContexts,
    getMaximumActiveContexts: () => maximumActiveContexts,
    resetContextCounts: () => {
      activeContexts = 0;
      maximumActiveContexts = 0;
    },
  };
});

vi.mock("gsap", () => ({
  gsap: {
    context: gsapMocks.context,
    set: gsapMocks.set,
    timeline: gsapMocks.timelineFactory,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  gsapMocks.targetTweens.length = 0;
  gsapMocks.resetContextCounts();
  gsapMocks.timeline.addLabel.mockReturnValue(gsapMocks.timeline);
  gsapMocks.timeline.to.mockReturnValue(gsapMocks.timeline);
  gsapMocks.timeline.tweenTo.mockImplementation(() => {
    const tween = { kill: vi.fn() };
    gsapMocks.targetTweens.push(tween);
    return tween;
  });
});

describe("FluxStoryVisual", () => {
  it("builds one readable six-scene timeline", () => {
    render(<FluxStoryVisual stage="capture" reducedMotion={false} />);

    for (const label of [
      "capture:start",
      "context:start",
      "progress:start",
      "prepare:start",
      "resolve:start",
      "act:start",
      "act:settled",
    ]) {
      expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith(
        label,
        ...(label === "capture:start" ? [0] : []),
      );
    }
  });

  it("keeps one persistent opportunity while semantic stages change", () => {
    const { container, rerender } = render(
      <FluxStoryVisual stage="capture" reducedMotion={false} />,
    );
    const opportunity = container.querySelector("[data-persistent-opportunity]");

    rerender(<FluxStoryVisual stage="progress" reducedMotion={false} />);
    rerender(<FluxStoryVisual stage="prepare" reducedMotion={false} />);
    rerender(<FluxStoryVisual stage="resolve" reducedMotion={false} />);
    rerender(<FluxStoryVisual stage="act" reducedMotion={false} />);

    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-visual-stage",
      "act",
    );
    expect(container.querySelector("[data-persistent-opportunity]")).toBe(opportunity);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("kills an in-flight target tween before moving to a newer selection", () => {
    const { rerender } = render(
      <FluxStoryVisual stage="capture" reducedMotion={false} />,
    );
    const captureTween = gsapMocks.targetTweens[0];

    rerender(<FluxStoryVisual stage="act" reducedMotion={false} />);

    expect(captureTween.kill).toHaveBeenCalledOnce();
    expect(gsapMocks.timeline.tweenTo).toHaveBeenLastCalledWith(
      "act:settled",
      expect.objectContaining({ duration: 1.02 }),
    );
  });

  it("does not create GSAP choreography for reduced motion", () => {
    const { container } = render(
      <FluxStoryVisual stage="act" reducedMotion />,
    );

    expect(gsapMocks.context).not.toHaveBeenCalled();
    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    expect(container.querySelector("[data-flux-action]")).toBeInTheDocument();
  });

  it("cleans Strict Mode contexts and leaves none active after unmount", () => {
    const { unmount } = render(
      <StrictMode>
        <FluxStoryVisual stage="capture" reducedMotion={false} />
      </StrictMode>,
    );

    expect(gsapMocks.getMaximumActiveContexts()).toBe(1);
    expect(gsapMocks.getActiveContexts()).toBe(1);

    unmount();
    expect(gsapMocks.getActiveContexts()).toBe(0);
    expect(gsapMocks.timeline.kill).toHaveBeenCalled();
  });
});
