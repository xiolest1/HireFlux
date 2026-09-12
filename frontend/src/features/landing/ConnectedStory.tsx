import { useRef } from "react";
import { ConnectedStoryA } from "./ConnectedStoryA";
import { ConnectedStoryC } from "./ConnectedStoryC";
import { ConnectedStoryFitProbe } from "./ConnectedStoryFitProbe";
import { useConnectedStoryArchitecture } from "./useConnectedStoryArchitecture";

export function ConnectedStory() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { family, J3, activeChapter, setActiveChapter } = useConnectedStoryArchitecture(rootRef);

  return (
    <div
      ref={rootRef}
      className="relative mt-12 min-w-0 sm:mt-14 lg:mt-12"
      data-connected-story
      data-connected-family={family ?? "unresolved"}
      data-active-chapter={activeChapter}
      aria-busy={family === null || undefined}
    >
      <ConnectedStoryFitProbe />
      {family === null ? (
        <div aria-hidden="true" className="min-h-[48rem]" data-connected-unresolved-reservation />
      ) : (
        <div data-connected-family-owner={family}>
          {family === "j3" && J3 ? <J3 onChapterChange={setActiveChapter} /> : null}
          {family === "c" ? <ConnectedStoryC /> : null}
          {family === "a" ? <ConnectedStoryA /> : null}
        </div>
      )}
    </div>
  );
}
