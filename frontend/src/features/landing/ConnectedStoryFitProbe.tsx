import { landingScrollChapters } from "./landingStoryModel";
import { ConnectedChapterNarrative } from "./ConnectedStoryPrimitives";

export function ConnectedStoryFitProbe() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      data-connected-fit-probe
      inert
    >
      <div className="relative grid h-[min(43rem,100vh)] min-h-[40rem] grid-cols-[minmax(0,0.52fr)_minmax(0,1.18fr)] items-center gap-8 xl:grid-cols-[minmax(0,0.48fr)_minmax(0,1.22fr)] xl:gap-6" data-connected-j3-fit-stage>
        <div className="relative h-[31rem] min-w-0">
          <div className="absolute inset-0 grid">
            {landingScrollChapters.map((chapter) => (
              <div key={chapter.stage} className="col-start-1 row-start-1 overflow-hidden" data-connected-j3-fit-copy>
                <ConnectedChapterNarrative chapter={chapter} />
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex h-[36rem] min-w-0 items-center overflow-hidden p-1" data-connected-j3-fit-envelope>
          <div className="h-[32rem] w-full" data-connected-j3-fit-shell />
        </div>
      </div>
    </div>
  );
}
