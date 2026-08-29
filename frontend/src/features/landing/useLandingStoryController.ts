import { useCallback, useEffect, useState } from "react";
import {
  landingHeroAutoplayStageOrder,
  landingHeroStageOrder,
  type LandingHeroStage,
} from "./landingStoryModel";

export type LandingStoryPlaybackMode =
  | "autoplay"
  | "paused"
  | "manual"
  | "complete"
  | "reduced";

interface LandingStoryControllerState {
  currentStage: LandingHeroStage;
  playbackMode: LandingStoryPlaybackMode;
}

const STORY_DURATION_MS = 3_000;
const firstStage = landingHeroAutoplayStageOrder[0];
const autoplayFinalStage = landingHeroAutoplayStageOrder.at(-1) ?? "prepare";
const reducedMotionStage = landingHeroStageOrder.at(-1) ?? "act";

function advanceState(
  state: LandingStoryControllerState,
): LandingStoryControllerState {
  if (state.playbackMode !== "autoplay") return state;
  const currentIndex = landingHeroAutoplayStageOrder.findIndex(
    (stage) => stage === state.currentStage,
  );
  const nextStage = landingHeroAutoplayStageOrder[currentIndex + 1];
  if (!nextStage) return { ...state, playbackMode: "complete" };
  return {
    currentStage: nextStage,
    playbackMode: nextStage === autoplayFinalStage ? "complete" : "autoplay",
  };
}

export function useLandingStoryController(reducedMotion: boolean) {
  const [state, setState] = useState<LandingStoryControllerState>(() =>
    reducedMotion
      ? { currentStage: reducedMotionStage, playbackMode: "reduced" }
      : { currentStage: firstStage, playbackMode: "autoplay" },
  );

  useEffect(() => {
    setState((current) => {
      if (reducedMotion) {
        if (
          current.playbackMode === "reduced" &&
          current.currentStage === reducedMotionStage
        ) return current;
        return { currentStage: reducedMotionStage, playbackMode: "reduced" };
      }
      if (current.playbackMode === "reduced") {
        return { currentStage: reducedMotionStage, playbackMode: "complete" };
      }
      return current;
    });
  }, [reducedMotion]);

  useEffect(() => {
    if (state.playbackMode !== "autoplay") return;
    const timer = window.setTimeout(() => {
      setState((current) => advanceState(current));
    }, STORY_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [state.currentStage, state.playbackMode]);

  const advance = useCallback(() => {
    setState((current) => advanceState(current));
  }, []);

  const selectStage = useCallback((stage: LandingHeroStage) => {
    setState((current) => ({
      currentStage: stage,
      playbackMode: current.playbackMode === "reduced" ? "reduced" : "manual",
    }));
  }, []);

  const pause = useCallback(() => {
    setState((current) =>
      current.playbackMode === "autoplay"
        ? { ...current, playbackMode: "paused" }
        : current,
    );
  }, []);

  const play = useCallback(() => {
    setState((current) => {
      if (
        current.playbackMode === "reduced" ||
        !landingHeroAutoplayStageOrder.includes(
          current.currentStage as (typeof landingHeroAutoplayStageOrder)[number],
        ) ||
        current.currentStage === autoplayFinalStage
      ) return current;
      return { ...current, playbackMode: "autoplay" };
    });
  }, []);

  const replay = useCallback(() => {
    setState((current) => ({
      currentStage: firstStage,
      playbackMode: current.playbackMode === "reduced" ? "reduced" : "autoplay",
    }));
  }, []);

  return {
    ...state,
    advance,
    selectStage,
    pause,
    play,
    replay,
  };
}
