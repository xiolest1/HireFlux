import { landingScrollChapters, type LandingWorkspaceStage } from "./landingStoryModel";
import {
  ConnectedEndpointVisual,
  ConnectedLineage,
  ConnectedNorthstarMark,
  ConnectedProductChrome,
} from "./ConnectedStoryPrimitives";

export function ConnectedStoryCWorkspace({ activeChapter }: { activeChapter: LandingWorkspaceStage }) {
  return (
    <div
      aria-hidden="true"
      className="hf-connected-c-workspace"
      data-connected-c-workspace
      data-connected-visual-chapter={activeChapter}
      inert
    >
      <ConnectedProductChrome>
        <div className="grid h-full min-w-0 grid-cols-[8.75rem_minmax(0,1fr)]">
          <aside className="border-r border-line bg-surface/60 p-3">
            <div className="flex items-center gap-2"><ConnectedNorthstarMark small /><div><p className="text-[0.56rem] font-black text-ink dark:text-white">Northstar Labs</p><p className="text-[0.48rem] font-semibold text-ink-muted">One connected history</p></div></div>
            <ol className="mt-6 space-y-5 border-l border-violet/30 pl-3" data-connected-c-progress>
              {landingScrollChapters.map((chapter) => (
                <li
                  key={chapter.stage}
                  className="relative text-[0.52rem] font-black uppercase tracking-[0.08em] text-ink-muted"
                  data-connected-c-progress-item={chapter.stage}
                  data-active={chapter.stage === activeChapter || undefined}
                >
                  <span className="absolute -left-[0.96rem] top-1 size-1.5 rounded-full bg-line-strong" />
                  {chapter.label}
                </li>
              ))}
            </ol>
          </aside>
          <div className="relative min-w-0 overflow-hidden p-4" data-connected-c-endpoints>
            {landingScrollChapters.map((chapter) => (
              <div
                key={chapter.stage}
                className="hf-connected-c-endpoint absolute inset-4"
                data-connected-c-endpoint={chapter.stage}
                data-active={chapter.stage === activeChapter || undefined}
              >
                <div className="space-y-3">
                  {chapter.stage !== "applications" ? <ConnectedLineage stage={chapter.stage} /> : null}
                  <ConnectedEndpointVisual stage={chapter.stage} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ConnectedProductChrome>
    </div>
  );
}
