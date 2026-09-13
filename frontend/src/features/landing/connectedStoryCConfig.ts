export type ConnectedStoryCProgressiveCapability = "eligible" | "retainable" | "ineligible";

export const connectedStoryCConfiguration = {
  minWidth: 768,
  minUsableHeight: 720,
  minContainerWidth: 700,
  maxRootFontPx: 20,
  stickyInsetPx: 16,
  shellHeightPx: 560,
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

export function normalizeProgressiveCDeploymentFlag(value: unknown) {
  return value === "on";
}

export const progressiveCAllowed = normalizeProgressiveCDeploymentFlag(
  import.meta.env.VITE_CONNECTED_STORY_PROGRESSIVE_C,
);

export function connectedStoryCCssVariables(): React.CSSProperties {
  const config = connectedStoryCConfiguration;
  return {
    "--hf-connected-c-sticky-inset": `${config.stickyInsetPx}px`,
    "--hf-connected-c-shell-height": `${config.shellHeightPx}px`,
    "--hf-connected-c-base-travel": `${config.baseChapterTravelVh}vh`,
    "--hf-connected-c-preparation-travel": `${config.preparationChapterTravelVh}vh`,
    "--hf-connected-c-action-travel": `${config.actionChapterTravelVh}vh`,
    "--hf-connected-c-release-tail": `${config.releaseTailVh}vh`,
    "--hf-connected-c-transition-duration": `${config.transitionDurationMs}ms`,
  } as React.CSSProperties;
}
