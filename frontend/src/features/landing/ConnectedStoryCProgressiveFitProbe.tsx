import { connectedStoryCCssVariables } from "./connectedStoryCConfig";
import { ConnectedStoryCWorkspace } from "./ConnectedStoryCWorkspace";
import { landingScrollChapters } from "./landingStoryModel";

export function ConnectedStoryCProgressiveFitProbe() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      data-connected-c-fit-probe
      inert
      style={connectedStoryCCssVariables()}
    >
      <div className="grid w-full grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] gap-6" data-connected-c-fit-stage>
        <div data-connected-c-fit-narrative>
          {landingScrollChapters.map((chapter) => <p key={chapter.stage}>{chapter.title}</p>)}
        </div>
        <div className="h-[var(--hf-connected-c-shell-height)]" data-connected-c-fit-envelope>
          {landingScrollChapters.map((chapter) => (
            <div key={chapter.stage} data-connected-c-fit-endpoint={chapter.stage}>
              <ConnectedStoryCWorkspace activeChapter={chapter.stage} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
