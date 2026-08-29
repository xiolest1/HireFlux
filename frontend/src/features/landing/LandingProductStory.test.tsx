import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroApplicationStory, ProgressiveProductStory } from "./LandingProductStory";
import { landingStory } from "./landingStoryModel";

function matchMedia(reducedMotion: boolean) {
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HeroApplicationStory", () => {
  it("advances through the advanced milestones and settles at Prepare", () => {
    matchMedia(false);
    vi.useFakeTimers();
    render(<HeroApplicationStory />);

    const story = document.querySelector("[data-hero-story]");
    const frame = story?.querySelector("[aria-live='off']");
    expect(story).toHaveAttribute("data-story-step", "capture");
    expect(frame).toHaveClass("min-h-[28.5rem]");

    for (const expected of ["progress", "prepare"]) {
      act(() => vi.runOnlyPendingTimers());
      expect(story).toHaveAttribute("data-story-step", expected);
    }

    expect(screen.getByRole("button", { name: "Replay application story" })).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lets keyboard users pause and resume the self-running story", async () => {
    matchMedia(false);
    const user = userEvent.setup();
    render(<HeroApplicationStory />);

    const pause = screen.getByRole("button", { name: "Pause application story" });
    await user.tab();
    expect(pause).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Play application story" })).toBeVisible();
  });

  it("keeps a manually selected stage from being overwritten by autoplay", () => {
    matchMedia(false);
    vi.useFakeTimers();
    render(<HeroApplicationStory />);

    fireEvent.click(screen.getByRole("button", { name: "Show Prepare stage" }));
    expect(document.querySelector("[data-hero-story]")).toHaveAttribute("data-story-step", "prepare");
    expect(screen.getByRole("button", { name: "Show Prepare stage" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Replay application story" })).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("replays from Capture after the story completes", () => {
    matchMedia(false);
    vi.useFakeTimers();
    render(<HeroApplicationStory />);

    for (let index = 0; index < 2; index += 1) {
      act(() => vi.runOnlyPendingTimers());
    }
    fireEvent.click(screen.getByRole("button", { name: "Replay application story" }));

    expect(document.querySelector("[data-hero-story]")).toHaveAttribute("data-story-step", "capture");
    expect(screen.getByRole("button", { name: "Pause application story" })).toBeVisible();
  });

  it("keeps Act available as the static Phase A presentation", () => {
    matchMedia(false);
    render(<HeroApplicationStory />);

    fireEvent.click(screen.getByRole("button", { name: "Show Act stage" }));

    expect(document.querySelector("[data-hero-story]")).toHaveAttribute("data-story-step", "act");
    expect(screen.getByText("The next move is visible")).toBeVisible();
    expect(document.querySelector("[aria-live='off']")).toHaveClass("min-h-[14.5rem]");
    expect(document.querySelector("[data-flux-story]")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay application story" })).toBeVisible();
  });

  it("renders a stable selectable story with reduced motion", () => {
    matchMedia(true);
    vi.useFakeTimers();
    render(<HeroApplicationStory />);

    expect(document.querySelector("[data-hero-story]")).toHaveAttribute("data-story-step", "act");
    expect(screen.getByText("The next move is visible")).toBeVisible();
    expect(screen.queryByRole("button", { name: /application story/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show Capture stage" }));
    expect(document.querySelector("[data-hero-story]")).toHaveAttribute("data-story-step", "capture");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("ProgressiveProductStory", () => {
  it("uses the shared opportunity model across the hero and proof story", () => {
    matchMedia(false);
    render(<><HeroApplicationStory /><ProgressiveProductStory /></>);

    expect(screen.getAllByText(landingStory.opportunity.company).length).toBeGreaterThan(1);
    expect(screen.getAllByText(landingStory.opportunity.role).length).toBeGreaterThan(1);
  });

  it("keeps all three snapshots in the mobile fallback and supports manual desktop selection", () => {
    render(<ProgressiveProductStory />);

    const mobile = screen.getByTestId("mobile-product-story");
    expect(mobile).toHaveTextContent("Capture");
    expect(mobile).toHaveTextContent("Move");
    expect(mobile).toHaveTextContent("Learn");
    expect(mobile).toHaveTextContent("What should I do next?");

    const learn = screen.getByRole("button", { name: "Show Learn moment" });
    fireEvent.click(learn);
    expect(learn).toHaveAttribute("aria-pressed", "true");
  });
});
