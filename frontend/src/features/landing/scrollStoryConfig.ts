import type { LandingWorkspaceStage } from "./landingStoryModel";

export type ScrollStoryChoreographyMode = "full" | "adapted";

export const scrollStoryFullQuery =
  "(min-width: 1024px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)";

export const scrollStoryAdaptedQuery =
  "(min-width: 900px) and (max-width: 1023px) and (min-height: 680px) and (prefers-reduced-motion: no-preference), (min-width: 1024px) and (min-height: 640px) and (max-height: 719px) and (prefers-reduced-motion: no-preference)";

export const scrollStoryDesktopQuery = scrollStoryFullQuery;

export const scrollStoryTravelViewportHeights = 2.5;
export const scrollStoryAdaptedTravelViewportHeights = 2;

export const scrollStoryModeConfiguration = {
  full: {
    travelViewportHeights: scrollStoryTravelViewportHeights,
    recentEnterX: -18,
    applicationCompressX: -10,
    interviewEnterX: 48,
    preparationEnterY: 30,
    actionEnterY: 12,
  },
  adapted: {
    travelViewportHeights: scrollStoryAdaptedTravelViewportHeights,
    recentEnterX: -12,
    applicationCompressX: -6,
    interviewEnterX: 32,
    preparationEnterY: 20,
    actionEnterY: 8,
  },
} as const satisfies Record<ScrollStoryChoreographyMode, {
  travelViewportHeights: number;
  recentEnterX: number;
  applicationCompressX: number;
  interviewEnterX: number;
  preparationEnterY: number;
  actionEnterY: number;
}>;

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
