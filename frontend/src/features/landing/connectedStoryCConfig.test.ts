import { describe, expect, it } from "vitest";
import {
  connectedStoryCConfiguration,
  connectedStoryCCompactConfiguration,
  connectedStoryCCompactCssVariables,
  connectedStoryCCssVariables,
  normalizeProgressiveCDeploymentFlag,
} from "./connectedStoryCConfig";
import {
  connectedStoryCSemanticProgress,
  resolveConnectedStoryCChapter,
} from "./connectedStoryCGeometry";
import { connectedStoryCCompactPreflightFits, connectedStoryCProgressivePreflightFits } from "./connectedStoryFit";

describe("progressive-C configuration and geometry", () => {
  it("enables the normal startup path and preserves explicit fail-closed overrides", () => {
    expect(normalizeProgressiveCDeploymentFlag("on")).toBe(true);
    expect(normalizeProgressiveCDeploymentFlag("off")).toBe(false);
    expect(normalizeProgressiveCDeploymentFlag(undefined)).toBe(true);
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

  it("serializes an independent compact geometry authority", () => {
    expect(connectedStoryCCompactConfiguration.ownershipLineRatio).toBe(0.12);
    expect(connectedStoryCCompactCssVariables()).toMatchObject({
      "--hf-connected-compact-shell-height": "420px",
      "--hf-connected-compact-base-travel": "74vh",
      "--hf-connected-compact-action-travel": "92vh",
      "--hf-connected-compact-release-tail": "16vh",
      "--hf-connected-compact-transition-duration": "160ms",
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

  it("admits compact mode from independent rendered fit evidence and retains bounded toolbar contraction", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-connected-c-compact-fit-stage><div data-connected-c-compact-fit-envelope>${Array.from({ length: 4 }, (_, index) => `<div data-connected-c-compact-fit-endpoint="${index}"><div data-connected-c-compact-workspace><div data-connected-c-compact-endpoint-viewport><div data-connected-c-compact-endpoint data-active="true"><div data-connected-compact-product-surface></div></div></div></div></div>`).join("")}</div></div>`;
    const stage = root.querySelector<HTMLElement>("[data-connected-c-compact-fit-stage]")!;
    const envelope = root.querySelector<HTMLElement>("[data-connected-c-compact-fit-envelope]")!;
    Object.defineProperty(stage, "offsetWidth", { value: 358 });
    Object.defineProperty(envelope, "clientHeight", { value: 420 });
    root.querySelectorAll<HTMLElement>("[data-connected-c-compact-workspace]").forEach((workspace) => Object.defineProperty(workspace, "scrollHeight", { value: 420 }));
    root.querySelectorAll<HTMLElement>("[data-connected-c-compact-endpoint-viewport]").forEach((viewport) => {
      Object.defineProperties(viewport, { clientWidth: { value: 356 }, scrollWidth: { value: 356 } });
    });
    root.querySelectorAll<HTMLElement>("[data-connected-c-compact-endpoint][data-active]").forEach((endpoint) => {
      Object.defineProperties(endpoint, { clientWidth: { value: 332 }, clientHeight: { value: 311 }, scrollHeight: { value: 311 } });
    });
    root.querySelectorAll<HTMLElement>("[data-connected-compact-product-surface]").forEach((surface) => {
      Object.defineProperties(surface, { scrollWidth: { value: 330 }, scrollHeight: { configurable: true, value: 292 } });
    });
    const base = {
      width: 390,
      usableHeight: 844,
      containerWidth: 358,
      rootFontPx: 16,
      progressiveAllowed: true,
      reducedMotion: false,
      intersectionObserverAvailable: true,
      stickySupported: true,
      currentlyCompact: false,
    };
    expect(connectedStoryCCompactPreflightFits(root, base).capability).toBe("eligible");
    expect(connectedStoryCCompactPreflightFits(root, { ...base, usableHeight: 750 }).capability).toBe("ineligible");
    expect(connectedStoryCCompactPreflightFits(root, { ...base, usableHeight: 750, currentlyCompact: true }).capability).toBe("retainable");
    expect(connectedStoryCCompactPreflightFits(root, { ...base, usableHeight: 735, currentlyCompact: true }).capability).toBe("ineligible");
    expect(connectedStoryCCompactPreflightFits(root, { ...base, reducedMotion: true }).capability).toBe("ineligible");
    expect(connectedStoryCCompactPreflightFits(root, { ...base, progressiveAllowed: false }).capability).toBe("ineligible");

    const firstSurface = root.querySelector<HTMLElement>("[data-connected-compact-product-surface]")!;
    Object.defineProperty(firstSurface, "scrollHeight", { configurable: true, value: 313 });
    expect(connectedStoryCCompactPreflightFits(root, base)).toMatchObject({ capability: "ineligible", endpointsFit: false });
    expect(connectedStoryCCompactConfiguration.minContainerWidth).toBe(328);
  });
});
