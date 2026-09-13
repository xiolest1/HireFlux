import type { LandingWorkspaceStage } from "./landingStoryModel";

export interface ConnectedStoryCChapterGeometry {
  stage: LandingWorkspaceStage;
  top: number;
  bottom: number;
}

export function resolveConnectedStoryCChapter(
  chapters: readonly ConnectedStoryCChapterGeometry[],
  ownershipLine: number,
  equalityEpsilonPx = 1,
): LandingWorkspaceStage | null {
  if (!Number.isFinite(ownershipLine) || chapters.length === 0) return null;
  const valid = chapters.filter((chapter) => (
    Number.isFinite(chapter.top)
    && Number.isFinite(chapter.bottom)
    && chapter.bottom > chapter.top
  ));
  if (valid.length === 0) return null;

  const containing = valid.filter((chapter) => (
    ownershipLine >= chapter.top - equalityEpsilonPx
    && ownershipLine <= chapter.bottom + equalityEpsilonPx
  ));
  if (containing.length > 0) return containing[containing.length - 1].stage;

  let winner: ConnectedStoryCChapterGeometry | null = null;
  let winnerDistance = Number.POSITIVE_INFINITY;
  valid.forEach((chapter) => {
    const distance = ownershipLine < chapter.top
      ? chapter.top - ownershipLine
      : ownershipLine - chapter.bottom;
    if (distance < winnerDistance - equalityEpsilonPx || Math.abs(distance - winnerDistance) <= equalityEpsilonPx) {
      winner = chapter;
      winnerDistance = distance;
    }
  });
  return winner === null ? null : (winner as ConnectedStoryCChapterGeometry).stage;
}

export function connectedStoryCSemanticProgress(
  geometry: ConnectedStoryCChapterGeometry,
  ownershipLine: number,
) {
  return Math.max(0, Math.min(1, (ownershipLine - geometry.top) / Math.max(1, geometry.bottom - geometry.top)));
}
