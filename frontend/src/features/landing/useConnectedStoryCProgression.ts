import { useLayoutEffect, useRef } from "react";
import { connectedStoryCConfiguration } from "./connectedStoryCConfig";
import { connectedStoryCSemanticProgress, resolveConnectedStoryCChapter } from "./connectedStoryCGeometry";
import type { LandingWorkspaceStage } from "./landingStoryModel";

export interface ConnectedStoryCProgressionOptions {
  enabled: boolean;
  activeChapter: LandingWorkspaceStage;
  onChapterChange: (chapter: LandingWorkspaceStage) => void;
  onCapabilityFailure: () => void;
  onObserverGeneration?: (generation: number) => void;
  onPositionChange?: (chapter: LandingWorkspaceStage, localProgress: number) => void;
  ownershipLineRatio?: number;
}

export function useConnectedStoryCProgression(
  rootRef: React.RefObject<HTMLElement | null>,
  options: ConnectedStoryCProgressionOptions,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const generationRef = useRef(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!optionsRef.current.enabled) return;
    if (!root || typeof IntersectionObserver !== "function") {
      optionsRef.current.onCapabilityFailure();
      return;
    }
    const generation = ++generationRef.current;
    optionsRef.current.onObserverGeneration?.(generation);
    const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-connected-c-semantic-chapter]"));
    if (chapters.length !== 4) {
      optionsRef.current.onCapabilityFailure();
      return;
    }

    const resolve = () => {
      if (generationRef.current !== generation) return;
      const line = window.innerHeight * (optionsRef.current.ownershipLineRatio ?? 0.5);
      const geometry = chapters.map((chapter) => {
          const rect = chapter.getBoundingClientRect();
          return {
            stage: chapter.dataset.connectedCSemanticChapter as LandingWorkspaceStage,
            top: rect.top,
            bottom: rect.bottom,
          };
        });
      const stage = resolveConnectedStoryCChapter(
        geometry,
        line,
        connectedStoryCConfiguration.equalityEpsilonPx,
      );
      if (stage && stage !== optionsRef.current.activeChapter) {
        const chapterGeometry = geometry.find((chapter) => chapter.stage === stage);
        optionsRef.current.onChapterChange(stage);
        if (chapterGeometry) {
          optionsRef.current.onPositionChange?.(stage, connectedStoryCSemanticProgress(chapterGeometry, line));
        }
      }
    };

    let observer: IntersectionObserver;
    try {
      const halfBand = connectedStoryCConfiguration.observerBandPercent / 2;
      const ownershipLinePercent = (optionsRef.current.ownershipLineRatio ?? 0.5) * 100;
      observer = new IntersectionObserver(resolve, {
        root: null,
        rootMargin: `${-(ownershipLinePercent - halfBand)}% 0px ${-(100 - ownershipLinePercent - halfBand)}% 0px`,
        threshold: 0,
      });
      chapters.forEach((chapter) => observer.observe(chapter));
    } catch {
      optionsRef.current.onCapabilityFailure();
      return;
    }
    return () => {
      generationRef.current += 1;
      optionsRef.current.onObserverGeneration?.(generationRef.current);
      observer.disconnect();
    };
  }, [options.enabled, rootRef]);

  return { observerGeneration: generationRef.current };
}
