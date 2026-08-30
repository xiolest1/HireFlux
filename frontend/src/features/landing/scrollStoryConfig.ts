import type { LandingWorkspaceStage } from "./landingStoryModel";

export const scrollStoryDesktopQuery =
  "(min-width: 1024px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)";

export const scrollStoryTravelViewportHeights = 2.5;

export const scrollStoryTimelineLabels = {
  applications: 0,
  interviews: 0.24,
  preparation: 0.46,
  actionCenter: 0.76,
  settled: 0.94,
} as const;

export function scrollChapterForProgress(progress: number): LandingWorkspaceStage {
  if (progress >= scrollStoryTimelineLabels.actionCenter) return "action-center";
  if (progress >= scrollStoryTimelineLabels.preparation) return "preparation";
  if (progress >= scrollStoryTimelineLabels.interviews) return "interviews";
  return "applications";
}
