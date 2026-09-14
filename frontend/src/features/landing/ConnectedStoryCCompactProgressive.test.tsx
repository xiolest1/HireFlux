import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedStoryCCompactProgressive } from "./ConnectedStoryCCompactProgressive";

const disconnect = vi.fn();
const observe = vi.fn();
let callback: IntersectionObserverCallback;
let observerOptions: IntersectionObserverInit | undefined;

beforeEach(() => {
  disconnect.mockClear();
  observe.mockClear();
  observerOptions = undefined;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(next: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      callback = next;
      observerOptions = options;
    }
    observe = observe;
    disconnect = disconnect;
  });
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(844);
});

describe("ConnectedStoryCCompactProgressive", () => {
  it("keeps one semantic story and one inert persistent visual workspace", () => {
    const { container } = render(
      <ConnectedStoryCCompactProgressive activeChapter="applications" onChapterChange={vi.fn()} onCapabilityFailure={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-connected-c-semantic-chapter]")).toHaveLength(4);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(container.querySelectorAll("[data-connected-c-compact-workspace]")).toHaveLength(1);
    expect(container.querySelector("[data-connected-c-compact-workspace]")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[data-connected-c-compact-workspace]")).toHaveAttribute("inert");
    expect(container.querySelectorAll('[data-connected-c-compact-endpoint][data-active="true"]')).toHaveLength(1);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    expect(container.querySelector(".pin-spacer")).not.toBeInTheDocument();
  });

  it("creates only one active observer and releases it under Strict Mode cleanup", () => {
    const { unmount } = render(
      <StrictMode>
        <ConnectedStoryCCompactProgressive activeChapter="applications" onChapterChange={vi.fn()} onCapabilityFailure={vi.fn()} />
      </StrictMode>,
    );
    expect(observe).toHaveBeenCalledTimes(8);
    expect(observerOptions?.rootMargin).toBe("-11% 0px -87% 0px");
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("resolves directly to the latest compact chapter without replaying intermediates", () => {
    const onChapterChange = vi.fn();
    const { container } = render(
      <ConnectedStoryCCompactProgressive activeChapter="applications" onChapterChange={onChapterChange} onCapabilityFailure={vi.fn()} />,
    );
    const chapters = Array.from(container.querySelectorAll<HTMLElement>("[data-connected-c-semantic-chapter]"));
    chapters.forEach((chapter, index) => vi.spyOn(chapter, "getBoundingClientRect").mockReturnValue({
      top: (index - 3) * 600,
      bottom: (index - 2) * 600,
      left: 0,
      right: 358,
      width: 358,
      height: 600,
      x: 0,
      y: (index - 3) * 600,
      toJSON: () => ({}),
    }));
    act(() => callback([], {} as IntersectionObserver));
    expect(onChapterChange).toHaveBeenCalledTimes(1);
    expect(onChapterChange).toHaveBeenLastCalledWith("action-center");
  });
});
