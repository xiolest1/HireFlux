import { useRef } from "react";
import { ConnectedStoryA } from "./ConnectedStoryA";
import { ConnectedStoryC } from "./ConnectedStoryC";
import { ConnectedStoryFitProbe } from "./ConnectedStoryFitProbe";
import { ConnectedStoryCProgressiveFitProbe } from "./ConnectedStoryCProgressiveFitProbe";
import { useConnectedStoryArchitecture } from "./useConnectedStoryArchitecture";

export function ConnectedStory() {
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    family,
    cPresentation,
    J3,
    activeChapter,
    setActiveChapter,
    reportProgressiveCapabilityFailure,
    reportProgressiveObserverGeneration,
    reportProgressivePosition,
    presentationSettled,
  } = useConnectedStoryArchitecture(rootRef);

  return (
    <div
      ref={rootRef}
      className="relative mt-12 min-w-0 sm:mt-14 lg:mt-12"
      data-connected-story
      data-connected-family={family ?? "unresolved"}
      data-connected-c-presentation={cPresentation ?? "none"}
      data-active-chapter={activeChapter}
      aria-busy={family === null || undefined}
    >
      <ConnectedStoryFitProbe />
      <ConnectedStoryCProgressiveFitProbe />
      {family === null ? (
        <div aria-hidden="true" className="min-h-[48rem]" data-connected-unresolved-reservation />
      ) : (
        <div data-connected-family-owner={family}>
          {family === "j3" && J3 ? <J3 onChapterChange={setActiveChapter} /> : null}
          {family === "c" && cPresentation ? (
            <ConnectedStoryC
              presentation={cPresentation}
              activeChapter={activeChapter}
              onChapterChange={setActiveChapter}
              onCapabilityFailure={reportProgressiveCapabilityFailure}
              onObserverGeneration={reportProgressiveObserverGeneration}
              onPositionChange={reportProgressivePosition}
              observerEnabled={presentationSettled}
            />
          ) : null}
          {family === "a" ? <ConnectedStoryA /> : null}
        </div>
      )}
    </div>
  );
}
