export type ConnectedStoryCProgressiveCapability = "eligible" | "retainable" | "ineligible";

export const connectedStoryCConfiguration = {
  minWidth: 768,
  minUsableHeight: 720,
  minContainerWidth: 700,
  maxRootFontPx: 20,
  shellHeightPx: 560,
  visualFrameHeightPx: 560,
  observerBandPercent: 2,
  equalityEpsilonPx: 1,
  fitTolerancePx: 1,
  entryReservePx: 8,
  retentionReservePx: 1,
  stickyInsetCss: "min(clamp(4.5rem, 10svh, 7rem), calc(100svh - var(--hf-connected-c-visual-frame-height) - 1rem))",
  applicationsChapterTravelCss: "clamp(26rem, 54svh, 34rem)",
  interviewsChapterTravelCss: "clamp(24rem, 50svh, 32rem)",
  preparationChapterTravelCss: "clamp(28rem, 58svh, 38rem)",
  actionChapterTravelCss: "clamp(32rem, 66svh, 42rem)",
  actionHoldCss: "clamp(6rem, 16svh, 10rem)",
  releaseClearanceRem: 2.5,
  externalReleaseTailPx: 0,
  transitionDurationMs: 180,
} as const;

export const connectedStoryCCompactConfiguration = {
  minWidth: 360,
  minUsableHeight: 760,
  minContainerWidth: 328,
  maxRootFontPx: 20,
  shellHeightPx: 420,
  visualFrameHeightPx: 600,
  ownershipLineRatio: 0.12,
  entryReservePx: 8,
  retentionHeightReservePx: 24,
  retentionWidthReservePx: 1,
  fitTolerancePx: 1,
  stickyInsetCss: "min(clamp(3rem, 8svh, 4.5rem), calc(100svh - var(--hf-connected-compact-visual-frame-height) - 0.75rem))",
  applicationsChapterTravelCss: "clamp(24rem, 52svh, 28rem)",
  interviewsChapterTravelCss: "clamp(23rem, 50svh, 27rem)",
  preparationChapterTravelCss: "clamp(27rem, 60svh, 31rem)",
  actionChapterTravelCss: "clamp(40rem, 88svh, 46rem)",
  actionHoldCss: "clamp(11rem, 24svh, 13rem)",
  releaseClearanceRem: 2.5,
  externalReleaseTailPx: 0,
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
    "--hf-connected-c-sticky-inset": config.stickyInsetCss,
    "--hf-connected-c-shell-height": `${config.shellHeightPx}px`,
    "--hf-connected-c-visual-frame-height": `${config.visualFrameHeightPx}px`,
    "--hf-connected-c-applications-travel": config.applicationsChapterTravelCss,
    "--hf-connected-c-interviews-travel": config.interviewsChapterTravelCss,
    "--hf-connected-c-preparation-travel": config.preparationChapterTravelCss,
    "--hf-connected-c-action-travel": config.actionChapterTravelCss,
    "--hf-connected-c-action-hold": config.actionHoldCss,
    "--hf-connected-c-release-lead": `max(0px, calc(100svh - var(--hf-connected-c-visual-frame-height) - var(--hf-connected-c-sticky-inset) - ${config.releaseClearanceRem}rem))`,
    "--hf-connected-c-transition-duration": `${config.transitionDurationMs}ms`,
  } as React.CSSProperties;
}

export function connectedStoryCCompactCssVariables(): React.CSSProperties {
  const config = connectedStoryCCompactConfiguration;
  return {
    "--hf-connected-compact-sticky-inset": config.stickyInsetCss,
    "--hf-connected-compact-shell-height": `${config.shellHeightPx}px`,
    "--hf-connected-compact-visual-frame-height": `${config.visualFrameHeightPx}px`,
    "--hf-connected-compact-applications-travel": config.applicationsChapterTravelCss,
    "--hf-connected-compact-interviews-travel": config.interviewsChapterTravelCss,
    "--hf-connected-compact-preparation-travel": config.preparationChapterTravelCss,
    "--hf-connected-compact-action-travel": config.actionChapterTravelCss,
    "--hf-connected-compact-action-hold": config.actionHoldCss,
    "--hf-connected-compact-release-lead": `max(0px, calc(100svh - var(--hf-connected-compact-visual-frame-height) - var(--hf-connected-compact-sticky-inset) - ${config.releaseClearanceRem}rem))`,
    "--hf-connected-compact-transition-duration": `${config.transitionDurationMs}ms`,
  } as React.CSSProperties;
}
