import { connectedStoryCCompactCssVariables } from "./connectedStoryCConfig";
import { ConnectedStoryCCompactWorkspace } from "./ConnectedStoryCCompactWorkspace";
import { landingScrollChapters } from "./landingStoryModel";

export function ConnectedStoryCCompactFitProbe() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      data-connected-c-compact-fit-probe
      inert
      style={connectedStoryCCompactCssVariables()}
    >
      <div className="w-full" data-connected-c-compact-fit-stage>
        <div className="h-[var(--hf-connected-compact-shell-height)]" data-connected-c-compact-fit-envelope>
          {landingScrollChapters.map((chapter) => (
            <div key={chapter.stage} className="h-[var(--hf-connected-compact-shell-height)]" data-connected-c-compact-fit-endpoint={chapter.stage}>
              <ConnectedStoryCCompactWorkspace activeChapter={chapter.stage} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
