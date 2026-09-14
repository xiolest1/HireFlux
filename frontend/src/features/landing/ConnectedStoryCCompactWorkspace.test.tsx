import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectedStoryCCompactFitProbe } from "./ConnectedStoryCCompactFitProbe";
import { ConnectedStoryCCompactWorkspace } from "./ConnectedStoryCCompactWorkspace";
import { landingWorkspaceStageOrder } from "./landingStoryModel";

describe("ConnectedStoryCCompactWorkspace", () => {
  it.each(landingWorkspaceStageOrder)("renders a stable phone workspace at the %s endpoint", (stage) => {
    const { container } = render(<ConnectedStoryCCompactWorkspace activeChapter={stage} />);
    const workspace = container.querySelector("[data-connected-c-compact-workspace]");
    expect(workspace).toHaveAttribute("aria-hidden", "true");
    expect(workspace).toHaveAttribute("inert");
    expect(container.querySelectorAll("[data-connected-c-compact-endpoint]")).toHaveLength(4);
    expect(container.querySelectorAll('[data-connected-c-compact-endpoint][data-active="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-connected-c-compact-endpoint][data-active="true"]')).toHaveAttribute(
      "data-connected-c-compact-endpoint",
      stage,
    );
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]")).toHaveLength(0);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("preserves all three Action Center priority distinctions", () => {
    const { container } = render(<ConnectedStoryCCompactWorkspace activeChapter="action-center" />);
    expect(container.querySelector('[data-connected-compact-priority="Due today"]')).toBeInTheDocument();
    expect(container.querySelector('[data-connected-compact-priority="Waiting"]')).toBeInTheDocument();
    expect(container.querySelector('[data-connected-compact-priority="Review later"]')).toBeInTheDocument();
  });

  it("provides an inert zero-footprint probe containing every measured endpoint", () => {
    const { container } = render(<ConnectedStoryCCompactFitProbe />);
    const probe = container.querySelector("[data-connected-c-compact-fit-probe]");
    expect(probe).toHaveAttribute("aria-hidden", "true");
    expect(probe).toHaveAttribute("inert");
    expect(probe).toHaveClass("h-0", "invisible", "overflow-hidden");
    expect(container.querySelectorAll("[data-connected-c-compact-fit-endpoint]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-connected-c-compact-workspace]")).toHaveLength(4);
  });
});
