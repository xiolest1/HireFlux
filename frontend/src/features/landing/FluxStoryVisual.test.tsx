import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FluxStoryVisual } from "./FluxStoryVisual";

const gsapMocks = vi.hoisted(() => {
  let activeContexts = 0;
  let maximumActiveContexts = 0;
  const timeline = {
    addLabel: vi.fn(),
    to: vi.fn(),
    kill: vi.fn(),
  };
  timeline.addLabel.mockReturnValue(timeline);
  timeline.to.mockReturnValue(timeline);
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
    timelineFactory: vi.fn((configuration: unknown) => {
      void configuration;
      return timeline;
    }),
    timeline,
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
  gsapMocks.resetContextCounts();
  gsapMocks.timeline.addLabel.mockReturnValue(gsapMocks.timeline);
  gsapMocks.timeline.to.mockReturnValue(gsapMocks.timeline);
});

describe("FluxStoryVisual", () => {
  it("builds one short opportunity-to-action timeline", () => {
    render(<FluxStoryVisual reducedMotion={false} />);

    expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith("opportunity", 0);
    expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith("connection", 0.28);
    expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith("action", 0.7);
    expect(gsapMocks.timeline.addLabel).toHaveBeenCalledWith("settled", 1.28);
    expect(gsapMocks.timelineFactory).toHaveBeenCalledOnce();
  });

  it("keeps only the opportunity, provenance bridge, and next action", () => {
    const { container } = render(<FluxStoryVisual reducedMotion={false} />);

    expect(container.querySelector("[data-persistent-opportunity]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-connection]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-provenance]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-next-action]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-interview]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-flux-preparation]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-flux-action]")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("reveals connection before resolving the primary action", () => {
    render(<FluxStoryVisual reducedMotion={false} />);

    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-flux-connection-line]",
      expect.objectContaining({ strokeDashoffset: 0, duration: 0.5 }),
      0.32,
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-flux-provenance]",
      expect.objectContaining({ autoAlpha: 1, duration: 0.32 }),
      0.5,
    );
    expect(gsapMocks.timeline.to).toHaveBeenCalledWith(
      "[data-flux-next-action]",
      expect.objectContaining({ autoAlpha: 1, duration: 0.58 }),
      0.7,
    );
  });

  it("marks the composition settled when the one-shot timeline completes", () => {
    const { container } = render(<FluxStoryVisual reducedMotion={false} />);
    const configuration = gsapMocks.timelineFactory.mock.calls[0]?.[0] as {
      onComplete: () => void;
    };

    configuration.onComplete();
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-hero-settled",
      "true",
    );
  });

  it("creates no GSAP choreography for reduced motion", () => {
    const { container } = render(<FluxStoryVisual reducedMotion />);

    expect(gsapMocks.context).not.toHaveBeenCalled();
    expect(gsapMocks.timelineFactory).not.toHaveBeenCalled();
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-hero-settled",
      "true",
    );
  });

  it("cleans Strict Mode contexts and leaves none active after unmount", () => {
    const { unmount } = render(
      <StrictMode>
        <FluxStoryVisual reducedMotion={false} />
      </StrictMode>,
    );

    expect(gsapMocks.getMaximumActiveContexts()).toBe(1);
    expect(gsapMocks.getActiveContexts()).toBe(1);

    unmount();
    expect(gsapMocks.getActiveContexts()).toBe(0);
    expect(gsapMocks.timeline.kill).toHaveBeenCalled();
  });
});
