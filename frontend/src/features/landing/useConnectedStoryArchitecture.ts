import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import {
  connectedStoryCheckpointNamespace,
  connectedStoryPredicates,
  correctionIsEligible,
  createConnectedStoryCheckpoint,
  isCCapable,
  isJ3CapacityEligible,
  j3ProgressForSemanticPosition,
  selectConnectedStoryFamily,
  semanticPositionForJ3Progress,
  validateConnectedStoryCheckpoint,
  type ConnectedStoryEnvironment,
  type ConnectedStoryFamily,
  type ConnectedStoryPosition,
  type ReconciliationGuard,
} from "./connectedStoryReconciliation";
import { connectedJ3PreflightFits } from "./connectedStoryFit";
import type { LandingWorkspaceStage } from "./landingStoryModel";
import { scrollStoryTravelViewportHeights } from "./scrollStoryConfig";

type J3Component = ComponentType<{
  onChapterChange?: (chapter: LandingWorkspaceStage) => void;
}>;

interface J3Module {
  ConnectedStoryJ3: J3Component;
}

interface PendingReconciliation {
  family: ConnectedStoryFamily;
  position: ConnectedStoryPosition | null;
  guard: ReconciliationGuard;
  corrected: boolean;
  frames: number[];
}

interface RuntimeOptions {
  loadJ3?: () => Promise<J3Module>;
  fontReadinessBoundMs?: number;
  j3LoadBoundMs?: number;
}

let cachedJ3Module: J3Module | null = null;
let pendingJ3Module: Promise<J3Module> | null = null;

export function resetConnectedStoryModuleForTests() {
  cachedJ3Module = null;
  pendingJ3Module = null;
}

function defaultLoadJ3() {
  pendingJ3Module ??= import("./ConnectedStoryJ3")
    .then((module) => {
      cachedJ3Module = module;
      return module;
    })
    .catch((error: unknown) => {
      pendingJ3Module = null;
      throw error;
    });
  return pendingJ3Module;
}

function absoluteTop(element: Element) {
  return element.getBoundingClientRect().top + window.scrollY;
}

function readingLine() {
  return window.innerHeight / 3;
}

function currentCodaPosition(): ConnectedStoryPosition | null {
  const coda = document.querySelector<HTMLElement>("[data-quiet-coda]");
  if (!coda || coda.getBoundingClientRect().top > window.innerHeight / 2) return null;
  return {
    chapter: "post-story",
    localProgress: 1,
    codaProgress: Math.max(0, Math.min(1, (readingLine() - coda.getBoundingClientRect().top) / Math.max(1, coda.offsetHeight))),
  };
}

export function captureConnectedStoryPosition(
  root: HTMLElement,
  family: ConnectedStoryFamily,
): ConnectedStoryPosition {
  const coda = currentCodaPosition();
  if (coda) return coda;
  if (root.getBoundingClientRect().top > readingLine()) {
    return { chapter: "pre-story", localProgress: 0, codaProgress: 0 };
  }
  if (family === "j3") {
    const progress = Number(root.querySelector<HTMLElement>("[data-connected-j3]")?.dataset.connectedProgress ?? 0);
    return semanticPositionForJ3Progress(progress);
  }
  const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-connected-chapter]"));
  if (chapters.length === 0) return { chapter: "pre-story", localProgress: 0, codaProgress: 0 };
  let index = 0;
  chapters.forEach((chapter, candidate) => {
    if (chapter.getBoundingClientRect().top <= readingLine()) index = candidate;
  });
  const currentTop = chapters[index].getBoundingClientRect().top;
  const nextTop = chapters[index + 1]?.getBoundingClientRect().top ?? root.getBoundingClientRect().bottom;
  return {
    chapter: chapters[index].dataset.connectedChapter as LandingWorkspaceStage,
    localProgress: Math.max(0, Math.min(1, (readingLine() - currentTop) / Math.max(1, nextTop - currentTop))),
    codaProgress: 0,
  };
}

function destinationForPosition(
  root: HTMLElement,
  family: ConnectedStoryFamily,
  position: ConnectedStoryPosition,
) {
  if (position.chapter === "pre-story") return null;
  if (position.chapter === "post-story") {
    const coda = document.querySelector<HTMLElement>("[data-quiet-coda]");
    return coda
      ? absoluteTop(coda) + position.codaProgress * coda.offsetHeight - readingLine()
      : null;
  }
  if (family === "j3") {
    const pin = root.querySelector<HTMLElement>("[data-scroll-story-pin]");
    const spacer = pin?.parentElement?.classList.contains("pin-spacer") ? pin.parentElement : null;
    if (!spacer) return null;
    return absoluteTop(spacer)
      + j3ProgressForSemanticPosition(position) * window.innerHeight * scrollStoryTravelViewportHeights;
  }
  const chapter = root.querySelector<HTMLElement>(`[data-connected-chapter="${position.chapter}"]`);
  if (!chapter) return null;
  const next = chapter.parentElement?.nextElementSibling?.querySelector<HTMLElement>("[data-connected-chapter]")
    ?? chapter.nextElementSibling as HTMLElement | null;
  const currentTop = absoluteTop(chapter);
  const nextTop = next ? absoluteTop(next) : absoluteTop(root) + root.offsetHeight;
  return currentTop + position.localProgress * Math.max(1, nextTop - currentTop) - readingLine();
}

function destinationRangeForChapter(
  root: HTMLElement,
  family: ConnectedStoryFamily,
  position: ConnectedStoryPosition,
) {
  if (position.chapter === "pre-story" || position.chapter === "post-story") return null;
  const start = destinationForPosition(root, family, { ...position, localProgress: 0.02 });
  const end = destinationForPosition(root, family, { ...position, localProgress: 0.98 });
  return start === null || end === null
    ? null
    : [Math.min(start, end), Math.max(start, end)] as const;
}

function currentGuard(
  environmentRevision: RefObject<number>,
  transitionRevision: RefObject<number>,
  intentRevision: RefObject<number>,
  targetFamily: RefObject<ConnectedStoryFamily>,
): ReconciliationGuard {
  return {
    environmentRevision: environmentRevision.current,
    transitionRevision: transitionRevision.current,
    intentRevision: intentRevision.current,
    targetFamily: targetFamily.current,
  };
}

function readCheckpoint() {
  const state = window.history.state as Record<string, unknown> | null;
  return validateConnectedStoryCheckpoint(state?.[connectedStoryCheckpointNamespace]);
}

function writeCheckpoint(position: ConnectedStoryPosition) {
  const state = window.history.state;
  const current = state && typeof state === "object" ? state as Record<string, unknown> : {};
  window.history.replaceState({
    ...current,
    [connectedStoryCheckpointNamespace]: createConnectedStoryCheckpoint(position),
  }, "");
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function useConnectedStoryArchitecture(
  rootRef: RefObject<HTMLDivElement | null>,
  options: RuntimeOptions = {},
) {
  const [family, setFamily] = useState<ConnectedStoryFamily | null>(null);
  const [J3, setJ3] = useState<J3Component | null>(() => cachedJ3Module?.ConnectedStoryJ3 ?? null);
  const [activeChapter, setActiveChapter] = useState<LandingWorkspaceStage>("applications");
  const familyRef = useRef<ConnectedStoryFamily | null>(null);
  const targetFamilyRef = useRef<ConnectedStoryFamily>("a");
  const environmentRevisionRef = useRef(0);
  const transitionRevisionRef = useRef(0);
  const intentRevisionRef = useRef(0);
  const pendingRef = useRef<PendingReconciliation | null>(null);
  const evaluationFrameRef = useRef<number | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const loadTimerRef = useRef<number | null>(null);
  const fontsReadyRef = useRef(false);
  const j3RetryBlockedRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const loadJ3 = options.loadJ3 ?? defaultLoadJ3;
    const fontBound = options.fontReadinessBoundMs ?? connectedStoryPredicates.fontReadinessBoundMs;
    const loadBound = options.j3LoadBoundMs ?? connectedStoryPredicates.j3LoadBoundMs;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;
    let initialized = false;
    let touchStartY: number | null = null;
    let fontTimer = 0;

    const capture = () => familyRef.current
      ? captureConnectedStoryPosition(root, familyRef.current)
      : readCheckpoint();

    const commit = (nextFamily: ConnectedStoryFamily, position: ConnectedStoryPosition | null) => {
      if (!active || familyRef.current === nextFamily) return;
      transitionRevisionRef.current += 1;
      targetFamilyRef.current = nextFamily;
      const guard = currentGuard(environmentRevisionRef, transitionRevisionRef, intentRevisionRef, targetFamilyRef);
      pendingRef.current?.frames.forEach(cancelAnimationFrame);
      pendingRef.current = { family: nextFamily, position, guard, corrected: false, frames: [] };
      familyRef.current = nextFamily;
      root.dataset.connectedTransition = "preparing";
      setFamily(nextFamily);
    };

    const readEnvironment = (revision: number): ConnectedStoryEnvironment => {
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = document.documentElement.clientHeight || window.innerHeight;
      const containerWidth = root.clientWidth;
      const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const base = { width, height, containerWidth, rootFontPx, reducedMotion: reduced.matches };
      const j3Capacity = isJ3CapacityEligible(base);
      return {
        revision,
        ...base,
        fontsReady: fontsReadyRef.current,
        j3Fit: j3Capacity && connectedJ3PreflightFits(root),
        cCapable: isCCapable(base),
      };
    };

    const evaluate = (reason: string) => {
      if (!active) return;
      environmentRevisionRef.current += 1;
      const revision = environmentRevisionRef.current;
      const position = capture();
      const environment = readEnvironment(revision);
      let winner = selectConnectedStoryFamily(environment);
      if (winner === "j3" && j3RetryBlockedRef.current) {
        const internallyCaused = ["container-resize", "fonts-ready", "fonts-loadingdone"].includes(reason);
        if (internallyCaused) winner = environment.cCapable ? "c" : "a";
        else j3RetryBlockedRef.current = false;
      }
      targetFamilyRef.current = winner;
      if (winner !== "j3") {
        if (loadTimerRef.current !== null) window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
        commit(winner, position);
        return;
      }
      if (cachedJ3Module) {
        setJ3(() => cachedJ3Module!.ConnectedStoryJ3);
        commit("j3", position);
        return;
      }
      root.dataset.connectedTransition = "loading-j3";
      const fallback = environment.cCapable ? "c" : "a";
      if (familyRef.current === null) {
        loadTimerRef.current = window.setTimeout(() => {
          if (!active || environmentRevisionRef.current !== revision || targetFamilyRef.current !== "j3") return;
          j3RetryBlockedRef.current = true;
          targetFamilyRef.current = fallback;
          commit(fallback, position);
        }, loadBound);
      }
      void loadJ3().then((module) => {
        cachedJ3Module = module;
        if (!active || environmentRevisionRef.current !== revision || targetFamilyRef.current !== "j3") return;
        const currentEnvironment = readEnvironment(revision);
        if (selectConnectedStoryFamily(currentEnvironment) !== "j3") return;
        if (loadTimerRef.current !== null) window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
        setJ3(() => module.ConnectedStoryJ3);
        commit("j3", position);
      }).catch(() => {
        if (!active || environmentRevisionRef.current !== revision || targetFamilyRef.current !== "j3") return;
        j3RetryBlockedRef.current = true;
        targetFamilyRef.current = fallback;
        commit(fallback, position);
      });
    };

    const requestEvaluation = (reason: string, immediate = false) => {
      if (!initialized && !immediate) return;
      if (evaluationFrameRef.current !== null) cancelAnimationFrame(evaluationFrameRef.current);
      if (immediate) {
        evaluationFrameRef.current = null;
        initialized = true;
        evaluate(reason);
        return;
      }
      evaluationFrameRef.current = requestAnimationFrame(() => {
        evaluationFrameRef.current = null;
        evaluate(reason);
      });
    };

    const markIntent = () => { intentRevisionRef.current += 1; };
    const onWheel = (event: WheelEvent) => { if (event.isTrusted && (event.deltaX !== 0 || event.deltaY !== 0)) markIntent(); };
    const onTouchStart = (event: TouchEvent) => { if (event.isTrusted) touchStartY = event.touches[0]?.clientY ?? null; };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (event.isTrusted && touchStartY !== null && y !== undefined && Math.abs(y - touchStartY) >= 6) markIntent();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted || isEditableTarget(event.target)) return;
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) markIntent();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.isTrusted && event.clientX >= document.documentElement.clientWidth) markIntent();
    };
    const onScroll = () => {
      if (checkpointTimerRef.current !== null) window.clearTimeout(checkpointTimerRef.current);
      checkpointTimerRef.current = window.setTimeout(() => {
        if (active && familyRef.current && pendingRef.current === null) {
          const position = captureConnectedStoryPosition(root, familyRef.current);
          root.dataset.connectedSemanticChapter = position.chapter;
          writeCheckpoint(position);
        }
      }, 180);
    };
    const onResize = () => requestEvaluation("viewport-resize");
    const onFontsLoadingDone = () => requestEvaluation("fonts-loadingdone");
    const onReduced = () => requestEvaluation(reduced.matches ? "reduced-immediate" : "reduced-cleared", reduced.matches);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) requestEvaluation("bfcache-retained");
    };
    const onPopState = () => {
      pendingRef.current?.frames.forEach(cancelAnimationFrame);
      pendingRef.current = null;
      requestEvaluation("history-navigation");
    };
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => requestEvaluation("container-resize"))
      : null;
    observer?.observe(root);
    window.addEventListener("resize", onResize);
    reduced.addEventListener("change", onReduced);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);

    const resolveInitial = () => {
      if (!active || initialized) return;
      initialized = true;
      evaluate("initial");
    };
    const fonts = document.fonts;
    if (!fonts) {
      fontsReadyRef.current = true;
      resolveInitial();
    } else {
      if (fonts.status === "loaded") fontsReadyRef.current = true;
      void fonts.ready.then(() => {
        if (!active) return;
        fontsReadyRef.current = true;
        if (!initialized) resolveInitial();
        else requestEvaluation("fonts-ready");
      }).catch(() => resolveInitial());
      fonts.addEventListener?.("loadingdone", onFontsLoadingDone);
      fontTimer = window.setTimeout(resolveInitial, fontBound);
    }

    return () => {
      active = false;
      window.clearTimeout(fontTimer);
      if (loadTimerRef.current !== null) window.clearTimeout(loadTimerRef.current);
      if (checkpointTimerRef.current !== null) window.clearTimeout(checkpointTimerRef.current);
      if (evaluationFrameRef.current !== null) cancelAnimationFrame(evaluationFrameRef.current);
      pendingRef.current?.frames.forEach(cancelAnimationFrame);
      pendingRef.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      fonts?.removeEventListener?.("loadingdone", onFontsLoadingDone);
      reduced.removeEventListener("change", onReduced);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, [options.fontReadinessBoundMs, options.j3LoadBoundMs, options.loadJ3, rootRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const pending = pendingRef.current;
    if (!root || !family || !pending || pending.family !== family) return;
    root.dataset.connectedFamily = family;
    root.dataset.connectedSemanticOwner = family;
    root.dataset.connectedPresentationOwner = family;
    let attempts = 0;
    const settle = () => {
      if (pendingRef.current !== pending) return;
      attempts += 1;
      const target = pending.position ? destinationForPosition(root, family, pending.position) : null;
      if (attempts < 3 || (family === "j3" && target === null && attempts < 10)) {
        pending.frames.push(requestAnimationFrame(settle));
        return;
      }
      if (pending.position && target !== null) {
        const current = currentGuard(environmentRevisionRef, transitionRevisionRef, intentRevisionRef, targetFamilyRef);
        const canCorrect = correctionIsEligible({
          expected: pending.guard,
          current,
          semanticDestinationValid: true,
          alreadyCorrected: pending.corrected,
        });
        if (canCorrect) {
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          const correctionGuard = Math.max(96, window.innerHeight * 0.2);
          let reconciledTarget = target;
          if (Math.abs(target - window.scrollY) > correctionGuard) {
            const range = destinationRangeForChapter(root, family, pending.position);
            if (range) reconciledTarget = Math.max(range[0], Math.min(range[1], window.scrollY));
          }
          const boundedTarget = Math.max(0, Math.min(maxScroll, reconciledTarget));
          const correction = boundedTarget - window.scrollY;
          if (Math.abs(correction) > 1) {
            window.scrollTo({ top: boundedTarget, left: window.scrollX, behavior: "instant" });
            pending.corrected = true;
          }
        }
        root.dataset.connectedSemanticChapter = pending.position.chapter;
        writeCheckpoint(pending.position);
      } else {
        const position = captureConnectedStoryPosition(root, family);
        root.dataset.connectedSemanticChapter = position.chapter;
        writeCheckpoint(position);
      }
      root.dataset.connectedTransition = "settled";
      pendingRef.current = null;
    };
    pending.frames.push(requestAnimationFrame(settle));
    return () => pending.frames.forEach(cancelAnimationFrame);
  }, [family, rootRef]);

  return {
    family,
    J3,
    activeChapter,
    setActiveChapter,
    environmentRevision: environmentRevisionRef.current,
    transitionRevision: transitionRevisionRef.current,
  };
}
