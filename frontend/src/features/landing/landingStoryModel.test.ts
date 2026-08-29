import { describe, expect, it } from "vitest";
import {
  landingHeroAutoplayStageOrder,
  landingHeroMilestones,
  landingHeroStageOrder,
  landingProofSteps,
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
    expect(landingHeroAutoplayStageOrder).toEqual(["capture", "progress", "prepare"]);
    expect(landingHeroMilestones.map(({ stage }) => stage)).toEqual(landingHeroStageOrder);
  });

  it("derives both story surfaces from the same opportunity facts", () => {
    expect(landingHeroMilestones[0].detail).toContain(landingStory.opportunity.source);
    expect(landingHeroMilestones[1].detail).toBe(landingStory.interview.dateLabel);
    expect(landingProofSteps[0].result).toContain(landingStory.opportunity.source.toLowerCase());
    expect(landingProofSteps[1].result).toContain(landingStory.interview.dateLabel.split(" · ")[0]);
  });
});
