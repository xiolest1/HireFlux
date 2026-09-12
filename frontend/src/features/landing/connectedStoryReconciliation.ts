import {
  landingJourneyOrder,
  landingWorkspaceStageOrder,
  type LandingJourneyStage,
  type LandingWorkspaceStage,
} from "./landingStoryModel";
import { scrollStoryTimelineLabels } from "./scrollStoryConfig";

export type ConnectedStoryFamily = "j3" | "c" | "a";

export interface ConnectedStoryEnvironment {
  revision: number;
  width: number;
  height: number;
  containerWidth: number;
  rootFontPx: number;
  reducedMotion: boolean;
  fontsReady: boolean;
  j3Fit: boolean;
  cCapable: boolean;
}

export interface ConnectedStoryPosition {
  chapter: LandingJourneyStage;
  localProgress: number;
  codaProgress: number;
}

export interface ConnectedStoryCheckpoint {
  version: 1;
  chapter: LandingJourneyStage;
  localProgress: number;
  codaProgress: number;
}

export interface ReconciliationGuard {
  environmentRevision: number;
  transitionRevision: number;
  intentRevision: number;
  targetFamily: ConnectedStoryFamily;
}

export const connectedStoryCheckpointNamespace = "__hirefluxConnectedStory";
export const connectedStoryCheckpointVersion = 1;

export const connectedStoryPredicates = {
  j3: {
    minWidth: 1180,
    minHeight: 760,
    minContainerWidth: 1080,
    maxRootFontPx: 17.5,
  },
  c: {
    minWidth: 700,
    minHeight: 700,
    minContainerWidth: 660,
    maxRootFontPx: 20,
  },
  fontReadinessBoundMs: 240,
  j3LoadBoundMs: 800,
} as const;

export const connectedStoryJ3Boundaries = [
  scrollStoryTimelineLabels.applications,
  scrollStoryTimelineLabels.interviews,
  scrollStoryTimelineLabels.preparation,
  scrollStoryTimelineLabels.actionCenter,
  1,
] as const;

export function clampUnit(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function selectConnectedStoryFamily(
  environment: ConnectedStoryEnvironment,
): ConnectedStoryFamily {
  if (!environment.reducedMotion && environment.fontsReady && environment.j3Fit) return "j3";
  if (environment.cCapable) return "c";
  return "a";
}

export function isJ3CapacityEligible(
  environment: Pick<ConnectedStoryEnvironment, "width" | "height" | "containerWidth" | "rootFontPx" | "reducedMotion">,
) {
  const predicate = connectedStoryPredicates.j3;
  return !environment.reducedMotion
    && environment.width >= predicate.minWidth
    && environment.height >= predicate.minHeight
    && environment.containerWidth >= predicate.minContainerWidth
    && environment.rootFontPx <= predicate.maxRootFontPx;
}

export function isCCapable(
  environment: Pick<ConnectedStoryEnvironment, "width" | "height" | "containerWidth" | "rootFontPx">,
) {
  const predicate = connectedStoryPredicates.c;
  return environment.width >= predicate.minWidth
    && environment.height >= predicate.minHeight
    && environment.containerWidth >= predicate.minContainerWidth
    && environment.rootFontPx <= predicate.maxRootFontPx;
}

export function semanticPositionForJ3Progress(progress: number): ConnectedStoryPosition {
  const normalized = clampUnit(progress);
  let chapterIndex = 0;
  for (let index = 1; index < landingWorkspaceStageOrder.length; index += 1) {
    if (normalized >= connectedStoryJ3Boundaries[index]) chapterIndex = index;
  }
  const start = connectedStoryJ3Boundaries[chapterIndex];
  const end = connectedStoryJ3Boundaries[chapterIndex + 1];
  return {
    chapter: landingWorkspaceStageOrder[chapterIndex],
    localProgress: clampUnit((normalized - start) / Math.max(0.0001, end - start)),
    codaProgress: 0,
  };
}

export function j3ProgressForSemanticPosition(position: ConnectedStoryPosition) {
  if (!landingWorkspaceStageOrder.includes(position.chapter as LandingWorkspaceStage)) {
    return position.chapter === "post-story" ? 1 : 0;
  }
  const chapterIndex = landingWorkspaceStageOrder.indexOf(
    position.chapter as LandingWorkspaceStage,
  );
  const start = connectedStoryJ3Boundaries[chapterIndex];
  const end = connectedStoryJ3Boundaries[chapterIndex + 1];
  return start + clampUnit(position.localProgress) * (end - start);
}

export function incomingChapterForProgress(progress: number): LandingWorkspaceStage {
  return semanticPositionForJ3Progress(progress).chapter as LandingWorkspaceStage;
}

export function validateConnectedStoryCheckpoint(value: unknown): ConnectedStoryPosition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ConnectedStoryCheckpoint>;
  if (candidate.version !== connectedStoryCheckpointVersion) return null;
  if (!landingJourneyOrder.includes(candidate.chapter as LandingJourneyStage)) return null;
  if (typeof candidate.localProgress !== "number" || !Number.isFinite(candidate.localProgress)) return null;
  if (typeof candidate.codaProgress !== "number" || !Number.isFinite(candidate.codaProgress)) return null;
  return {
    chapter: candidate.chapter as LandingJourneyStage,
    localProgress: clampUnit(candidate.localProgress),
    codaProgress: clampUnit(candidate.codaProgress),
  };
}

export function createConnectedStoryCheckpoint(
  position: ConnectedStoryPosition,
): ConnectedStoryCheckpoint {
  return {
    version: connectedStoryCheckpointVersion,
    chapter: position.chapter,
    localProgress: clampUnit(position.localProgress),
    codaProgress: clampUnit(position.codaProgress),
  };
}

export function reconciliationGuardIsCurrent(
  expected: ReconciliationGuard,
  current: ReconciliationGuard,
) {
  return expected.environmentRevision === current.environmentRevision
    && expected.transitionRevision === current.transitionRevision
    && expected.intentRevision === current.intentRevision
    && expected.targetFamily === current.targetFamily;
}

export function correctionIsEligible(options: {
  expected: ReconciliationGuard;
  current: ReconciliationGuard;
  semanticDestinationValid: boolean;
  alreadyCorrected: boolean;
}) {
  return options.semanticDestinationValid
    && !options.alreadyCorrected
    && reconciliationGuardIsCurrent(options.expected, options.current);
}
