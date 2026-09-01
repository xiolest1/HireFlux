import { describe, expect, it } from "vitest";
import {
  landingScrollChapters,
  landingStory,
  landingWorkspace,
  landingWorkspaceStageOrder,
} from "./landingStoryModel";

describe("landing story model", () => {
  it("defines one concrete opportunity and its resolved next action", () => {
    expect(landingStory.opportunity.company).toBe("Northstar Labs");
    expect(landingStory.opportunity.role).toBe("Senior Frontend Platform Engineer");
    expect(landingStory.action.nextAction).toBe("Send a thoughtful follow-up");
  });

  it("defines a four-workspace body story across multiple opportunities", () => {
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
