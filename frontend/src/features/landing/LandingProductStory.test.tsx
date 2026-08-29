import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroApplicationStory, ProgressiveProductStory } from "./LandingProductStory";

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
  it("advances through a deterministic four-part application story without changing its frame", () => {
    matchMedia(false);
    vi.useFakeTimers();
    render(<HeroApplicationStory />);

    const story = document.querySelector("[data-hero-story]");
    const frame = story?.querySelector("[aria-live='off']");
    expect(story).toHaveAttribute("data-story-step", "capture");
    expect(frame).toHaveClass("min-h-[14.5rem]");

    for (const expected of ["progress", "prepare", "act", "capture"]) {
      act(() => vi.advanceTimersByTime(3_000));
      expect(story).toHaveAttribute("data-story-step", expected);
      expect(frame).toHaveClass("min-h-[14.5rem]");
    }
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

  it("renders the complete story as a stable final state with reduced motion", () => {
    matchMedia(true);
    render(<HeroApplicationStory />);

    expect(document.querySelector("[data-hero-story]")).toHaveAttribute("data-story-step", "act");
    expect(screen.getByText("The next move is visible")).toBeVisible();
    expect(screen.queryByRole("button", { name: /application story/i })).not.toBeInTheDocument();
    for (const label of ["Capture", "Progress", "Prepare", "Act"]) {
      expect(screen.getByText(label)).toBeVisible();
    }
  });
});

describe("ProgressiveProductStory", () => {
  it("keeps all three snapshots in the mobile fallback and supports desktop selection", () => {
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
