export type ConnectedStoryCProgressiveCapability = "eligible" | "retainable" | "ineligible";

export const connectedStoryCConfiguration = {
  minWidth: 768,
  minUsableHeight: 720,
  minContainerWidth: 700,
  maxRootFontPx: 20,
  stickyInsetPx: 16,
  shellHeightPx: 560,
  visualFrameHeightPx: 560,
  observerBandPercent: 2,
  equalityEpsilonPx: 1,
  fitTolerancePx: 1,
  entryReservePx: 8,
  retentionReservePx: 1,
  baseChapterTravelVh: 78,
  preparationChapterTravelVh: 85,
  actionChapterTravelVh: 90,
  releaseTailVh: 25,
  transitionDurationMs: 180,
} as const;

export const connectedStoryCCompactConfiguration = {
  minWidth: 360,
  minUsableHeight: 760,
  minContainerWidth: 328,
  maxRootFontPx: 20,
  stickyInsetPx: 12,
  shellHeightPx: 420,
  visualFrameHeightPx: 600,
  ownershipLineRatio: 0.12,
  entryReservePx: 8,
  retentionHeightReservePx: 24,
  retentionWidthReservePx: 1,
  fitTolerancePx: 1,
  baseChapterTravelVh: 74,
  preparationChapterTravelVh: 82,
  actionChapterTravelVh: 92,
  releaseTailVh: 16,
  transitionDurationMs: 160,
} as const;

export function normalizeProgressiveCDeploymentFlag(value: unknown) {
  return value === undefined || value === "on";
}

export const progressiveCAllowed = normalizeProgressiveCDeploymentFlag(
  import.meta.env.VITE_CONNECTED_STORY_PROGRESSIVE_C,
);

export function connectedStoryCCssVariables(): React.CSSProperties {
  const config = connectedStoryCConfiguration;
  return {
    "--hf-connected-c-sticky-inset": `${config.stickyInsetPx}px`,
    "--hf-connected-c-shell-height": `${config.shellHeightPx}px`,
    "--hf-connected-c-visual-frame-height": `${config.visualFrameHeightPx}px`,
    "--hf-connected-c-base-travel": `${config.baseChapterTravelVh}vh`,
    "--hf-connected-c-preparation-travel": `${config.preparationChapterTravelVh}vh`,
    "--hf-connected-c-action-travel": `${config.actionChapterTravelVh}vh`,
    "--hf-connected-c-release-tail": `${config.releaseTailVh}vh`,
    "--hf-connected-c-transition-duration": `${config.transitionDurationMs}ms`,
  } as React.CSSProperties;
}

export function connectedStoryCCompactCssVariables(): React.CSSProperties {
  const config = connectedStoryCCompactConfiguration;
  return {
    "--hf-connected-compact-sticky-inset": `${config.stickyInsetPx}px`,
    "--hf-connected-compact-shell-height": `${config.shellHeightPx}px`,
    "--hf-connected-compact-visual-frame-height": `${config.visualFrameHeightPx}px`,
    "--hf-connected-compact-base-travel": `${config.baseChapterTravelVh}vh`,
    "--hf-connected-compact-preparation-travel": `${config.preparationChapterTravelVh}vh`,
    "--hf-connected-compact-action-travel": `${config.actionChapterTravelVh}vh`,
    "--hf-connected-compact-release-tail": `${config.releaseTailVh}vh`,
    "--hf-connected-compact-transition-duration": `${config.transitionDurationMs}ms`,
  } as React.CSSProperties;
}
