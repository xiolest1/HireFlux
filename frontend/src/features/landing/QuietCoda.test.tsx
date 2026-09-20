import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuietCoda } from "./QuietCoda";

describe("QuietCoda", () => {
  it("renders the frozen two-beat content in semantic order", () => {
    const { container } = render(
      <QuietCoda
        actionLabel="Explore the Demo"
        error={null}
        isCreating={false}
        onAction={vi.fn()}
      />,
    );

    const section = container.querySelector("[data-quiet-coda]")!;
    const heading = screen.getByRole("heading", {
      name: "What happened should help you see what matters now.",
      level: 2,
    });
    const support = screen.getByText(
      "When each opportunity keeps its context, you can return without rebuilding the story—and recognize whether the next move is yours.",
    );
    const action = screen.getByRole("button", { name: "Explore the Demo" });
    const reassurance = screen.getByText(
      "No sign-up. The temporary demo starts with fictional data.",
    );

    expect(section.querySelectorAll("[data-quiet-coda-beat]")).toHaveLength(2);
    expect(heading.compareDocumentPosition(support)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(support.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(action.compareDocumentPosition(reassurance)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps one stable native action node through pending presentation", () => {
    const onAction = vi.fn();
    const { rerender } = render(
      <QuietCoda
        actionLabel="Explore the Demo"
        error={null}
        isCreating={false}
        onAction={onAction}
      />,
    );
    const action = screen.getByRole("button", { name: "Explore the Demo" });

    rerender(
      <QuietCoda
        actionLabel="Preparing your workspace…"
        error={null}
        isCreating
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("button", { name: "Preparing your workspace…" })).toBe(action);
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("aria-busy", "true");
  });

  it("keeps its semantic content free of landing reveal and animation hooks", () => {
    const { container } = render(
      <QuietCoda
        actionLabel="Continue Demo"
        error={null}
        isCreating={false}
        onAction={vi.fn()}
      />,
    );
    const section = container.querySelector("[data-quiet-coda]")!;

    expect(section.querySelector("[data-landing-viewport-reveal]")).toBeNull();
    expect(section.querySelector(".hf-section-reveal")).toBeNull();
    expect(section.querySelector(".hf-content-enter")).toBeNull();
    expect(section.querySelector("[data-hero-entrance]")).toBeNull();
  });

  it("keeps one accessible headline source and one decorative DOM-order word layer", () => {
    const { container } = render(
      <QuietCoda
        actionLabel="Continue Demo"
        error={null}
        isCreating={false}
        onAction={vi.fn()}
      />,
    );
    const section = container.querySelector("[data-quiet-coda]")!;
    const heading = screen.getByRole("heading", {
      name: "What happened should help you see what matters now.",
      level: 2,
    });
    const visualHeading = section.querySelector<HTMLElement>(
      "[data-quiet-coda-visual-heading]",
    )!;

    expect(section.querySelectorAll("h2")).toHaveLength(1);
    expect(heading.querySelectorAll("[data-quiet-coda-word]")).toHaveLength(9);
    expect(visualHeading).toHaveAttribute("aria-hidden", "true");
    expect(visualHeading.textContent).toBe(
      "What happened should help you see what matters now.",
    );
    expect(heading.querySelector(".sr-only")).toHaveTextContent(
      "What happened should help you see what matters now.",
    );
  });

  it("keeps the supporting copy and action cluster ready for entry-scoped motion", () => {
    const { container } = render(
      <QuietCoda
        actionLabel="Continue Demo"
        error={null}
        isCreating={false}
        onAction={vi.fn()}
      />,
    );
    const section = container.querySelector("[data-quiet-coda]")!;

    expect(section.querySelector("[data-quiet-coda-support]")).toBeTruthy();
    expect(section.querySelector("[data-quiet-coda-action-cluster]")).toBeTruthy();
    expect(section.querySelector("[data-quiet-coda-support]")).not.toHaveAttribute(
      "aria-hidden",
    );
    expect(section.querySelector("[data-quiet-coda-action-cluster]")).not.toHaveAttribute(
      "aria-hidden",
    );
  });

  it("owns the post-story handoff without duplicating top spacing", () => {
    const { container } = render(
      <QuietCoda
        actionLabel="Continue Demo"
        error={null}
        isCreating={false}
        onAction={vi.fn()}
      />,
    );
    const section = container.querySelector<HTMLElement>("[data-quiet-coda]")!;

    expect(section).toHaveClass(
      "max-w-[90rem]",
      "pb-20",
      "sm:pb-24",
      "md:grid",
      "md:grid-cols-12",
      "lg:pb-32",
    );
    expect(section.className).not.toMatch(/(?:^|\s)(?:p|m)[ty]-/);
  });

  it("uses one local bridged grid without fake positioning", () => {
    const { container } = render(
      <QuietCoda
        actionLabel="Continue Demo"
        error={null}
        isCreating={false}
        onAction={vi.fn()}
      />,
    );
    const section = container.querySelector<HTMLElement>("[data-quiet-coda]")!;
    const layout = section.querySelector<HTMLElement>("[data-quiet-coda-layout]")!;
    const heading = screen.getByRole("heading", {
      name: "What happened should help you see what matters now.",
      level: 2,
    });

    expect(layout).toHaveClass(
      "md:col-span-10",
      "md:col-start-2",
      "md:max-w-4xl",
      "lg:col-span-8",
      "lg:col-start-3",
    );
    expect(heading).toHaveClass("md:max-w-3xl");
    expect(section.querySelectorAll("[data-quiet-coda-layout]")).toHaveLength(1);
    expect(section.querySelectorAll("button")).toHaveLength(1);
    expect(`${section.className} ${layout.className}`).not.toMatch(
      /(?:^|\s)(?:absolute|fixed|-m[lrxy]?\b|translate-[xy]-)/,
    );
  });
});
