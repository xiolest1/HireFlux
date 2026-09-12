import { describe, expect, it } from "vitest";
import { landingJourneyOrder } from "./landingStoryModel";
import {
  connectedStoryCheckpointNamespace,
  connectedStoryJ3Boundaries,
  correctionIsEligible,
  createConnectedStoryCheckpoint,
  incomingChapterForProgress,
  isCCapable,
  isJ3CapacityEligible,
  j3ProgressForSemanticPosition,
  selectConnectedStoryFamily,
  semanticPositionForJ3Progress,
  validateConnectedStoryCheckpoint,
  type ConnectedStoryEnvironment,
} from "./connectedStoryReconciliation";

const environment: ConnectedStoryEnvironment = {
  revision: 1,
  width: 1280,
  height: 900,
  containerWidth: 1160,
  rootFontPx: 16,
  reducedMotion: false,
  fontsReady: true,
  j3Fit: true,
  cCapable: true,
};

describe("connected story reconciliation", () => {
  it("owns the exact canonical journey and incoming boundary semantics", () => {
    expect(landingJourneyOrder).toEqual([
      "pre-story",
      "applications",
      "interviews",
      "preparation",
      "action-center",
      "post-story",
    ]);
    expect(connectedStoryJ3Boundaries).toEqual([0, 0.24, 0.46, 0.76, 1]);
    expect(incomingChapterForProgress(0.2399)).toBe("applications");
    expect(incomingChapterForProgress(0.24)).toBe("interviews");
    expect(incomingChapterForProgress(0.46)).toBe("preparation");
    expect(incomingChapterForProgress(0.76)).toBe("action-center");
  });

  it("selects monotonically and never permits J3 under reduced motion", () => {
    expect(selectConnectedStoryFamily(environment)).toBe("j3");
    expect(selectConnectedStoryFamily({ ...environment, fontsReady: false })).toBe("c");
    expect(selectConnectedStoryFamily({ ...environment, j3Fit: false })).toBe("c");
    expect(selectConnectedStoryFamily({ ...environment, j3Fit: false, cCapable: false })).toBe("a");
    expect(selectConnectedStoryFamily({ ...environment, reducedMotion: true })).toBe("c");
    expect(selectConnectedStoryFamily({ ...environment, reducedMotion: true, cCapable: false })).toBe("a");
    expect(isJ3CapacityEligible(environment)).toBe(true);
    expect(isJ3CapacityEligible({ ...environment, reducedMotion: true })).toBe(false);
    expect(isCCapable(environment)).toBe(true);
  });

  it("round-trips authored J3 semantics without raw document offsets", () => {
    const position = semanticPositionForJ3Progress(0.6);
    expect(position.chapter).toBe("preparation");
    expect(j3ProgressForSemanticPosition(position)).toBeCloseTo(0.6);
    expect(position).not.toHaveProperty("scrollY");
  });

  it("validates one namespaced, versioned, bounded checkpoint", () => {
    expect(connectedStoryCheckpointNamespace).toBe("__hirefluxConnectedStory");
    const checkpoint = createConnectedStoryCheckpoint({
      chapter: "interviews",
      localProgress: 2,
      codaProgress: -1,
    });
    expect(checkpoint).toEqual({
      version: 1,
      chapter: "interviews",
      localProgress: 1,
      codaProgress: 0,
    });
    expect(validateConnectedStoryCheckpoint(checkpoint)).toEqual({
      chapter: "interviews",
      localProgress: 1,
      codaProgress: 0,
    });
    expect(validateConnectedStoryCheckpoint({ ...checkpoint, version: 2 })).toBeNull();
    expect(validateConnectedStoryCheckpoint({ ...checkpoint, chapter: "unknown" })).toBeNull();
  });

  it("requires current environment, transition, family, intent and a single correction", () => {
    const guard = {
      environmentRevision: 4,
      transitionRevision: 8,
      intentRevision: 2,
      targetFamily: "c" as const,
    };
    expect(correctionIsEligible({ expected: guard, current: guard, semanticDestinationValid: true, alreadyCorrected: false })).toBe(true);
    expect(correctionIsEligible({ expected: guard, current: { ...guard, intentRevision: 3 }, semanticDestinationValid: true, alreadyCorrected: false })).toBe(false);
    expect(correctionIsEligible({ expected: guard, current: guard, semanticDestinationValid: false, alreadyCorrected: false })).toBe(false);
    expect(correctionIsEligible({ expected: guard, current: guard, semanticDestinationValid: true, alreadyCorrected: true })).toBe(false);
  });
});
