import { landingScrollChapters } from "./landingStoryModel";
import {
  ConnectedChapterNarrative,
  ConnectedEndpointVisual,
  ConnectedLineage,
} from "./ConnectedStoryPrimitives";

export function ConnectedStoryA() {
  return (
    <ol className="mx-auto max-w-3xl space-y-12" data-connected-native-story="a">
      {landingScrollChapters.map((chapter) => (
        <li key={chapter.stage} data-connected-chapter={chapter.stage}>
          <article className="border-t border-line pt-6" data-landing-clip-check>
            <ConnectedChapterNarrative chapter={chapter} />
            <div aria-hidden="true" className="mt-5 space-y-3">
              {chapter.stage !== "applications" ? <ConnectedLineage stage={chapter.stage} /> : null}
              <ConnectedEndpointVisual stage={chapter.stage} />
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
