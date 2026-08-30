import { describe, expect, it } from "vitest";
import {
  landingHeroAutoplayStageOrder,
  landingHeroMilestones,
  landingHeroStageOrder,
  landingScrollChapters,
  landingStory,
  landingStoryStageOrder,
} from "./landingStoryModel";

describe("landing story model", () => {
  it("defines the complete future narrative in deterministic order", () => {
    expect(landingStoryStageOrder).toEqual([
      "orientation",
      "capture",
      "context",
      "progress",
      "prepare",
      "resolve",
      "act",
    ]);
  });

  it("preserves the four visible landing milestones", () => {
    expect(landingHeroStageOrder).toEqual(["capture", "progress", "prepare", "act"]);
    expect(landingHeroAutoplayStageOrder).toEqual([
      "capture",
      "context",
      "progress",
      "prepare",
      "resolve",
      "act",
    ]);
    expect(landingHeroMilestones.map(({ stage }) => stage)).toEqual(landingHeroStageOrder);
  });

  it("defines four body chapters from the same opportunity narrative", () => {
    expect(landingHeroMilestones[0].detail).toContain(landingStory.opportunity.source);
    expect(landingHeroMilestones[1].detail).toBe(landingStory.interview.dateLabel);
    expect(landingScrollChapters.map(({ stage }) => stage)).toEqual([
      "capture",
      "progress",
      "prepare",
      "act",
    ]);
    expect(landingScrollChapters[0].description).toContain("follow-up");
    expect(landingScrollChapters[1].title).toContain("History");
    expect(landingScrollChapters[2].description).toContain("context");
    expect(landingScrollChapters[3].description).toContain("follow-up");
  });
});
