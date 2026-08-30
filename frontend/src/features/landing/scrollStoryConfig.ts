import type { LandingHeroStage } from "./landingStoryModel";

export const scrollStoryDesktopQuery =
  "(min-width: 1024px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)";

export const scrollStoryTimelineLabels = {
  capture: 0,
  context: 0.2,
  progress: 0.32,
  prepare: 0.4,
  resolve: 0.68,
  act: 0.85,
  settled: 0.94,
} as const;

export function scrollChapterForProgress(progress: number): LandingHeroStage {
  if (progress >= scrollStoryTimelineLabels.act) return "act";
  if (progress >= scrollStoryTimelineLabels.prepare) return "prepare";
  if (progress >= scrollStoryTimelineLabels.context) return "progress";
  return "capture";
}
