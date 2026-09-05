import { describe, expect, it } from "vitest";
import {
  benefitStreamTieEpsilonPixels,
  normalizeBenefitLoopOffset,
  resolveBenefitManualDestination,
  resolveNearestBenefitSignal,
  type BenefitSignalPoint,
} from "./useBenefitsStream";

const candidates: readonly BenefitSignalPoint[] = [
  { logicalIndex: 0, streamIndex: 0, point: 0, cycle: 0 },
  { logicalIndex: 1, streamIndex: 1, point: 100, cycle: 0 },
];

describe("resolveNearestBenefitSignal", () => {
  it("resolves immediately before the midpoint to the earlier signal", () => {
    expect(resolveNearestBenefitSignal(49.7, candidates)).toMatchObject({ logicalIndex: 0 });
  });

  it("uses the later stream signal for exact and effectively equal midpoint ties", () => {
    expect(resolveNearestBenefitSignal(50, candidates)).toMatchObject({ logicalIndex: 1 });
    expect(
      resolveNearestBenefitSignal(50 - benefitStreamTieEpsilonPixels / 2, candidates),
    ).toMatchObject({ logicalIndex: 1 });
  });

  it("resolves immediately after the midpoint to the later signal", () => {
    expect(resolveNearestBenefitSignal(50.3, candidates)).toMatchObject({ logicalIndex: 1 });
  });

  it("maps identical midpoint geometry to the same requested destination on every run", () => {
    const results = Array.from({ length: 20 }, () =>
      resolveBenefitManualDestination(50, candidates, "next", 2));
    expect(results).toEqual(
      Array.from({ length: 20 }, () => ({
        logicalIndex: 1,
        streamIndex: 1,
        cycle: 0,
        destinationIndex: 0,
      })),
    );
  });

  it("keeps the before/midpoint/after destination boundary explicit", () => {
    expect(resolveBenefitManualDestination(49.7, candidates, "next", 2).destinationIndex).toBe(1);
    expect(resolveBenefitManualDestination(50, candidates, "next", 2).destinationIndex).toBe(0);
    expect(resolveBenefitManualDestination(50.3, candidates, "next", 2).destinationIndex).toBe(0);
  });

  it("normalizes clone coordinates to the same ambient phase", () => {
    expect(normalizeBenefitLoopOffset(-384, 2_224)).toBe(-384);
    expect(normalizeBenefitLoopOffset(-2_608, 2_224)).toBe(-384);
    expect(normalizeBenefitLoopOffset(-2_224, 2_224)).toBe(0);
  });
});
