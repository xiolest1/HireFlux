import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedStoryCProgressive } from "./ConnectedStoryCProgressive";

const disconnect = vi.fn();
const observe = vi.fn();
let callback: IntersectionObserverCallback;

beforeEach(() => {
  disconnect.mockClear();
  observe.mockClear();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(next: IntersectionObserverCallback) { callback = next; }
    observe = observe;
    disconnect = disconnect;
  });
});

describe("ConnectedStoryCProgressive", () => {
  it("keeps one semantic story and one inert visual scene with synchronized narrative and workspace", () => {
    const { container, rerender } = render(
      <ConnectedStoryCProgressive activeChapter="applications" onChapterChange={vi.fn()} onCapabilityFailure={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-connected-c-semantic-chapter]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-connected-c-semantic-copy].sr-only")).toHaveLength(4);
    expect(container.querySelectorAll("[data-connected-c-endpoint]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-connected-c-workspace]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-connected-c-sticky-owner]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-connected-c-sticky-scene]")).toHaveLength(1);
    const owner = container.querySelector("[data-connected-c-sticky-owner]");
    const workspace = container.querySelector("[data-connected-c-workspace]");
    expect(owner).toHaveAttribute("aria-hidden", "true");
    expect(owner).toHaveAttribute("inert");
    expect(container.querySelector("[data-connected-c-workspace]")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[data-connected-c-visual-narrative]")).toHaveAttribute("data-connected-visual-chapter", "applications");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    expect(container.querySelector(".pin-spacer")).not.toBeInTheDocument();

    rerender(<ConnectedStoryCProgressive activeChapter="preparation" onChapterChange={vi.fn()} onCapabilityFailure={vi.fn()} />);
    expect(container.querySelector("[data-connected-c-sticky-owner]")).toBe(owner);
    expect(container.querySelector("[data-connected-c-workspace]")).toBe(workspace);
    expect(container.querySelector("[data-connected-c-visual-narrative]")).toHaveAttribute("data-connected-visual-chapter", "preparation");
    expect(container.querySelector("[data-connected-c-workspace]")).toHaveAttribute("data-connected-visual-chapter", "preparation");
  });

  it("creates one observer and releases it under Strict Mode cleanup", () => {
    const { unmount } = render(
      <StrictMode>
        <ConnectedStoryCProgressive activeChapter="applications" onChapterChange={vi.fn()} onCapabilityFailure={vi.fn()} />
      </StrictMode>,
    );
    expect(observe).toHaveBeenCalledTimes(8);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("reports only the latest deterministic chapter from settled geometry", () => {
    const onChapterChange = vi.fn();
    const { container } = render(
      <ConnectedStoryCProgressive activeChapter="applications" onChapterChange={onChapterChange} onCapabilityFailure={vi.fn()} />,
    );
    const chapters = Array.from(container.querySelectorAll<HTMLElement>("[data-connected-c-semantic-chapter]"));
    chapters.forEach((chapter, index) => vi.spyOn(chapter, "getBoundingClientRect").mockReturnValue({
      top: (index - 1) * 600,
      bottom: index * 600,
      left: 0,
      right: 600,
      width: 600,
      height: 600,
      x: 0,
      y: (index - 1) * 600,
      toJSON: () => ({}),
    }));
    act(() => callback([], {} as IntersectionObserver));
    expect(onChapterChange).toHaveBeenLastCalledWith("interviews");
  });

  it("degrades through controller authority when observer construction fails", () => {
    vi.stubGlobal("IntersectionObserver", class { constructor() { throw new Error("blocked"); } });
    const onCapabilityFailure = vi.fn();
    render(<ConnectedStoryCProgressive activeChapter="preparation" onChapterChange={vi.fn()} onCapabilityFailure={onCapabilityFailure} />);
    expect(onCapabilityFailure).toHaveBeenCalledTimes(1);
  });
});
