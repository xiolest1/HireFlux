import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "../../../components/ui/motionHooks";

export type BenefitsStreamMode = "ambient" | "paused" | "manual" | "static";
export type BenefitsStreamDirection = "previous" | "next";

export const benefitStreamPixelsPerSecond = 28;
export const benefitStreamVisibilityThreshold = 0.5;
export const benefitStreamManualDurationMs = 360;
export const benefitStreamTieEpsilonPixels = 0.25;

export interface BenefitSignalPoint {
  logicalIndex: number;
  streamIndex: number;
  point: number;
  cycle: number;
}

export interface ResolvedBenefitSignal {
  logicalIndex: number;
  streamIndex: number;
  cycle: number;
}

export interface ResolvedBenefitManualDestination extends ResolvedBenefitSignal {
  destinationIndex: number;
}

interface BenefitsStreamGeometry {
  anchor: number;
  distance: number;
  duration: number;
  signalPoints: number[];
}

/**
 * Signals compare their leading border edge with the viewport's stable leading
 * content inset. Ties within the practical sub-pixel epsilon always resolve to
 * the later rendered signal in stream order.
 */
export function resolveNearestBenefitSignal(
  anchor: number,
  candidates: readonly BenefitSignalPoint[],
  tieEpsilon = benefitStreamTieEpsilonPixels,
): ResolvedBenefitSignal {
  if (candidates.length === 0) {
    throw new Error("At least one benefit signal point is required");
  }

  return candidates.slice(1).reduce<BenefitSignalPoint>((best, candidate) => {
    const bestDistance = Math.abs(best.point - anchor);
    const candidateDistance = Math.abs(candidate.point - anchor);
    if (candidateDistance < bestDistance - tieEpsilon) return candidate;
    if (
      Math.abs(candidateDistance - bestDistance) <= tieEpsilon
      && candidate.streamIndex > best.streamIndex
    ) {
      return candidate;
    }
    return best;
  }, candidates[0]);
}

export function normalizeBenefitLoopOffset(offset: number, distance: number) {
  if (distance <= 0) return 0;
  const remainder = offset % distance;
  if (Math.abs(remainder) <= 0.001 || Math.abs(Math.abs(remainder) - distance) <= 0.001) {
    return 0;
  }
  return remainder > 0 ? remainder - distance : remainder;
}

export function resolveBenefitManualDestination(
  anchor: number,
  candidates: readonly BenefitSignalPoint[],
  direction: BenefitsStreamDirection,
  signalCount: number,
): ResolvedBenefitManualDestination {
  const resolved = resolveNearestBenefitSignal(anchor, candidates);
  return {
    logicalIndex: resolved.logicalIndex,
    streamIndex: resolved.streamIndex,
    cycle: resolved.cycle,
    destinationIndex: direction === "next"
      ? (resolved.logicalIndex + 1) % signalCount
      : (resolved.logicalIndex - 1 + signalCount) % signalCount,
  };
}

function translateX(element: HTMLElement) {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;
  if (typeof DOMMatrixReadOnly !== "undefined") {
    return new DOMMatrixReadOnly(transform).m41;
  }
  const values = transform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1].split(",").map(Number);
  if (!values) return 0;
  return values.length === 16 ? values[12] : values[4] ?? 0;
}

function transformValue(offset: number) {
  return `translate3d(${offset}px, 0, 0)`;
}

export function useBenefitsStream(signalCount: number) {
  const reducedMotion = useReducedMotion();
  const [controllerMode, setControllerMode] = useState<Exclude<BenefitsStreamMode, "static">>("ambient");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [passivelyBlocked, setPassivelyBlocked] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const realGroupRef = useRef<HTMLOListElement | null>(null);
  const geometryRef = useRef<BenefitsStreamGeometry | null>(null);
  const modeRef = useRef<BenefitsStreamMode>(reducedMotion ? "static" : controllerMode);
  const currentIndexRef = useRef<number | null>(null);
  const transitionRef = useRef(false);
  const transitionTokenRef = useRef(0);
  const manualAnimationRef = useRef<Animation | null>(null);
  const intersectingRef = useRef(true);
  const documentVisibleRef = useRef(
    typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const focusWithinRef = useRef(false);
  const focusPlayOverrideRef = useRef(false);

  const mode: BenefitsStreamMode = reducedMotion ? "static" : controllerMode;
  modeRef.current = mode;
  currentIndexRef.current = currentIndex;

  const updatePassiveState = useCallback(() => {
    const blocked = !intersectingRef.current
      || !documentVisibleRef.current
      || (focusWithinRef.current && !focusPlayOverrideRef.current);
    setPassivelyBlocked((current) => current === blocked ? current : blocked);
  }, []);

  const setMode = useCallback((nextMode: Exclude<BenefitsStreamMode, "static">) => {
    modeRef.current = nextMode;
    const track = trackRef.current;
    if (track) track.dataset.motionState = nextMode;
    setControllerMode(nextMode);
  }, []);

  const finishTransition = useCallback((token: number) => {
    if (token !== transitionTokenRef.current) return;
    transitionRef.current = false;
    manualAnimationRef.current = null;
    setIsTransitioning(false);
  }, []);

  useLayoutEffect(() => {
    const realGroup = realGroupRef.current;
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!realGroup || !track || !viewport) return;

    if (reducedMotion) {
      const transitionToken = transitionTokenRef.current;
      manualAnimationRef.current?.cancel();
      finishTransition(transitionToken);
      transitionTokenRef.current += 1;
      track.style.removeProperty("transform");
      track.style.removeProperty("--hf-benefits-loop-distance");
      track.style.removeProperty("--hf-benefits-loop-translation");
      track.style.removeProperty("--hf-benefits-loop-duration");
      track.style.removeProperty("--hf-benefits-loop-delay");
      delete track.dataset.loopDistance;
      delete track.dataset.loopDuration;
      delete track.dataset.motionReady;
      geometryRef.current = null;
      return;
    }

    const measure = () => {
      const distance = realGroup.getBoundingClientRect().width;
      if (distance <= 0) return;
      const previousGeometry = geometryRef.current;
      const previousOffset = previousGeometry ? translateX(track) : 0;
      const trackRect = track.getBoundingClientRect();
      const anchor = realGroup.getBoundingClientRect().left - trackRect.left;
      const signalPoints = Array.from(realGroup.children)
        .slice(0, signalCount)
        .map((item) => (item as HTMLElement).getBoundingClientRect().left - trackRect.left);
      const duration = distance / benefitStreamPixelsPerSecond;
      const geometry = { anchor, distance, duration, signalPoints };

      track.style.setProperty("--hf-benefits-loop-distance", `${distance}px`);
      track.style.setProperty("--hf-benefits-loop-translation", `${-distance}px`);
      track.style.setProperty("--hf-benefits-loop-duration", `${duration}s`);
      track.dataset.loopDistance = distance.toFixed(3);
      track.dataset.loopDuration = duration.toFixed(3);
      track.dataset.motionReady = "true";
      geometryRef.current = geometry;

      if (!previousGeometry || Math.abs(previousGeometry.distance - distance) <= 0.25) return;

      if (modeRef.current === "manual" && currentIndexRef.current !== null) {
        const target = anchor - signalPoints[currentIndexRef.current];
        const transitionToken = transitionTokenRef.current;
        const wasTransitioning = transitionRef.current;
        manualAnimationRef.current?.cancel();
        track.style.transform = transformValue(target);
        if (wasTransitioning) finishTransition(transitionToken);
        return;
      }

      if (modeRef.current === "ambient" || modeRef.current === "paused") {
        const oldOffset = normalizeBenefitLoopOffset(previousOffset, previousGeometry.distance);
        const progress = Math.abs(oldOffset) / previousGeometry.distance;
        const newOffset = -progress * distance;
        track.style.transform = transformValue(newOffset);
        track.dataset.motionState = "manual";
        void track.offsetWidth;
        track.style.setProperty(
          "--hf-benefits-loop-delay",
          `${normalizeBenefitLoopOffset(newOffset, distance) / benefitStreamPixelsPerSecond}s`,
        );
        track.dataset.motionState = modeRef.current;
        track.style.removeProperty("transform");
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(realGroup);
    return () => observer.disconnect();
  }, [finishTransition, reducedMotion, signalCount]);

  useEffect(() => {
    const root = rootRef.current;
    if (reducedMotion || !root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersectingRef.current = Boolean(
          entry?.isIntersecting && entry.intersectionRatio >= benefitStreamVisibilityThreshold,
        );
        updatePassiveState();
      },
      { threshold: benefitStreamVisibilityThreshold },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [reducedMotion, updatePassiveState]);

  useEffect(() => {
    if (reducedMotion) return;
    const handleVisibility = () => {
      documentVisibleRef.current = document.visibilityState !== "hidden";
      updatePassiveState();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [reducedMotion, updatePassiveState]);

  useEffect(() => {
    const root = rootRef.current;
    if (reducedMotion || !root) return;
    const handleFocusIn = (event: FocusEvent) => {
      focusWithinRef.current = true;
      const control = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-benefits-control]");
      if (control?.dataset.benefitsControl !== "play-pause") {
        focusPlayOverrideRef.current = false;
      }
      updatePassiveState();
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (root.contains(event.relatedTarget as Node | null)) return;
      focusWithinRef.current = false;
      focusPlayOverrideRef.current = false;
      updatePassiveState();
    };
    root.addEventListener("focusin", handleFocusIn);
    root.addEventListener("focusout", handleFocusOut);
    return () => {
      root.removeEventListener("focusin", handleFocusIn);
      root.removeEventListener("focusout", handleFocusOut);
    };
  }, [reducedMotion, updatePassiveState]);

  useEffect(() => () => {
    transitionTokenRef.current += 1;
    manualAnimationRef.current?.cancel();
    manualAnimationRef.current = null;
  }, []);

  const pause = useCallback(() => {
    if (reducedMotion || modeRef.current !== "ambient") return;
    focusPlayOverrideRef.current = false;
    setMode("paused");
    updatePassiveState();
  }, [reducedMotion, setMode, updatePassiveState]);

  const play = useCallback(() => {
    if (reducedMotion || transitionRef.current) return;
    const track = trackRef.current;
    if (!track) return;

    focusPlayOverrideRef.current = true;
    updatePassiveState();
    if (modeRef.current === "manual") {
      const geometry = geometryRef.current;
      if (!geometry) return;
      const currentOffset = translateX(track);
      const normalizedOffset = normalizeBenefitLoopOffset(currentOffset, geometry.distance);
      track.style.setProperty(
        "--hf-benefits-loop-delay",
        `${normalizedOffset / benefitStreamPixelsPerSecond}s`,
      );
      track.dataset.motionState = "ambient";
      track.style.removeProperty("transform");
    }
    setMode("ambient");
  }, [reducedMotion, setMode, updatePassiveState]);

  const move = useCallback((direction: BenefitsStreamDirection) => {
    if (reducedMotion || transitionRef.current) return;
    const track = trackRef.current;
    const geometry = geometryRef.current;
    if (!track || !geometry || geometry.signalPoints.length !== signalCount) return;

    const offset = translateX(track);
    const candidates = [0, 1].flatMap((cycle) => geometry.signalPoints.map((point, logicalIndex) => ({
      logicalIndex,
      streamIndex: cycle * signalCount + logicalIndex,
      point: point + cycle * geometry.distance + offset,
      cycle,
    })));
    const resolved = resolveBenefitManualDestination(
      geometry.anchor,
      candidates,
      direction,
      signalCount,
    );
    let startOffset = offset;
    let destinationIndex: number;
    let destinationOffset: number;

    if (direction === "next") {
      if (resolved.cycle > 0) startOffset += geometry.distance;
      destinationIndex = resolved.destinationIndex;
      destinationOffset = geometry.anchor - geometry.signalPoints[destinationIndex];
      if (resolved.logicalIndex === signalCount - 1) destinationOffset -= geometry.distance;
    } else {
      if (resolved.logicalIndex === 0 && resolved.cycle === 0) {
        startOffset -= geometry.distance;
      } else if (resolved.logicalIndex !== 0 && resolved.cycle > 0) {
        startOffset += geometry.distance;
      }
      destinationIndex = resolved.destinationIndex;
      destinationOffset = geometry.anchor - geometry.signalPoints[destinationIndex];
    }

    const token = transitionTokenRef.current + 1;
    transitionTokenRef.current = token;
    transitionRef.current = true;
    setIsTransitioning(true);
    setCurrentIndex(destinationIndex);
    currentIndexRef.current = destinationIndex;
    track.style.transform = transformValue(startOffset);
    track.dataset.motionState = "manual";
    setMode("manual");

    const settle = () => {
      if (token !== transitionTokenRef.current) return;
      track.style.transform = transformValue(destinationOffset);
      manualAnimationRef.current?.cancel();
      finishTransition(token);
    };

    if (typeof track.animate !== "function") {
      settle();
      return;
    }

    const animation = track.animate(
      [
        { transform: transformValue(startOffset) },
        { transform: transformValue(destinationOffset) },
      ],
      {
        duration: benefitStreamManualDurationMs,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );
    manualAnimationRef.current = animation;
    void animation.finished.then(settle).catch(() => finishTransition(token));
  }, [finishTransition, reducedMotion, setMode, signalCount]);

  return {
    rootRef,
    viewportRef,
    trackRef,
    realGroupRef,
    mode,
    currentIndex,
    isTransitioning,
    passivelyBlocked,
    pause,
    play,
    previous: () => move("previous"),
    next: () => move("next"),
  };
}
