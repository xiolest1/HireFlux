import { describe, expect, it } from "vitest";
import {
  instantToWorkspaceInput,
  workspaceInputToInstant,
} from "./interviewTimeZone";

describe("interview workspace time-zone conversion", () => {
  it("interprets wall time in the workspace zone instead of the browser zone", () => {
    expect(
      workspaceInputToInstant("2026-08-27T14:00", "America/New_York"),
    ).toBe("2026-08-27T18:00:00.000Z");
  });

  it("rejects a wall time skipped by daylight saving time", () => {
    expect(() =>
      workspaceInputToInstant("2026-03-08T02:30", "America/New_York"),
    ).toThrow(/does not exist.*daylight saving time/i);
  });

  it("uses the earlier instant when daylight saving time repeats a wall time", () => {
    expect(
      workspaceInputToInstant("2026-11-01T01:30", "America/New_York"),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("round-trips an existing interview through the saved workspace zone", () => {
    const input = instantToWorkspaceInput(
      "2026-12-15T19:00:00Z",
      "America/New_York",
    );
    expect(input).toBe("2026-12-15T14:00");
    expect(workspaceInputToInstant(input, "America/New_York")).toBe(
      "2026-12-15T19:00:00.000Z",
    );
  });
});
