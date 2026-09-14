import { useRef } from "react";
import { connectedStoryCCssVariables } from "./connectedStoryCConfig";
import { ConnectedStoryCWorkspace } from "./ConnectedStoryCWorkspace";
import { ConnectedChapterNarrative } from "./ConnectedStoryPrimitives";
import { landingScrollChapters, type LandingWorkspaceStage } from "./landingStoryModel";
import { useConnectedStoryCProgression } from "./useConnectedStoryCProgression";

export interface ConnectedStoryCProgressiveProps {
  activeChapter: LandingWorkspaceStage;
  onChapterChange: (chapter: LandingWorkspaceStage) => void;
  onCapabilityFailure: () => void;
  onObserverGeneration?: (generation: number) => void;
  onPositionChange?: (chapter: LandingWorkspaceStage, localProgress: number) => void;
  observerEnabled?: boolean;
}

export function ConnectedStoryCProgressive({
  activeChapter,
  onChapterChange,
  onCapabilityFailure,
  onObserverGeneration,
  onPositionChange,
  observerEnabled = true,
}: ConnectedStoryCProgressiveProps) {
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
  });

  return (
    <section
      ref={rootRef}
      className="hf-connected-c-progressive"
      style={connectedStoryCCssVariables()}
      data-connected-c-presentation="progressive"
      data-active-chapter={activeChapter}
    >
      <div className="hf-connected-c-stage min-w-0" data-connected-c-stage>
        <ol className="min-w-0" data-connected-c-semantic-track>
          {landingScrollChapters.map((chapter) => (
            <li
              key={chapter.stage}
              className="hf-connected-c-chapter min-w-0"
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
          className="hf-connected-c-sticky-owner min-w-0"
          data-connected-c-sticky-owner
          inert
        >
          <div className="hf-connected-c-sticky-scene" data-connected-c-sticky-scene>
            <div
              key={activeNarrative.stage}
              className="hf-connected-c-visual-narrative min-w-0"
              data-landing-clip-check
              data-connected-c-visual-narrative
              data-connected-visual-chapter={activeNarrative.stage}
            >
              <ConnectedChapterNarrative chapter={activeNarrative} visual />
            </div>
            <ConnectedStoryCWorkspace activeChapter={activeChapter} />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="hf-connected-c-release-tail" data-connected-c-release-tail />
    </section>
  );
}
