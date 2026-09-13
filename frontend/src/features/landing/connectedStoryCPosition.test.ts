import { describe, expect, it, vi } from "vitest";
import { landingWorkspaceStageOrder } from "./landingStoryModel";
import { captureConnectedStoryPosition } from "./useConnectedStoryArchitecture";

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 700,
    width: 700,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

describe("presentation-neutral Connected Story positions", () => {
  it.each([0.15, 0.5, 0.85])("captures progressive early/mid/late chapter progress at %s", (progress) => {
    for (const [activeIndex, stage] of landingWorkspaceStageOrder.entries()) {
      const root = document.createElement("div");
      const chapters = landingWorkspaceStageOrder.map((chapter) => {
        const element = document.createElement("div");
        element.dataset.connectedCSemanticChapter = chapter;
        root.append(element);
        return element;
      });
      const height = 600;
      const activeTop = window.innerHeight / 2 - progress * height;
      chapters.forEach((chapter, index) => {
        vi.spyOn(chapter, "getBoundingClientRect").mockReturnValue(rect(activeTop + (index - activeIndex) * height, height));
      });
      vi.spyOn(root, "getBoundingClientRect").mockReturnValue(rect(activeTop - activeIndex * height, height * 4));
      const position = captureConnectedStoryPosition(root, "c", "progressive");
      expect(position.chapter).toBe(stage);
      expect(position.localProgress).toBeCloseTo(progress);
      expect(position).not.toHaveProperty("scrollY");
    }
  });

  it("preserves the native one-third reading line", () => {
    const root = document.createElement("div");
    const chapter = document.createElement("div");
    chapter.dataset.connectedChapter = "applications";
    root.append(chapter);
    const top = window.innerHeight / 3 - 300;
    vi.spyOn(chapter, "getBoundingClientRect").mockReturnValue(rect(top, 600));
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(rect(top, 600));
    expect(captureConnectedStoryPosition(root, "c", "native").localProgress).toBeCloseTo(0.5);
  });
});
