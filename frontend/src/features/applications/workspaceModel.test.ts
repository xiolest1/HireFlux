import { describe, expect, it } from "vitest";
import { makeApplication, makeInterview } from "../../test/fixtures";
import type { ApplicationStatus } from "../../api/schemas";
import { selectApplicationWorkspace } from "./workspaceModel";

describe("selectApplicationWorkspace", () => {
  const today = "2026-08-25";
  const now = new Date("2026-08-25T12:00:00Z");

  it.each([
    ["DRAFT", "Mark as applied"],
    ["APPLIED", "Schedule follow-up"],
    ["SCREENING", "Schedule interview"],
    ["INTERVIEW", "Schedule another interview"],
    ["OFFER", "Update decision"],
    ["ACCEPTED", "Add final note"],
    ["REJECTED", "Add reflection"],
    ["WITHDRAWN", "Add reflection"],
    ["ARCHIVED", "Restore to applied"],
  ] as const)("adapts %s to %s", (status, label) => {
    const allowed: ApplicationStatus[] = status === "ARCHIVED" ? ["APPLIED"] : status === "DRAFT" ? ["APPLIED", "ARCHIVED"] : [];
    const model = selectApplicationWorkspace({
      application: makeApplication({ status, allowed_transitions: allowed }),
      interviews: [],
      today,
      now,
    });
    expect(model.primary?.label).toBe(label);
  });

  it("prioritizes a scheduled interview over an applied-stage follow-up", () => {
    const interview = makeInterview({ scheduled_at: "2026-08-26T14:00:00Z" });
    const model = selectApplicationWorkspace({
      application: makeApplication({ status: "APPLIED", follow_up_date: today }),
      interviews: [interview],
      today,
      now,
    });
    expect(model.primary).toMatchObject({
      kind: "prepare",
      interviewId: interview.interview_id,
    });
  });

  it("never promotes a transition omitted by the backend", () => {
    const model = selectApplicationWorkspace({
      application: makeApplication({ status: "SCREENING", allowed_transitions: ["ARCHIVED"] }),
      interviews: [],
      today,
      now,
    });
    expect(model.secondary).toBeNull();
    expect(model.moreTransitions).toEqual(["ARCHIVED"]);
  });
});
