import { describe, expect, it } from "vitest";
import {
  landingHeroAutoplayStageOrder,
  landingHeroMilestones,
  landingHeroStageOrder,
  landingScrollChapters,
  landingStory,
  landingStoryStageOrder,
  landingWorkspace,
  landingWorkspaceStageOrder,
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

  it("defines a four-workspace body story across multiple opportunities", () => {
    expect(landingHeroMilestones[0].detail).toContain(landingStory.opportunity.source);
    expect(landingHeroMilestones[1].detail).toBe(landingStory.interview.dateLabel);
    expect(landingScrollChapters.map(({ stage }) => stage)).toEqual([
      "applications",
      "interviews",
      "preparation",
      "action-center",
    ]);
    expect(landingWorkspaceStageOrder).toEqual(landingScrollChapters.map(({ stage }) => stage));
    expect(landingWorkspace.opportunities.map(({ company }) => company)).toEqual([
      "Northstar Labs",
      "Atlas Systems",
      "Harborline",
    ]);
    expect(landingWorkspace.priorities.map(({ priority }) => priority)).toEqual(["now", "waiting", "later"]);
  });
});
