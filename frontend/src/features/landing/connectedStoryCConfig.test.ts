import { describe, expect, it } from "vitest";
import {
  connectedStoryCConfiguration,
  connectedStoryCCssVariables,
  normalizeProgressiveCDeploymentFlag,
} from "./connectedStoryCConfig";
import {
  connectedStoryCSemanticProgress,
  resolveConnectedStoryCChapter,
} from "./connectedStoryCGeometry";
import { connectedStoryCProgressivePreflightFits } from "./connectedStoryFit";

describe("progressive-C configuration and geometry", () => {
  it("fails closed for every deployment value except exact on", () => {
    expect(normalizeProgressiveCDeploymentFlag("on")).toBe(true);
    expect(normalizeProgressiveCDeploymentFlag("off")).toBe(false);
    expect(normalizeProgressiveCDeploymentFlag(undefined)).toBe(false);
    expect(normalizeProgressiveCDeploymentFlag("true")).toBe(false);
    expect(normalizeProgressiveCDeploymentFlag("ON")).toBe(false);
  });

  it("serializes the one TypeScript geometry authority into CSS variables", () => {
    expect(connectedStoryCCssVariables()).toMatchObject({
      "--hf-connected-c-sticky-inset": `${connectedStoryCConfiguration.stickyInsetPx}px`,
      "--hf-connected-c-shell-height": `${connectedStoryCConfiguration.shellHeightPx}px`,
      "--hf-connected-c-preparation-travel": `${connectedStoryCConfiguration.preparationChapterTravelVh}vh`,
      "--hf-connected-c-release-tail": `${connectedStoryCConfiguration.releaseTailVh}vh`,
      "--hf-connected-c-transition-duration": "180ms",
    });
  });

  it("uses viewport-center geometry and lets the later chapter win exact ties", () => {
    const geometry = [
      { stage: "applications" as const, top: -100, bottom: 500 },
      { stage: "interviews" as const, top: 500, bottom: 1100 },
    ];
    expect(resolveConnectedStoryCChapter(geometry, 499, 0)).toBe("applications");
    expect(resolveConnectedStoryCChapter(geometry, 500, 0)).toBe("interviews");
    expect(resolveConnectedStoryCChapter(geometry, 501, 0)).toBe("interviews");
    expect(connectedStoryCSemanticProgress(geometry[1], 800)).toBeCloseTo(0.5);
  });

  it("does not guess when geometry is absent or invalid", () => {
    expect(resolveConnectedStoryCChapter([], 400)).toBeNull();
    expect(resolveConnectedStoryCChapter([
      { stage: "applications", top: Number.NaN, bottom: 2 },
    ], 1)).toBeNull();
  });

  it("uses entry/retention reserves and rejects hard capability failures", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-connected-c-fit-stage><div data-connected-c-fit-envelope>${Array.from({ length: 4 }, (_, index) => `<div data-connected-c-fit-endpoint="${index}"><div data-connected-workspace-frame></div></div>`).join("")}</div></div>`;
    const stage = root.querySelector<HTMLElement>("[data-connected-c-fit-stage]")!;
    const envelope = root.querySelector<HTMLElement>("[data-connected-c-fit-envelope]")!;
    Object.defineProperty(stage, "offsetWidth", { value: 700 });
    Object.defineProperty(envelope, "clientHeight", { value: 560 });
    root.querySelectorAll<HTMLElement>("[data-connected-workspace-frame]").forEach((frame) => {
      Object.defineProperty(frame, "scrollHeight", { value: 559 });
    });
    const base = {
      width: 768,
      usableHeight: 728,
      containerWidth: 700,
      rootFontPx: 16,
      progressiveAllowed: true,
      reducedMotion: false,
      intersectionObserverAvailable: true,
      stickySupported: true,
      currentlyProgressive: false,
    };
    expect(connectedStoryCProgressivePreflightFits(root, base).capability).toBe("eligible");
    expect(connectedStoryCProgressivePreflightFits(root, { ...base, usableHeight: 720 }).capability).toBe("ineligible");
    expect(connectedStoryCProgressivePreflightFits(root, { ...base, usableHeight: 720, currentlyProgressive: true }).capability).toBe("retainable");
    expect(connectedStoryCProgressivePreflightFits(root, { ...base, reducedMotion: true }).capability).toBe("ineligible");
    expect(connectedStoryCProgressivePreflightFits(root, { ...base, intersectionObserverAvailable: false }).capability).toBe("ineligible");
  });
});
