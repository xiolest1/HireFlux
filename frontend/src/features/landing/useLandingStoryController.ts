import { useCallback, useEffect, useState } from "react";
import {
  landingHeroAutoplayStageOrder,
  type LandingAdvancedHeroStage,
  type LandingHeroStage,
} from "./landingStoryModel";

export type LandingStoryPlaybackMode =
  | "autoplay"
  | "paused"
  | "manual"
  | "complete"
  | "reduced";

interface LandingStoryControllerState {
  currentScene: LandingAdvancedHeroStage;
  playbackMode: LandingStoryPlaybackMode;
}

const STORY_DURATION_MS: Record<LandingAdvancedHeroStage, number> = {
  capture: 2_800,
  context: 2_200,
  progress: 3_000,
  prepare: 3_300,
  resolve: 2_500,
  act: 0,
};
const firstStage = landingHeroAutoplayStageOrder[0];
const autoplayFinalStage = landingHeroAutoplayStageOrder.at(-1) ?? "act";
const reducedMotionStage = "act" as const;

const milestoneForScene: Record<LandingAdvancedHeroStage, LandingHeroStage> = {
  capture: "capture",
  context: "capture",
  progress: "progress",
  prepare: "prepare",
  resolve: "prepare",
  act: "act",
};

function advanceState(
  state: LandingStoryControllerState,
): LandingStoryControllerState {
  if (state.playbackMode !== "autoplay") return state;
  const currentIndex = landingHeroAutoplayStageOrder.findIndex(
    (stage) => stage === state.currentScene,
  );
  const nextStage = landingHeroAutoplayStageOrder[currentIndex + 1];
  if (!nextStage) return { ...state, playbackMode: "complete" };
  return {
    currentScene: nextStage,
    playbackMode: nextStage === autoplayFinalStage ? "complete" : "autoplay",
  };
}

export function useLandingStoryController(reducedMotion: boolean) {
  const [state, setState] = useState<LandingStoryControllerState>(() =>
    reducedMotion
      ? { currentScene: reducedMotionStage, playbackMode: "reduced" }
      : { currentScene: firstStage, playbackMode: "autoplay" },
  );

  useEffect(() => {
    setState((current) => {
      if (reducedMotion) {
        if (
          current.playbackMode === "reduced" &&
          current.currentScene === reducedMotionStage
        ) return current;
        return { currentScene: reducedMotionStage, playbackMode: "reduced" };
      }
      if (current.playbackMode === "reduced") {
        return { currentScene: reducedMotionStage, playbackMode: "complete" };
      }
      return current;
    });
  }, [reducedMotion]);

  useEffect(() => {
    if (state.playbackMode !== "autoplay") return;
    const timer = window.setTimeout(() => {
      setState((current) => advanceState(current));
    }, STORY_DURATION_MS[state.currentScene]);
    return () => window.clearTimeout(timer);
  }, [state.currentScene, state.playbackMode]);

  const advance = useCallback(() => {
    setState((current) => advanceState(current));
  }, []);

  const selectStage = useCallback((stage: LandingHeroStage) => {
    setState((current) => ({
      currentScene: stage,
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
        current.currentScene === autoplayFinalStage
      ) return current;
      return { ...current, playbackMode: "autoplay" };
    });
  }, []);

  const replay = useCallback(() => {
    setState((current) => ({
      currentScene: firstStage,
      playbackMode: current.playbackMode === "reduced" ? "reduced" : "autoplay",
    }));
  }, []);

  return {
    ...state,
    currentStage: milestoneForScene[state.currentScene],
    advance,
    selectStage,
    pause,
    play,
    replay,
  };
}
