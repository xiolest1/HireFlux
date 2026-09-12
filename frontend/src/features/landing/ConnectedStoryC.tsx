import { landingScrollChapters } from "./landingStoryModel";
import {
  ConnectedChapterNarrative,
  ConnectedEndpointVisual,
  ConnectedLineage,
  ConnectedNorthstarMark,
  ConnectedProductChrome,
} from "./ConnectedStoryPrimitives";

export function ConnectedStoryC() {
  return (
    <section data-connected-native-story="c">
      <ConnectedProductChrome>
        <div className="grid min-w-0 md:grid-cols-[9.5rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)]">
          <aside aria-hidden="true" className="hidden border-r border-line bg-surface/60 p-4 md:block">
            <div className="flex items-center gap-2"><ConnectedNorthstarMark small /><div><p className="text-[0.58rem] font-black text-ink dark:text-white">Northstar Labs</p><p className="text-[0.52rem] font-semibold text-ink-muted">One connected history</p></div></div>
            <ol className="mt-7 flex h-[calc(100%-4.5rem)] min-h-[52rem] flex-col justify-between border-l border-violet/30 pl-4">
              {landingScrollChapters.map((chapter) => <li key={chapter.stage} className="relative text-[0.56rem] font-black uppercase tracking-[0.08em] text-ink-muted"><span className="absolute -left-[1.2rem] top-1 size-2 rounded-full bg-violet" />{chapter.label}</li>)}
            </ol>
          </aside>
          <ol className="min-w-0 space-y-12 p-4 sm:p-6">
            {landingScrollChapters.map((chapter) => (
              <li key={chapter.stage} data-connected-chapter={chapter.stage}>
                <article className="min-w-0 border-t border-line pt-6" data-landing-clip-check>
                  <ConnectedChapterNarrative chapter={chapter} />
                  <div aria-hidden="true" className="mt-5 space-y-3">
                    {chapter.stage !== "applications" ? <ConnectedLineage stage={chapter.stage} /> : null}
                    <ConnectedEndpointVisual stage={chapter.stage} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </ConnectedProductChrome>
    </section>
  );
}
