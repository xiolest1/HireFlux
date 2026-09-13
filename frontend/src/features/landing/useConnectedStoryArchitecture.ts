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
  selectConnectedStory,
  semanticPositionForJ3Progress,
  validateConnectedStoryCheckpoint,
  type ConnectedStoryEnvironment,
  type ConnectedStoryFamily,
  type ConnectedStoryCPresentation,
  type ConnectedStoryPosition,
  type ConnectedStorySelection,
  type ReconciliationGuard,
} from "./connectedStoryReconciliation";
import { connectedJ3PreflightFits, connectedStoryCProgressivePreflightFits } from "./connectedStoryFit";
import { progressiveCAllowed } from "./connectedStoryCConfig";
import type { LandingWorkspaceStage } from "./landingStoryModel";
import { scrollStoryTravelViewportHeights } from "./scrollStoryConfig";

type J3Component = ComponentType<{
  onChapterChange?: (chapter: LandingWorkspaceStage) => void;
}>;

interface J3Module {
  ConnectedStoryJ3: J3Component;
}

interface PendingReconciliation {
  selection: ConnectedStorySelection;
  position: ConnectedStoryPosition | null;
  guard: ReconciliationGuard;
  corrected: boolean;
  frames: number[];
}

interface RuntimeOptions {
  loadJ3?: () => Promise<J3Module>;
  fontReadinessBoundMs?: number;
  j3LoadBoundMs?: number;
  progressiveCAllowed?: boolean;
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

function readingLine(presentation: ConnectedStoryCPresentation | null = null) {
  return presentation === "progressive" ? window.innerHeight / 2 : window.innerHeight / 3;
}

function currentCodaPosition(presentation: ConnectedStoryCPresentation | null = null): ConnectedStoryPosition | null {
  const coda = document.querySelector<HTMLElement>("[data-quiet-coda]");
  if (!coda || coda.getBoundingClientRect().top > window.innerHeight / 2) return null;
  return {
    chapter: "post-story",
    localProgress: 1,
    codaProgress: Math.max(0, Math.min(1, (readingLine(presentation) - coda.getBoundingClientRect().top) / Math.max(1, coda.offsetHeight))),
  };
}

export function captureConnectedStoryPosition(
  root: HTMLElement,
  family: ConnectedStoryFamily,
  cPresentation: ConnectedStoryCPresentation | null = null,
): ConnectedStoryPosition {
  const coda = currentCodaPosition(cPresentation);
  if (coda) return coda;
  const line = readingLine(cPresentation);
  if (root.getBoundingClientRect().top > line) {
    return { chapter: "pre-story", localProgress: 0, codaProgress: 0 };
  }
  if (family === "j3") {
    const progress = Number(root.querySelector<HTMLElement>("[data-connected-j3]")?.dataset.connectedProgress ?? 0);
    return semanticPositionForJ3Progress(progress);
  }
  const selector = cPresentation === "progressive"
    ? "[data-connected-c-semantic-chapter]"
    : "[data-connected-chapter]";
  const chapters = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (chapters.length === 0) return { chapter: "pre-story", localProgress: 0, codaProgress: 0 };
  let index = 0;
  chapters.forEach((chapter, candidate) => {
    if (chapter.getBoundingClientRect().top <= line) index = candidate;
  });
  const currentTop = chapters[index].getBoundingClientRect().top;
  const nextTop = chapters[index + 1]?.getBoundingClientRect().top
    ?? (cPresentation === "progressive" ? chapters[index].getBoundingClientRect().bottom : root.getBoundingClientRect().bottom);
  return {
    chapter: (chapters[index].dataset.connectedCSemanticChapter
      ?? chapters[index].dataset.connectedChapter) as LandingWorkspaceStage,
    localProgress: Math.max(0, Math.min(1, (line - currentTop) / Math.max(1, nextTop - currentTop))),
    codaProgress: 0,
  };
}

function destinationForPosition(
  root: HTMLElement,
  family: ConnectedStoryFamily,
  position: ConnectedStoryPosition,
  cPresentation: ConnectedStoryCPresentation | null = null,
) {
  const line = readingLine(cPresentation);
  if (position.chapter === "pre-story") return null;
  if (position.chapter === "post-story") {
    const coda = document.querySelector<HTMLElement>("[data-quiet-coda]");
    return coda
      ? absoluteTop(coda) + position.codaProgress * coda.offsetHeight - line
      : null;
  }
  if (family === "j3") {
    const pin = root.querySelector<HTMLElement>("[data-scroll-story-pin]");
    const spacer = pin?.parentElement?.classList.contains("pin-spacer") ? pin.parentElement : null;
    if (!spacer) return null;
    return absoluteTop(spacer)
      + j3ProgressForSemanticPosition(position) * window.innerHeight * scrollStoryTravelViewportHeights;
  }
  const chapterSelector = cPresentation === "progressive"
    ? `[data-connected-c-semantic-chapter="${position.chapter}"]`
    : `[data-connected-chapter="${position.chapter}"]`;
  const chapter = root.querySelector<HTMLElement>(chapterSelector);
  if (!chapter) return null;
  const next = chapter.parentElement?.nextElementSibling?.querySelector<HTMLElement>("[data-connected-chapter]")
    ?? chapter.nextElementSibling as HTMLElement | null;
  const currentTop = absoluteTop(chapter);
  const nextTop = next
    ? absoluteTop(next)
    : cPresentation === "progressive"
      ? currentTop + chapter.offsetHeight
      : absoluteTop(root) + root.offsetHeight;
  return currentTop + position.localProgress * Math.max(1, nextTop - currentTop) - line;
}

function destinationRangeForChapter(
  root: HTMLElement,
  family: ConnectedStoryFamily,
  position: ConnectedStoryPosition,
  cPresentation: ConnectedStoryCPresentation | null = null,
) {
  if (position.chapter === "pre-story" || position.chapter === "post-story") return null;
  const start = destinationForPosition(root, family, { ...position, localProgress: 0.02 }, cPresentation);
  const end = destinationForPosition(root, family, { ...position, localProgress: 0.98 }, cPresentation);
  return start === null || end === null
    ? null
    : [Math.min(start, end), Math.max(start, end)] as const;
}

function currentGuard(
  environmentRevision: RefObject<number>,
  transitionRevision: RefObject<number>,
  intentRevision: RefObject<number>,
  targetFamily: RefObject<ConnectedStoryFamily>,
  targetPresentation: RefObject<ConnectedStoryCPresentation | null>,
  presentationRevision: RefObject<number>,
  fitRevision: RefObject<number>,
  observerGeneration: RefObject<number>,
): ReconciliationGuard {
  return {
    environmentRevision: environmentRevision.current,
    transitionRevision: transitionRevision.current,
    intentRevision: intentRevision.current,
    targetFamily: targetFamily.current,
    targetPresentation: targetPresentation.current,
    presentationRevision: presentationRevision.current,
    fitRevision: fitRevision.current,
    observerGeneration: observerGeneration.current,
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

function sameSelection(left: ConnectedStorySelection | null, right: ConnectedStorySelection) {
  return left?.family === right.family && left.cPresentation === right.cPresentation;
}

export function useConnectedStoryArchitecture(
  rootRef: RefObject<HTMLDivElement | null>,
  options: RuntimeOptions = {},
) {
  const [selection, setSelection] = useState<ConnectedStorySelection | null>(null);
  const [J3, setJ3] = useState<J3Component | null>(() => cachedJ3Module?.ConnectedStoryJ3 ?? null);
  const [activeChapter, setActiveChapter] = useState<LandingWorkspaceStage>(() => {
    const checkpoint = typeof window === "undefined" ? null : readCheckpoint();
    return checkpoint && ["applications", "interviews", "preparation", "action-center"].includes(checkpoint.chapter)
      ? checkpoint.chapter as LandingWorkspaceStage
      : "applications";
  });
  const selectionRef = useRef<ConnectedStorySelection | null>(null);
  const targetFamilyRef = useRef<ConnectedStoryFamily>("a");
  const targetPresentationRef = useRef<ConnectedStoryCPresentation | null>(null);
  const environmentRevisionRef = useRef(0);
  const transitionRevisionRef = useRef(0);
  const presentationRevisionRef = useRef(0);
  const fitRevisionRef = useRef(0);
  const observerGenerationRef = useRef(0);
  const intentRevisionRef = useRef(0);
  const pendingRef = useRef<PendingReconciliation | null>(null);
  const evaluationFrameRef = useRef<number | null>(null);
  const checkpointTimerRef = useRef<number | null>(null);
  const loadTimerRef = useRef<number | null>(null);
  const fontsReadyRef = useRef(false);
  const j3RetryBlockedRef = useRef(false);
  const [progressiveRuntimeAvailable, setProgressiveRuntimeAvailable] = useState(true);
  const [presentationSettled, setPresentationSettled] = useState(false);
  const family = selection?.family ?? null;
  const cPresentation = selection?.family === "c" ? selection.cPresentation : null;

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
    let observer: ResizeObserver | null = null;
    let containerObservationAvailable = typeof ResizeObserver === "function";

    const capture = () => selectionRef.current
      ? captureConnectedStoryPosition(root, selectionRef.current.family, selectionRef.current.cPresentation)
      : readCheckpoint();

    const commit = (nextSelection: ConnectedStorySelection, position: ConnectedStoryPosition | null) => {
      if (!active) return;
      if (sameSelection(selectionRef.current, nextSelection)) {
        const pending = pendingRef.current;
        if (pending && pending.guard.intentRevision === intentRevisionRef.current) {
          pending.guard = currentGuard(environmentRevisionRef, transitionRevisionRef, intentRevisionRef, targetFamilyRef, targetPresentationRef, presentationRevisionRef, fitRevisionRef, observerGenerationRef);
        }
        return;
      }
      transitionRevisionRef.current += 1;
      if (selectionRef.current?.cPresentation !== nextSelection.cPresentation) presentationRevisionRef.current += 1;
      targetFamilyRef.current = nextSelection.family;
      targetPresentationRef.current = nextSelection.cPresentation;
      const guard = currentGuard(environmentRevisionRef, transitionRevisionRef, intentRevisionRef, targetFamilyRef, targetPresentationRef, presentationRevisionRef, fitRevisionRef, observerGenerationRef);
      pendingRef.current?.frames.forEach(cancelAnimationFrame);
      pendingRef.current = { selection: nextSelection, position, guard, corrected: false, frames: [] };
      selectionRef.current = nextSelection;
      root.dataset.connectedTransition = "preparing";
      setPresentationSettled(false);
      if (nextSelection.cPresentation === "progressive" && position
        && ["applications", "interviews", "preparation", "action-center"].includes(position.chapter)) {
        setActiveChapter(position.chapter as LandingWorkspaceStage);
      }
      setSelection(nextSelection);
    };

    const readEnvironment = (revision: number): ConnectedStoryEnvironment => {
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = document.documentElement.clientHeight || window.innerHeight;
      const usableHeight = window.visualViewport?.height ?? height;
      const containerWidth = root.clientWidth;
      const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const base = { width, height, containerWidth, rootFontPx, reducedMotion: reduced.matches };
      const j3Capacity = containerObservationAvailable && isJ3CapacityEligible(base);
      fitRevisionRef.current += 1;
      const progressiveFit = connectedStoryCProgressivePreflightFits(root, {
        width,
        usableHeight,
        containerWidth,
        rootFontPx,
        progressiveAllowed: (options.progressiveCAllowed ?? progressiveCAllowed) && progressiveRuntimeAvailable,
        reducedMotion: reduced.matches,
        intersectionObserverAvailable: typeof IntersectionObserver === "function",
        stickySupported: CSS.supports?.("position", "sticky") ?? false,
        currentlyProgressive: selectionRef.current?.cPresentation === "progressive",
      });
      return {
        revision,
        ...base,
        fontsReady: fontsReadyRef.current,
        j3Fit: j3Capacity && connectedJ3PreflightFits(root),
        cCapable: containerObservationAvailable && isCCapable(base),
        progressiveCAllowed: (options.progressiveCAllowed ?? progressiveCAllowed) && progressiveRuntimeAvailable,
        progressiveCCapability: progressiveFit.capability,
      };
    };

    const evaluate = (reason: string) => {
      if (!active) return;
      environmentRevisionRef.current += 1;
      const revision = environmentRevisionRef.current;
      let position = capture();
      const environment = readEnvironment(revision);
      let winner = selectConnectedStory(environment);
      if (winner.family === "j3" && j3RetryBlockedRef.current) {
        const internallyCaused = ["container-resize", "fonts-ready", "fonts-loadingdone"].includes(reason);
        if (internallyCaused) winner = environment.cCapable
          ? { family: "c", cPresentation: environment.progressiveCAllowed && environment.progressiveCCapability !== "ineligible" ? "progressive" : "native" }
          : { family: "a", cPresentation: null };
        else j3RetryBlockedRef.current = false;
      }
      if (
        selectionRef.current?.family === "c"
        && winner.family === "c"
        && selectionRef.current.cPresentation !== winner.cPresentation
      ) {
        // A viewport change has already reflowed the outgoing DOM by the time
        // its resize event runs. Preserve the last controller-owned semantic
        // checkpoint instead of reinterpreting that transient geometry as a
        // different chapter.
        position = readCheckpoint() ?? position;
      }
      targetFamilyRef.current = winner.family;
      targetPresentationRef.current = winner.cPresentation;
      if (winner.family !== "j3") {
        if (loadTimerRef.current !== null) window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
        commit(winner, position);
        return;
      }
      if (cachedJ3Module) {
        setJ3(() => cachedJ3Module!.ConnectedStoryJ3);
        commit({ family: "j3", cPresentation: null }, position);
        return;
      }
      root.dataset.connectedTransition = "loading-j3";
      const fallback: ConnectedStorySelection = environment.cCapable
        ? { family: "c", cPresentation: environment.progressiveCAllowed && environment.progressiveCCapability !== "ineligible" ? "progressive" : "native" }
        : { family: "a", cPresentation: null };
      if (selectionRef.current === null) {
        loadTimerRef.current = window.setTimeout(() => {
          if (!active || environmentRevisionRef.current !== revision || targetFamilyRef.current !== "j3") return;
          j3RetryBlockedRef.current = true;
          targetFamilyRef.current = fallback.family;
          targetPresentationRef.current = fallback.cPresentation;
          commit(fallback, position);
        }, loadBound);
      }
      void loadJ3().then((module) => {
        cachedJ3Module = module;
        if (!active || environmentRevisionRef.current !== revision || targetFamilyRef.current !== "j3") return;
        const currentEnvironment = readEnvironment(revision);
        if (selectConnectedStory(currentEnvironment).family !== "j3") return;
        if (loadTimerRef.current !== null) window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
        setJ3(() => module.ConnectedStoryJ3);
        commit({ family: "j3", cPresentation: null }, position);
      }).catch(() => {
        if (!active || environmentRevisionRef.current !== revision || targetFamilyRef.current !== "j3") return;
        j3RetryBlockedRef.current = true;
        targetFamilyRef.current = fallback.family;
        targetPresentationRef.current = fallback.cPresentation;
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
        if (active && selectionRef.current && pendingRef.current === null) {
          const position = captureConnectedStoryPosition(root, selectionRef.current.family, selectionRef.current.cPresentation);
          root.dataset.connectedSemanticChapter = position.chapter;
          writeCheckpoint(position);
        }
      }, 180);
    };
    const onResize = () => requestEvaluation("viewport-resize");
    const onVisualViewportResize = () => requestEvaluation("visual-viewport-resize");
    const onFontsLoadingDone = () => requestEvaluation("fonts-loadingdone");
    const onReduced = () => requestEvaluation(reduced.matches ? "reduced-immediate" : "reduced-cleared", reduced.matches);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) requestEvaluation("bfcache-retained");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestEvaluation("visibility-resume");
    };
    const onPopState = () => {
      pendingRef.current?.frames.forEach(cancelAnimationFrame);
      pendingRef.current = null;
      requestEvaluation("history-navigation");
    };
    if (containerObservationAvailable) {
      try {
        observer = new ResizeObserver(() => requestEvaluation("container-resize"));
        observer.observe(root);
      } catch {
        observer?.disconnect();
        observer = null;
        containerObservationAvailable = false;
      }
    }
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onVisualViewportResize);
    reduced.addEventListener("change", onReduced);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onVisibilityChange);

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
      window.visualViewport?.removeEventListener("resize", onVisualViewportResize);
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
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [options.fontReadinessBoundMs, options.j3LoadBoundMs, options.loadJ3, options.progressiveCAllowed, progressiveRuntimeAvailable, rootRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const pending = pendingRef.current;
    if (!root || !selection || !pending || !sameSelection(pending.selection, selection)) return;
    const family = selection.family;
    const presentation = selection.cPresentation;
    root.dataset.connectedFamily = family;
    root.dataset.connectedSemanticOwner = family;
    root.dataset.connectedPresentationOwner = presentation ?? family;
    let attempts = 0;
    const settle = () => {
      if (pendingRef.current !== pending) return;
      attempts += 1;
      const target = pending.position ? destinationForPosition(root, family, pending.position, presentation) : null;
      if (attempts < 3 || (family === "j3" && target === null && attempts < 10)) {
        pending.frames.push(requestAnimationFrame(settle));
        return;
      }
      if (pending.position && target !== null) {
        const current = currentGuard(environmentRevisionRef, transitionRevisionRef, intentRevisionRef, targetFamilyRef, targetPresentationRef, presentationRevisionRef, fitRevisionRef, observerGenerationRef);
        if (
          family === "c"
          && pending.guard.intentRevision === current.intentRevision
          && pending.guard.transitionRevision === current.transitionRevision
          && pending.guard.presentationRevision === current.presentationRevision
          && current.targetFamily === family
          && current.targetPresentation === presentation
        ) {
          // A C-native/progressive handoff can legitimately advance geometry and
          // observer revisions while the replacement DOM settles. Those owned
          // lifecycle changes must not veto the single semantic correction; a
          // new trusted user intent or a changed target still does.
          pending.guard = current;
        }
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
            const range = destinationRangeForChapter(root, family, pending.position, presentation);
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
        const position = captureConnectedStoryPosition(root, family, presentation);
        root.dataset.connectedSemanticChapter = position.chapter;
        writeCheckpoint(position);
      }
      root.dataset.connectedTransition = "settled";
      pendingRef.current = null;
      setPresentationSettled(true);
    };
    pending.frames.push(requestAnimationFrame(settle));
    return () => pending.frames.forEach(cancelAnimationFrame);
  }, [rootRef, selection]);

  return {
    family,
    cPresentation,
    J3,
    activeChapter,
    setActiveChapter,
    reportProgressiveCapabilityFailure: () => setProgressiveRuntimeAvailable(false),
    reportProgressiveObserverGeneration: (generation: number) => {
      observerGenerationRef.current = generation;
      const pending = pendingRef.current;
      if (pending && pending.guard.intentRevision === intentRevisionRef.current) {
        pending.guard = currentGuard(
          environmentRevisionRef,
          transitionRevisionRef,
          intentRevisionRef,
          targetFamilyRef,
          targetPresentationRef,
          presentationRevisionRef,
          fitRevisionRef,
          observerGenerationRef,
        );
      }
    },
    reportProgressivePosition: (chapter: LandingWorkspaceStage, localProgress: number) => {
      if (selectionRef.current?.family !== "c" || selectionRef.current.cPresentation !== "progressive") return;
      setActiveChapter(chapter);
      const root = rootRef.current;
      if (root) root.dataset.connectedSemanticChapter = chapter;
      writeCheckpoint({ chapter, localProgress, codaProgress: 0 });
    },
    environmentRevision: environmentRevisionRef.current,
    transitionRevision: transitionRevisionRef.current,
    presentationRevision: presentationRevisionRef.current,
    fitRevision: fitRevisionRef.current,
    presentationSettled,
  };
}
