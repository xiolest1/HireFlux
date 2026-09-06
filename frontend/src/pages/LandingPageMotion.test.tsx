import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";

describe("LandingPage hero entrance boundary", () => {
  it("uses five semantic presentation groups without changing the inner product targets", async () => {
    const { container } = renderApp("/", { withSession: false });

    await screen.findByRole("heading", {
      name: "Keep every opportunity connected to what comes next.",
      level: 1,
    });

    expect(container.querySelectorAll("[data-hero-entrance]")).toHaveLength(5);
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
});
