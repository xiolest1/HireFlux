import { afterEach, describe, expect, it, vi } from "vitest";
import { connectedContentFits, mountConnectedStory } from "./connectedStoryLifecycle";
import { scrollStoryFullQuery, scrollStoryAdaptedQuery } from "./scrollStoryConfig";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });

function harness() {
  document.body.innerHTML = '<div id="story"><span data-scroll-fit-probe></span><div id="stage"><div data-workspace-shell></div><div data-workspace-stage-envelope></div></div><article data-scroll-fallback-chapter></article><article data-scroll-fallback-chapter></article><article data-scroll-fallback-chapter></article><article data-scroll-fallback-chapter></article></div>';
  const root = document.querySelector<HTMLElement>("#story")!;
  const stage = document.querySelector<HTMLElement>("#stage")!;
  let y = 0;
  let height = 640;
  let font = "16px";
  const listeners = new Map<string, Set<() => void>>();
  const matches = new Map([[scrollStoryFullQuery, true], [scrollStoryAdaptedQuery, false], ["(prefers-reduced-motion: reduce)", false]]);
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return matches.get(query) ?? false; },
    addEventListener: (_: string, fn: () => void) => { if (!listeners.has(query)) listeners.set(query, new Set()); listeners.get(query)!.add(fn); },
    removeEventListener: (_: string, fn: () => void) => listeners.get(query)?.delete(fn),
  }));
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({ fontSize: font }) as CSSStyleDeclaration);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this === stage ? height : 400; });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);
  vi.spyOn(root, "getBoundingClientRect").mockImplementation(() => ({ bottom: 3500 - y }) as DOMRect);
  root.querySelectorAll<HTMLElement>("article").forEach((chapter, index) => {
    vi.spyOn(chapter, "getBoundingClientRect").mockImplementation(() => ({ top: 1000 + index * 400 - y }) as DOMRect);
  });
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation((options) => { y = (options as ScrollToOptions).top!; });
  let resize: () => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; });
  let alive = 0;
  let maxAlive = 0;
  const settle = vi.fn();
  const cacheScroll = vi.fn();
  const create = vi.fn(() => {
    alive++; maxAlive = Math.max(maxAlive, alive);
    return { trigger: { start: 1000, end: 3000, scroll: cacheScroll, refresh: vi.fn(), update: vi.fn() }, settle, dispose: vi.fn(() => { alive--; }) };
  });
  const cleanup = mountConnectedStory(root, stage, create);
  return { root, stage, create, scroll, cacheScroll, settle, cleanup, disconnect, resize: () => resize(), counts: () => ({alive, maxAlive}), listeners,
    setY: (value: number) => { y = value; }, y: () => y,
    text: (value: number) => { height = 640 * value; font = `${16 * value}px`; resize(); },
    reduce: (value: boolean) => {
      matches.set("(prefers-reduced-motion: reduce)", value); matches.set(scrollStoryFullQuery, !value);
      listeners.get("(prefers-reduced-motion: reduce)")!.forEach((fn) => fn());
    },
  };
}

describe("Connected-local mode transaction", () => {
  it("maps pinned chapter-local progress to Static and back synchronously", () => {
    const h = harness(); h.setY(2200); h.reduce(true);
    expect(h.root.dataset.scrollMode).toBe("static");
    expect(h.y()).toBeCloseTo(1800 + 400 * ((0.6 - 0.46) / 0.3));
    expect(h.cacheScroll).toHaveBeenLastCalledWith(h.y());
    h.reduce(false); expect(h.y()).toBeCloseTo(2200); expect(h.settle).toHaveBeenLastCalledWith(0.6);
    expect(h.cacheScroll).toHaveBeenLastCalledWith(2200);
    h.cleanup();
  });
  it("preserves raw position only before the story and relative end position after it", () => {
    const h = harness(); h.setY(500); h.reduce(true); expect(h.y()).toBe(500);
    h.reduce(false); h.setY(3600); h.reduce(true); expect(h.y()).toBe(3600); h.cleanup();
  });
  it("rapid latest-mode wins without queued correction, and later user scroll remains authoritative", () => {
    const h = harness(); const timer = vi.spyOn(window, "setTimeout"); const frame = vi.spyOn(window, "requestAnimationFrame");
    h.setY(2200); h.reduce(true); h.reduce(false); h.reduce(true);
    expect(h.counts()).toEqual({alive: 0, maxAlive: 1});
    const corrections = h.scroll.mock.calls.length; h.setY(2500); h.resize();
    expect(h.y()).toBe(2500); expect(h.scroll).toHaveBeenCalledTimes(corrections);
    expect(timer).not.toHaveBeenCalled(); expect(frame).not.toHaveBeenCalled(); h.cleanup();
  });
  it("vetoes candidate geometry, never uses Static dimensions to re-enable pinning, and recovers when safe", () => {
    const h = harness(); h.setY(2200);
    for (const scale of [1.5, 1.75, 2, 1.75, 1.5]) {
      h.text(scale); expect(h.root.dataset.scrollMode).toBe("static");
      for (let i = 0; i < 5; i++) h.resize();
      expect(h.counts().alive).toBe(0);
    }
    expect(h.create).toHaveBeenCalledTimes(1);
    h.text(1); expect(h.root.dataset.scrollMode).toBe("full"); expect(h.y()).toBeCloseTo(2200); h.cleanup();
  });
  it("unmount disconnects every listener and invalidates queued observer notifications", () => {
    const h = harness(); h.reduce(true); h.cleanup(); const calls = h.scroll.mock.calls.length;
    h.text(1); h.resize();
    expect(h.scroll).toHaveBeenCalledTimes(calls); expect(h.disconnect).toHaveBeenCalledOnce();
    expect([...h.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
    expect(h.counts().alive).toBe(0);
  });
  it("fails open to static when pinned geometry cannot be measured", () => {
    const h = harness(); h.text(0); expect(connectedContentFits(h.stage)).toBe(false); h.cleanup();
  });
  it("vetoes actual narrative text overflow, not empty trailing padding", () => {
    const h = harness();
    h.stage.insertAdjacentHTML("beforeend", '<div data-scroll-copy-content><p>Narrative text</p></div>');
    const frame = h.stage.querySelector("p")!;
    vi.spyOn(frame, "scrollHeight", "get").mockReturnValue(550);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({bottom:500} as DOMRect);
    const bounds = vi.fn(() => ({bottom:499}) as DOMRect);
    vi.spyOn(document, "createRange").mockReturnValue({selectNodeContents:vi.fn(),getBoundingClientRect:bounds} as unknown as Range);
    expect(connectedContentFits(h.stage)).toBe(true);
    bounds.mockReturnValue({bottom:510} as DOMRect);
    expect(connectedContentFits(h.stage)).toBe(false);
    h.cleanup();
  });
});
