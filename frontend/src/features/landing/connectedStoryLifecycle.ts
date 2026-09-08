import {
  scrollChapterForProgress,
  scrollStoryAdaptedQuery,
  scrollStoryFullQuery,
  scrollStoryTimelineLabels,
  type ScrollStoryChoreographyMode,
} from "./scrollStoryConfig";

const chapters = ["applications", "interviews", "preparation", "action-center"] as const;
const boundaries = [0, scrollStoryTimelineLabels.interviews, scrollStoryTimelineLabels.preparation, scrollStoryTimelineLabels.actionCenter, 1];
type Position = { kind: "before"; y: number } | { kind: "after"; offset: number } | { kind: "chapter"; index: number; fraction: number };

export interface ConnectedAnimation {
  trigger: { start: number; end: number; progress?: number; scroll?: (value: number) => void; refresh: () => void; update: () => void };
  settle: (progress: number) => void;
  dispose: () => void;
}

/** Measure the candidate PINNED DOM, never the smaller fallback or transformed bounds. */
export function connectedContentFits(stage: HTMLElement) {
  const shell = stage.querySelector<HTMLElement>("[data-workspace-shell]");
  const envelope = stage.querySelector<HTMLElement>("[data-workspace-stage-envelope]");
  if (!shell || !envelope || stage.offsetHeight === 0 || stage.offsetHeight > window.innerHeight + 1
    || shell.offsetHeight > envelope.clientHeight + 1) return false;
  const frames = stage.querySelectorAll<HTMLElement>(
    "[data-scroll-copy-content] > *",
  );
  return Array.from(frames).every((frame) => {
    if (frame.scrollHeight <= frame.clientHeight + 1) return true;
    // Overflowing trailing padding is not clipped content. Check actual text
    // ink boxes before vetoing an otherwise-safe approved endpoint.
    const bottom = frame.getBoundingClientRect().bottom;
    const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        if (range.getBoundingClientRect().bottom > bottom + 1) return false;
      }
      node = walker.nextNode();
    }
    return true;
  });
}

/** One mount-local, synchronous mode transaction. No deferred scroll work exists. */
export function mountConnectedStory(
  root: HTMLElement,
  stage: HTMLElement,
  createAnimation: (mode: ScrollStoryChoreographyMode) => ConnectedAnimation,
) {
  const full = window.matchMedia(scrollStoryFullQuery);
  const adapted = window.matchMedia(scrollStoryAdaptedQuery);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animation: ConnectedAnimation | null = null;
  let updateScrollCache: ConnectedAnimation["trigger"]["scroll"];
  let active = true;
  let initialized = false;
  let signature = "";
  let retained: { y: number; position: Position } | null = null;
  const bottom = () => root.getBoundingClientRect().bottom + window.scrollY;
  const staticChapters = () => Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-fallback-chapter]"));

  function capture(): Position {
    const y = window.scrollY;
    if (animation) {
      const { start, end, progress: displayedProgress } = animation.trigger;
      const wasInside = displayedProgress !== undefined && displayedProgress > 0 && displayedProgress < 1;
      if (!wasInside && y < start) return { kind: "before", y };
      if (!wasInside && y > end) return { kind: "after", offset: y - bottom() };
      const progress = wasInside ? displayedProgress : Math.max(0, Math.min(1, (y - start) / (end - start)));
      const index = chapters.indexOf(scrollChapterForProgress(progress));
      return { kind: "chapter", index, fraction: (progress - boundaries[index]) / (boundaries[index + 1] - boundaries[index]) };
    }
    // Two-column fallback rows have equal tops. Retain the known chapter on a
    // round trip; without prior context, ties use semantic DOM order.
    if (retained && Math.abs(y - retained.y) <= 1) return retained.position;
    const elements = staticChapters();
    const tops = elements.map((element) => element.getBoundingClientRect().top);
    if (tops[0] > 0) return { kind: "before", y };
    if (y >= bottom()) return { kind: "after", offset: y - bottom() };
    let index = 0;
    tops.forEach((top, candidate) => { if (Math.abs(top) < Math.abs(tops[index]) - 1) index = candidate; });
    return { kind: "chapter", index, fraction: Math.max(0, Math.min(1, -tops[index] / elements[index].offsetHeight)) };
  }

  function restore(position: Position) {
    let target: number;
    let progress: number | undefined;
    if (position.kind === "before") target = position.y;
    else if (position.kind === "after") target = bottom() + position.offset;
    else if (animation) {
      progress = boundaries[position.index] + position.fraction * (boundaries[position.index + 1] - boundaries[position.index]);
      target = animation.trigger.start + progress * (animation.trigger.end - animation.trigger.start);
    } else {
      const chapter = staticChapters()[position.index];
      target = chapter.getBoundingClientRect().top + window.scrollY + position.fraction * chapter.offsetHeight;
    }
    window.scrollTo({ top: target, left: window.scrollX, behavior: "instant" });
    // Update the owned scroller's cache too: GSAP's queued refresh must record
    // the new position, not restore its pre-transaction cached scroll value.
    updateScrollCache?.(window.scrollY);
    animation?.trigger.update();
    if (progress !== undefined) animation?.settle(progress);
    retained = { y: window.scrollY, position };
  }

  function synchronize() {
    if (!active) return;
    const nextSignature = `${window.innerWidth}/${window.innerHeight}/${root.clientWidth}/${getComputedStyle(root).fontSize}/${full.matches}/${adapted.matches}/${reduced.matches}`;
    if (nextSignature === signature) return;
    signature = nextSignature;
    const position = initialized ? capture() : null;
    animation?.dispose();
    animation = null;
    const candidate = full.matches ? "full" : adapted.matches ? "adapted" : null;
    // Candidate layout is measured and accepted/vetoed in the same task, before
    // paint. Its geometry is independent of whichever fallback was last shown.
    root.dataset.scrollMode = candidate ?? "static";
    const fits = candidate !== null && !reduced.matches && connectedContentFits(stage);
    root.dataset.scrollFit = fits ? "fit" : "static";
    if (fits && candidate) {
      animation = createAnimation(candidate);
      updateScrollCache = animation.trigger.scroll;
      animation.trigger.refresh();
    } else root.dataset.scrollMode = "static";
    initialized = true;
    if (position) restore(position);
  }

  full.addEventListener("change", synchronize);
  adapted.addEventListener("change", synchronize);
  reduced.addEventListener("change", synchronize);
  window.addEventListener("resize", synchronize);
  // Live root-text changes need a size notification without a window resize.
  // Only this mode-independent rem probe is observed, never the pin or fallback.
  const probe = root.querySelector<HTMLElement>("[data-scroll-fit-probe]");
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(synchronize) : null;
  if (probe) observer?.observe(probe);
  synchronize();
  return () => {
    active = false;
    retained = null;
    observer?.disconnect();
    full.removeEventListener("change", synchronize);
    adapted.removeEventListener("change", synchronize);
    reduced.removeEventListener("change", synchronize);
    window.removeEventListener("resize", synchronize);
    animation?.dispose();
    animation = null;
    updateScrollCache = undefined;
    root.dataset.scrollMode = "static";
  };
}
