import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";

describe("LandingPage motion ownership boundaries", () => {
  it("uses five semantic presentation groups without changing the inner product targets", async () => {
    const { container } = renderApp("/", { withSession: false });

    await screen.findByRole("heading", {
      name: "Keep every opportunity connected to what comes next.",
      level: 1,
    });

    expect(container.querySelectorAll("[data-hero-entrance]")).toHaveLength(5);
    expect(container.querySelector("[data-hero-motion]")).toHaveAttribute(
      "data-hero-motion",
      "active",
    );
    expect(container.querySelector("[data-hero-motion]")).toHaveAttribute(
      "data-hero-motion-eligible",
      "true",
    );
    expect(container.querySelector('[data-hero-entrance="eyebrow"]')).toHaveClass(
      "hf-hero-enter-eyebrow",
    );
    expect(container.querySelector('[data-hero-entrance="headline"]')).toHaveClass(
      "hf-hero-enter-headline",
    );
    expect(container.querySelector('[data-hero-entrance="support"]')).toHaveClass(
      "hf-hero-enter-support",
    );
    expect(container.querySelector('[data-hero-entrance="cta"]')).toContainElement(
      screen.getByRole("button", { name: "Explore the Demo" }),
    );
    expect(container.querySelector('[data-hero-entrance="visual"]')).toContainElement(
      container.querySelector("[data-flux-story]"),
    );
    expect(container.querySelector("[data-flux-story]")).not.toHaveAttribute(
      "data-hero-entrance",
    );
    expect(container.querySelector("[data-flux-story]")).toHaveAttribute(
      "data-hero-motion-eligible",
      "true",
    );
    expect(container.querySelectorAll("[data-flux-opportunity][data-hero-entrance]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-flux-next-action][data-hero-entrance]")).toHaveLength(0);
  });

  it("keeps the native CTA node focusable throughout its presentation state", async () => {
    renderApp("/", { withSession: false });
    const cta = await screen.findByRole("button", { name: "Explore the Demo" });

    cta.focus();

    expect(cta).toHaveFocus();
    expect(cta.closest('[data-hero-entrance="cta"]')).toHaveClass(
      "hf-hero-enter-cta",
    );
    expect(cta).not.toHaveAttribute("tabindex", "-1");
    expect(cta).not.toHaveAttribute("aria-hidden");
  });

  it("limits the Connected Workspace viewport reveal to its static intro", async () => {
    renderApp("/", { withSession: false });
    const heading = await screen.findByRole("heading", {
      name: "The workspace adapts around your search.",
      level: 2,
    });
    const section = heading.closest<HTMLElement>("section");
    const reveal = heading.closest<HTMLElement>("[data-landing-viewport-reveal]");
    const story = section?.querySelector<HTMLElement>("[data-scroll-story]");
    const legacyWrapper = section?.parentElement;

    expect(section).not.toBeNull();
    expect(reveal).not.toBeNull();
    expect(story).not.toBeNull();
    if (!section || !reveal || !story) throw new Error("Connected Workspace boundary is missing");
    expect(reveal).toHaveTextContent("Connected workspace");
    expect(reveal).toHaveTextContent(
      "Follow one opportunity through the search while the bigger picture stays connected.",
    );
    expect(reveal.parentElement).toBe(section);
    expect(story.parentElement).toBe(section);
    expect(reveal).not.toContainElement(story);
    expect(story.closest("[data-landing-viewport-reveal]")).toBeNull();
    expect(legacyWrapper).toHaveClass("hf-section-reveal", "hf-scroll-story-reveal");
    expect(legacyWrapper).toContainElement(reveal);
    expect(legacyWrapper).toContainElement(story);
    expect(reveal).not.toHaveAttribute("aria-hidden");
  });
});
