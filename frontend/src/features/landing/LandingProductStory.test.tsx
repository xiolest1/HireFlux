import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroApplicationStory } from "./LandingProductStory";

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

afterEach(() => vi.unstubAllGlobals());

describe("HeroApplicationStory", () => {
  it("presents one resolved opportunity-to-action promise without stage controls", () => {
    matchMedia(false);
    const { container } = render(
      <HeroApplicationStory reducedMotion={false} motionEligible />,
    );

    expect(container.querySelector("[data-hero-story]")).toHaveAttribute(
      "data-story-scene",
      "resolved",
    );
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-visual-stage",
      "resolved",
    );
    expect(container.querySelector("[data-persistent-opportunity]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-provenance]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-next-action]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-interview]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-flux-preparation]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /application story/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show (capture|progress|prepare|act)/i })).not.toBeInTheDocument();
  });

  it("keeps Northstar, retained history, and the next action in one composition", () => {
    matchMedia(false);
    const { container } = render(
      <HeroApplicationStory reducedMotion={false} motionEligible />,
    );

    expect(container).toHaveTextContent("Northstar Labs");
    expect(container).toHaveTextContent("Senior Frontend Platform Engineer");
    expect(container).toHaveTextContent("Interview complete · Preparation retained");
    expect(container).toHaveTextContent("Send a thoughtful follow-up");
    expect(container).toHaveTextContent("One opportunity, connected from capture to action.");
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("renders the same resolved meaning immediately for reduced motion", () => {
    matchMedia(true);
    const { container } = render(
      <HeroApplicationStory reducedMotion motionEligible={false} />,
    );

    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-hero-settled",
      "true",
    );
    expect(container.querySelector("[data-persistent-opportunity]")).toBeInTheDocument();
    expect(container.querySelector("[data-flux-next-action]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /application story/i })).not.toBeInTheDocument();
  });
});
