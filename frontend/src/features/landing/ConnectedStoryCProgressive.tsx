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
      <div className="grid min-w-0 grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] gap-6">
        <ol className="min-w-0" data-connected-c-semantic-track>
          {landingScrollChapters.map((chapter) => (
            <li
              key={chapter.stage}
              className="hf-connected-c-chapter flex min-w-0 items-center"
              data-connected-chapter={chapter.stage}
              data-connected-c-semantic-chapter={chapter.stage}
            >
              <article className="min-w-0 border-t border-line pt-6" data-landing-clip-check>
                <ConnectedChapterNarrative chapter={chapter} />
              </article>
            </li>
          ))}
        </ol>
        <div className="hf-connected-c-sticky-column min-w-0" data-connected-c-sticky-column>
          <ConnectedStoryCWorkspace activeChapter={activeChapter} />
        </div>
      </div>
      <div aria-hidden="true" className="hf-connected-c-release-tail" data-connected-c-release-tail />
    </section>
  );
}
