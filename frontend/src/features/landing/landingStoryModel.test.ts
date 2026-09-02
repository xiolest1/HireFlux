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

  it("gives every chapter one distinct candidate-centered narrative job", () => {
    expect(landingScrollChapters.map(({ question, title, description }) => ({ question, title, description }))).toEqual([
      {
        question: "How do I keep every opportunity in view?",
        title: "Everything starts in one workspace.",
        description: "Keep the whole search visible without letting one role take over your attention.",
      },
      {
        question: "What should carry into the interview?",
        title: "Context follows the opportunity.",
        description: "The details you already captured stay attached, so you can focus on the interview instead of rebuilding the story.",
      },
      {
        question: "How does that context help me prepare?",
        title: "Preparation starts informed.",
        description: "Start from what you already know instead of rebuilding company, role, and interview context from scratch.",
      },
      {
        question: "What deserves attention next?",
        title: "The workspace turns history into priorities.",
        description: "Completed work helps separate what needs action now from what can wait.",
      },
    ]);
    expect(landingScrollChapters.map(({ description }) => description).join(" ").toLowerCase()).not.toContain("provenance");
  });
});
