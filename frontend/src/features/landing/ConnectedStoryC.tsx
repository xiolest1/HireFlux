import { ConnectedStoryCNative } from "./ConnectedStoryCNative";
import { ConnectedStoryCProgressive } from "./ConnectedStoryCProgressive";
import { ConnectedStoryCCompactProgressive } from "./ConnectedStoryCCompactProgressive";
import type { ConnectedStoryCPresentation } from "./connectedStoryReconciliation";
import type { LandingWorkspaceStage } from "./landingStoryModel";

export function ConnectedStoryC({
  presentation = "native",
  activeChapter = "applications",
  onChapterChange = () => undefined,
  onCapabilityFailure = () => undefined,
  onObserverGeneration,
  onPositionChange,
  observerEnabled,
}: {
  presentation?: ConnectedStoryCPresentation;
  activeChapter?: LandingWorkspaceStage;
  onChapterChange?: (chapter: LandingWorkspaceStage) => void;
  onCapabilityFailure?: () => void;
  onObserverGeneration?: (generation: number) => void;
  onPositionChange?: (chapter: LandingWorkspaceStage, localProgress: number) => void;
  observerEnabled?: boolean;
}) {
  if (presentation === "progressive") {
    return <ConnectedStoryCProgressive activeChapter={activeChapter} onChapterChange={onChapterChange} onCapabilityFailure={onCapabilityFailure} onObserverGeneration={onObserverGeneration} onPositionChange={onPositionChange} observerEnabled={observerEnabled} />;
  }
  if (presentation === "compact-progressive") {
    return <ConnectedStoryCCompactProgressive activeChapter={activeChapter} onChapterChange={onChapterChange} onCapabilityFailure={onCapabilityFailure} onObserverGeneration={onObserverGeneration} onPositionChange={onPositionChange} observerEnabled={observerEnabled} />;
  }
  return <ConnectedStoryCNative />;
}
