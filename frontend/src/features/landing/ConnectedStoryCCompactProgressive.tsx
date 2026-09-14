import { useRef } from "react";
import { connectedStoryCCompactConfiguration, connectedStoryCCompactCssVariables } from "./connectedStoryCConfig";
import { ConnectedStoryCCompactWorkspace } from "./ConnectedStoryCCompactWorkspace";
import { ConnectedChapterNarrative } from "./ConnectedStoryPrimitives";
import { landingScrollChapters, type LandingWorkspaceStage } from "./landingStoryModel";
import { useConnectedStoryCProgression } from "./useConnectedStoryCProgression";

export interface ConnectedStoryCCompactProgressiveProps {
  activeChapter: LandingWorkspaceStage;
  onChapterChange: (chapter: LandingWorkspaceStage) => void;
  onCapabilityFailure: () => void;
  onObserverGeneration?: (generation: number) => void;
  onPositionChange?: (chapter: LandingWorkspaceStage, localProgress: number) => void;
  observerEnabled?: boolean;
}

export function ConnectedStoryCCompactProgressive({
  activeChapter,
  onChapterChange,
  onCapabilityFailure,
  onObserverGeneration,
  onPositionChange,
  observerEnabled = true,
}: ConnectedStoryCCompactProgressiveProps) {
  const rootRef = useRef<HTMLElement>(null);
  const activeNarrative = landingScrollChapters.find((chapter) => chapter.stage === activeChapter)
    ?? landingScrollChapters[0];
  useConnectedStoryCProgression(rootRef, {
    enabled: observerEnabled,
    activeChapter,
    onChapterChange,
    onCapabilityFailure,
    onObserverGeneration,
    onPositionChange,
    ownershipLineRatio: connectedStoryCCompactConfiguration.ownershipLineRatio,
  });

  return (
    <section
      ref={rootRef}
      className="hf-connected-c-compact-progressive"
      style={connectedStoryCCompactCssVariables()}
      data-connected-c-presentation="compact-progressive"
      data-active-chapter={activeChapter}
    >
      <div className="hf-connected-c-compact-stage">
        <ol className="min-w-0" data-connected-c-semantic-track>
          {landingScrollChapters.map((chapter) => (
            <li
              key={chapter.stage}
              className="hf-connected-c-compact-chapter min-w-0"
              data-connected-chapter={chapter.stage}
              data-connected-c-semantic-chapter={chapter.stage}
            >
              <article className="sr-only" data-connected-c-semantic-copy>
                <ConnectedChapterNarrative chapter={chapter} />
              </article>
            </li>
          ))}
        </ol>
        <div
          aria-hidden="true"
          className="hf-connected-c-compact-sticky-owner min-w-0"
          data-connected-c-compact-sticky-owner
          inert
        >
          <div className="hf-connected-c-compact-sticky-scene" data-connected-c-compact-sticky-scene>
            <div
              key={activeNarrative.stage}
              className="hf-connected-c-compact-visual-narrative min-w-0"
              data-landing-clip-check
              data-connected-c-visual-narrative
              data-connected-visual-chapter={activeNarrative.stage}
            >
              <ConnectedChapterNarrative chapter={activeNarrative} visual />
            </div>
            <ConnectedStoryCCompactWorkspace activeChapter={activeChapter} />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="hf-connected-c-compact-release-tail" data-connected-c-compact-release-tail />
    </section>
  );
}
