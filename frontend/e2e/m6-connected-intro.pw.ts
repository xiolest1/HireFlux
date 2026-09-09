import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

interface GeometryBaseline {
  documentHeight: number;
  introStoryGap: number;
  mode: "full" | "adapted" | "static";
  pinSpacerHeight: number;
  sectionHeight: number;
  sectionTop: number;
  stageHeight: number;
  storyHeight: number;
  storyTop: number;
  travel: number;
}

const baselines: Record<string, GeometryBaseline> = {
  "full-1440": { documentHeight: 4645, introStoryGap: 48, mode: "full", pinSpacerHeight: 2938, sectionHeight: 3494, sectionTop: 1066.19, stageHeight: 688, storyHeight: 3098, storyTop: 1366.19, travel: 2250 },
  "full-1280": { documentHeight: 4395, introStoryGap: 48, mode: "full", pinSpacerHeight: 2688, sectionHeight: 3244, sectionTop: 1066.19, stageHeight: 688, storyHeight: 2848, storyTop: 1366.19, travel: 2000 },
  "full-1024-768": { documentHeight: 4413, introStoryGap: 48, mode: "full", pinSpacerHeight: 2608, sectionHeight: 3164, sectionTop: 1163.98, stageHeight: 688, storyHeight: 2768, storyTop: 1463.98, travel: 1920 },
  "full-1024-720": { documentHeight: 4293, introStoryGap: 48, mode: "full", pinSpacerHeight: 2488, sectionHeight: 3044, sectionTop: 1163.98, stageHeight: 688, storyHeight: 2648, storyTop: 1463.98, travel: 1800 },
  "adapted-1023": { documentHeight: 4106, introStoryGap: 56, mode: "adapted", pinSpacerHeight: 2080, sectionHeight: 2612, sectionTop: 1408.53, stageHeight: 640, storyHeight: 2208, storyTop: 1716.53, travel: 1440 },
  "adapted-900": { documentHeight: 4106, introStoryGap: 56, mode: "adapted", pinSpacerHeight: 2080, sectionHeight: 2612, sectionTop: 1408.53, stageHeight: 640, storyHeight: 2208, storyTop: 1716.53, travel: 1440 },
  "adapted-1024-719": { documentHeight: 3851, introStoryGap: 48, mode: "adapted", pinSpacerHeight: 2078, sectionHeight: 2602, sectionTop: 1163.98, stageHeight: 640, storyHeight: 2206, storyTop: 1463.98, travel: 1438 },
  "adapted-1280-700": { documentHeight: 3715, introStoryGap: 48, mode: "adapted", pinSpacerHeight: 2040, sectionHeight: 2564, sectionTop: 1066.19, stageHeight: 640, storyHeight: 2168, storyTop: 1366.19, travel: 1400 },
  "static-899": { documentHeight: 2875, introStoryGap: 56, mode: "static", pinSpacerHeight: 0, sectionHeight: 1381.28, sectionTop: 1408.53, stageHeight: 0, storyHeight: 977.28, storyTop: 1716.53, travel: 0 },
  "static-768": { documentHeight: 2891, introStoryGap: 56, mode: "static", pinSpacerHeight: 0, sectionHeight: 1397.28, sectionTop: 1408.53, stageHeight: 0, storyHeight: 993.28, storyTop: 1716.53, travel: 0 },
  "static-430": { documentHeight: 3693, introStoryGap: 48, mode: "static", pinSpacerHeight: 0, sectionHeight: 2224.53, sectionTop: 1355.45, stageHeight: 0, storyHeight: 1872.53, storyTop: 1643.45, travel: 0 },
  "static-390": { documentHeight: 3903, introStoryGap: 48, mode: "static", pinSpacerHeight: 0, sectionHeight: 2290.45, sectionTop: 1479.45, stageHeight: 0, storyHeight: 1938.45, storyTop: 1767.45, travel: 0 },
  "static-320": { documentHeight: 4205, introStoryGap: 48, mode: "static", pinSpacerHeight: 0, sectionHeight: 2459.41, sectionTop: 1612.8, stageHeight: 0, storyHeight: 2043.41, storyTop: 1964.8, travel: 0 },
  "static-1024-639": { documentHeight: 2622, introStoryGap: 48, mode: "static", pinSpacerHeight: 0, sectionHeight: 1373.28, sectionTop: 1163.98, stageHeight: 0, storyHeight: 977.28, storyTop: 1463.98, travel: 0 },
};

const connectedSection = (page: Page) =>
  page.getByRole("region", { name: "The workspace adapts around your search." });
const connectedReveal = (page: Page) =>
  connectedSection(page).locator(":scope > [data-landing-viewport-reveal]");
const story = (page: Page) => connectedSection(page).locator("[data-scroll-story]");
const stage = (page: Page) => connectedSection(page).locator("[data-scroll-story-pin]");

async function scrollInstantly(page: Page, y: number | "bottom") {
  const target = await page.evaluate((destination) => {
    document.documentElement.style.scrollBehavior = "auto";
    const nextY = destination === "bottom" ? document.documentElement.scrollHeight : destination;
    window.scrollTo(0, nextY);
    return Math.round(Math.max(0, Math.min(nextY, document.documentElement.scrollHeight - innerHeight)));
  }, y);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(target);
}

async function revealEntryY(page: Page) {
  return connectedReveal(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const translateY = new DOMMatrix(getComputedStyle(element).transform).m42;
    return rect.top - translateY + scrollY - innerHeight * 0.88;
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(0);
}

async function installRestoredScrollHandshake(page: Page) {
  await page.addInitScript(() => {
    const storedTarget = window.sessionStorage.getItem("m6-f1-restored-y");
    if (storedTarget === null) return;
    window.sessionStorage.removeItem("m6-f1-restored-y");
    // Deliver restoration between the real native sample and the application
    // callback. rAF-vs-IO ordering never guaranteed this stale-sample scenario.
    (window as typeof window & { m6RestoreTarget?: number }).m6RestoreTarget = Number(storedTarget);
  });
}

async function queueRestoredScroll(page: Page, targetY: number) {
  await page.evaluate((nextY) => {
    window.sessionStorage.setItem("m6-f1-restored-y", String(nextY));
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, targetY);
}

test.beforeEach(async ({ page }) => {
  await installDeterministicApi(page);
  await page.addInitScript(() => {
    type Runtime = {
      animationStarts: number;
      initialDocumentHeight: number;
      pinSpacerHeights: number[];
      revealCallbackSamples: Array<{
        currentBottom: number;
        currentTop: number;
        entryIntersecting: boolean;
        entryTop: number;
      }>;
      revealDisconnects: number;
      revealFrames: Array<{ opacity: number; state: string | null; transform: string }>;
      revealObserveHeights: number[];
      revealRootMargins: string[];
      restoredHandshake: {
        callbackDeliveries: number;
        currentBottom: number;
        currentTop: number;
        eventOrder: string[];
        phase: string;
        staleBottom: number;
        staleTop: number;
        targetY: number;
      } | null;
    };
    const browserState = window as typeof window & { m6Runtime?: Runtime };
    browserState.m6Runtime = {
      animationStarts: 0,
      initialDocumentHeight: 0,
      pinSpacerHeights: [],
      revealCallbackSamples: [],
      revealDisconnects: 0,
      revealFrames: [],
      revealObserveHeights: [],
      revealRootMargins: [],
      restoredHandshake: null,
    };
    document.addEventListener("DOMContentLoaded", () => {
      browserState.m6Runtime!.initialDocumentHeight = document.documentElement.scrollHeight;
    });
    document.addEventListener("animationstart", (event) => {
      if (
        event.target instanceof Element
        && event.target.matches('section[aria-labelledby="proof-title"] > [data-landing-viewport-reveal]')
      ) {
        browserState.m6Runtime!.animationStarts += 1;
      }
    });

    const NativeIntersectionObserver = window.IntersectionObserver;
    class RecordingIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null;
      readonly rootMargin: string;
      readonly thresholds: readonly number[];
      private readonly observer: IntersectionObserver;
      private readonly callback: IntersectionObserverCallback;
      private observesConnectedReveal = false;

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback;
        this.observer = new NativeIntersectionObserver((entries) => {
          const revealEntry = entries.find((entry) =>
            entry.target.parentElement?.matches('section[aria-labelledby="proof-title"]'),
          );
          if (revealEntry) {
            const current = revealEntry.target.getBoundingClientRect();
            browserState.m6Runtime!.revealCallbackSamples.push({
              currentBottom: current.bottom,
              currentTop: current.top,
              entryIntersecting: revealEntry.isIntersecting,
              entryTop: revealEntry.boundingClientRect.top,
            });
          }
          this.callback(entries, this);
        }, options);
        this.root = this.observer.root;
        this.rootMargin = this.observer.rootMargin;
        this.thresholds = this.observer.thresholds;
      }

      disconnect() {
        if (this.observesConnectedReveal) {
          browserState.m6Runtime!.restoredHandshake?.eventOrder.push("observer-disconnected");
          browserState.m6Runtime!.revealDisconnects += 1;
          this.observesConnectedReveal = false;
        }
        this.observer.disconnect();
      }
      observe(target: Element) {
        if (target.parentElement?.matches('section[aria-labelledby="proof-title"]')) {
          this.observesConnectedReveal = true;
          browserState.m6Runtime!.revealObserveHeights.push(document.documentElement.scrollHeight);
          browserState.m6Runtime!.revealRootMargins.push(this.rootMargin);
          const restoration = window as typeof window & { m6RestoreTarget?: number };
          if (restoration.m6RestoreTarget !== undefined) {
            const staleRect = target.getBoundingClientRect();
            const staleBounds = DOMRect.fromRect({
              height: staleRect.height,
              width: staleRect.width,
              x: staleRect.x,
              y: staleRect.y,
            });
            const targetY = restoration.m6RestoreTarget;
            const handshake = {
              callbackDeliveries: 0,
              currentBottom: staleBounds.bottom,
              currentTop: staleBounds.top,
              eventOrder: ["observer-created", "stale-snapshot-captured"],
              phase: "stale-snapshot-captured",
              staleBottom: staleBounds.bottom,
              staleTop: staleBounds.top,
              targetY,
            };
            browserState.m6Runtime!.restoredHandshake = handshake;

            window.scrollTo({ top: targetY, behavior: "instant" });
            delete restoration.m6RestoreTarget;
            handshake.eventOrder.push("restoration-applied");
            const current = target.getBoundingClientRect();
            handshake.currentBottom = current.bottom;
            handshake.currentTop = current.top;
            handshake.phase = "current-geometry-confirmed";
            handshake.eventOrder.push("current-geometry-confirmed");

            queueMicrotask(() => {
              if (!this.observesConnectedReveal) {
                handshake.phase = "delivery-cancelled";
                handshake.eventOrder.push("delivery-cancelled");
                return;
              }
              handshake.phase = "callback-released";
              handshake.eventOrder.push("callback-released");
              handshake.callbackDeliveries += 1;
              const staleEntry: IntersectionObserverEntry = {
                boundingClientRect: staleBounds,
                intersectionRatio: 0,
                intersectionRect: DOMRect.fromRect(),
                isIntersecting: false,
                rootBounds: null,
                target,
                time: performance.now(),
              };
              const currentAtDelivery = target.getBoundingClientRect();
              browserState.m6Runtime!.revealCallbackSamples.push({
                currentBottom: currentAtDelivery.bottom,
                currentTop: currentAtDelivery.top,
                entryIntersecting: staleEntry.isIntersecting,
                entryTop: staleEntry.boundingClientRect.top,
              });
              this.callback([staleEntry], this);
              handshake.phase = "reconciliation-returned";
              handshake.eventOrder.push("reconciliation-returned");
            });
            return;
          }
        }
        this.observer.observe(target);
      }
      takeRecords() { return this.observer.takeRecords(); }
      unobserve(target: Element) { this.observer.unobserve(target); }
    }
    window.IntersectionObserver = RecordingIntersectionObserver;

    const mutationObserver = new MutationObserver(() => {
      const spacer = document.querySelector(".pin-spacer");
      if (spacer && !spacer.hasAttribute("data-m6-recorded")) {
        spacer.setAttribute("data-m6-recorded", "true");
        requestAnimationFrame(() => {
          browserState.m6Runtime!.pinSpacerHeights.push(document.documentElement.scrollHeight);
        });
      }
      const reveal = document.querySelector<HTMLElement>(
        'section[aria-labelledby="proof-title"] > [data-landing-viewport-reveal]',
      );
      if (!reveal || reveal.dataset.m6Sampling) return;
      reveal.dataset.m6Sampling = "true";
      let remaining = 16;
      const sample = () => {
        const style = getComputedStyle(reveal);
        browserState.m6Runtime!.revealFrames.push({
          opacity: Number(style.opacity),
          state: reveal.getAttribute("data-reveal-state"),
          transform: style.transform,
        });
        remaining -= 1;
        if (remaining > 0) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    mutationObserver.observe(document, { childList: true, subtree: true });
  });
});

test("keeps the intro boundary and frozen geometry exact across the mode matrix", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const baseline = baselines[testInfo.project.name];
  expect(baseline).toBeDefined();
  await expect(story(page)).toHaveAttribute("data-scroll-mode", baseline.mode);

  const measured = await connectedSection(page).evaluate((section) => {
    const reveal = section.querySelector<HTMLElement>(":scope > [data-landing-viewport-reveal]")!;
    const storyRoot = section.querySelector<HTMLElement>("[data-scroll-story]")!;
    const pin = section.querySelector<HTMLElement>("[data-scroll-story-pin]");
    const spacer = pin?.parentElement?.classList.contains("pin-spacer") ? pin.parentElement : null;
    const revealRect = reveal.getBoundingClientRect();
    const revealTranslateY = new DOMMatrix(getComputedStyle(reveal).transform).m42;
    const storyRect = storyRoot.getBoundingClientRect();
    const pinRect = pin?.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const legacy = section.parentElement!;
    const legacyStyle = getComputedStyle(legacy);
    return {
      documentHeight: document.documentElement.scrollHeight,
      quietCodaHeight: document.querySelector<HTMLElement>("[data-quiet-coda]")!
        .getBoundingClientRect().height,
      sectionTop: sectionRect.top + scrollY,
      sectionHeight: sectionRect.height,
      storyTop: storyRect.top + scrollY,
      storyHeight: storyRect.height,
      stageHeight: pinRect?.height ?? 0,
      pinSpacerHeight: spacer?.getBoundingClientRect().height ?? 0,
      introStoryGap: storyRect.top - (revealRect.bottom - revealTranslateY),
      revealContainsStory: reveal.contains(storyRoot),
      revealIsStoryAncestor: storyRoot.closest("[data-landing-viewport-reveal]") !== null,
      revealLayoutTop: revealRect.top - revealTranslateY + scrollY,
      legacyClass: legacy.className,
      legacyOpacity: legacyStyle.opacity,
      legacyTransform: legacyStyle.transform,
      storyParentIsSection: storyRoot.parentElement === section,
      revealParentIsSection: reveal.parentElement === section,
    };
  });

  for (const key of ["sectionTop", "sectionHeight", "storyTop", "storyHeight", "stageHeight", "pinSpacerHeight", "introStoryGap"] as const) {
    expect(Math.abs(measured[key] - baseline[key]), `${key} changed`).toBeLessThan(0.75);
  }
  expect(
    Math.abs(measured.documentHeight - measured.quietCodaHeight - baseline.documentHeight),
    "only Quiet Coda may extend the frozen landing geometry",
  ).toBeLessThan(0.75);
  expect(measured.revealLayoutTop).toBeGreaterThan(baseline.sectionTop);
  expect(measured.revealContainsStory).toBe(false);
  expect(measured.revealIsStoryAncestor).toBe(false);
  expect(measured.storyParentIsSection).toBe(true);
  expect(measured.revealParentIsSection).toBe(true);
  expect(measured.legacyClass).toContain("hf-section-reveal");
  expect(measured.legacyClass).toContain("hf-scroll-story-reveal");
  expect(measured.legacyOpacity).toBe("1");
  expect(measured.legacyTransform).toBe("none");
  await expect(connectedReveal(page)).toContainText("Connected workspace");
  await expect(connectedReveal(page)).toContainText("The workspace adapts around your search.");
  await expect(connectedReveal(page)).toContainText("Follow one opportunity through the search while the bigger picture stays connected.");
  await expect(connectedReveal(page).locator("[data-scroll-story], [data-scroll-story-pin], [data-workspace-shell]")).toHaveCount(0);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.waitForTimeout(350);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  const frames = await page.evaluate(() => (window as typeof window & { m6Runtime?: { revealFrames: Array<{ opacity: number; state: string | null }> } }).m6Runtime?.revealFrames ?? []);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.every((frame) => frame.state === "pending" && frame.opacity === 0)).toBe(true);
  expect(await page.locator(".pin-spacer").count()).toBe(baseline.mode === "static" ? 0 : 1);
  const entryY = await revealEntryY(page);
  await scrollInstantly(page, entryY + 4);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-motion", "entry");
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { m6Runtime?: { animationStarts: number } })
      .m6Runtime!.animationStarts)).toBe(1);
  await scrollInstantly(page, 0);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include('section[aria-labelledby="proof-title"] > [data-landing-viewport-reveal]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("keeps reveal transforms outside runtime pin ancestry and preserves chapter mapping", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "full-1280", "Full runtime ancestry is sampled once.");
  await page.goto("/");
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "full");
  const baseline = baselines["full-1280"];
  const start = baseline.storyTop;
  const end = start + baseline.travel;
  const inspectAncestry = async () => stage(page).evaluate((element) => {
    const ancestors: Array<{ className: string; reveal: boolean; transform: string }> = [];
    let current: HTMLElement | null = element;
    while (current) {
      ancestors.push({
        className: current.className,
        reveal: current.hasAttribute("data-landing-viewport-reveal"),
        transform: getComputedStyle(current).transform,
      });
      current = current.parentElement;
    }
    return {
      ancestors,
      parentIsPinSpacer: element.parentElement?.classList.contains("pin-spacer") ?? false,
      position: getComputedStyle(element).position,
      top: element.getBoundingClientRect().top,
      legacyTransform: getComputedStyle(document.querySelector(".hf-scroll-story-reveal")!).transform,
    };
  });

  await scrollInstantly(page, start - 2);
  const before = await inspectAncestry();
  expect(before.position).not.toBe("fixed");
  expect(before.parentIsPinSpacer).toBe(true);
  expect(before.ancestors.some((ancestor) => ancestor.reveal)).toBe(false);
  expect(before.legacyTransform).toBe("none");

  for (const [progress, chapter] of [
    [0.1, "applications"],
    [0.25, "interviews"],
    [0.55, "preparation"],
    [0.81, "action-center"],
  ] as const) {
    await scrollInstantly(page, start + baseline.travel * progress);
    await page.waitForTimeout(450);
    await expect(story(page)).toHaveAttribute("data-active-chapter", chapter);
    expect(Math.abs((await inspectAncestry()).top)).toBeLessThan(3);
  }
  const during = await inspectAncestry();
  expect(during.position).toBe("fixed");
  expect(during.ancestors.some((ancestor) => ancestor.reveal)).toBe(false);
  expect(during.legacyTransform).toBe("none");

  for (const [progress, chapter] of [
    [0.68, "preparation"],
    [0.3, "interviews"],
    [0.1, "applications"],
  ] as const) {
    await scrollInstantly(page, start + baseline.travel * progress);
    await page.waitForTimeout(450);
    await expect(story(page)).toHaveAttribute("data-active-chapter", chapter);
  }
  await scrollInstantly(page, end + 2);
  await page.waitForTimeout(450);
  const after = await inspectAncestry();
  expect(after.position).not.toBe("fixed");
  expect(after.ancestors.some((ancestor) => ancestor.reveal)).toBe(false);
  expect(after.legacyTransform).toBe("none");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
});

test("runtime pin spacing cannot strand the intro in full or adapted mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "full-1280", "Safety-corridor lifecycle runs once per pinned mode.");
  const verifyMode = async (width: number, height: number, baseline: GeometryBaseline) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(story(page)).toHaveAttribute("data-scroll-mode", baseline.mode);
    await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
    await expect(page.locator(".pin-spacer")).toHaveCount(1);
    const runtime = await page.evaluate(() => (window as typeof window & { m6Runtime?: { pinSpacerHeights: number[]; revealObserveHeights: number[]; revealRootMargins: string[] } }).m6Runtime!);
    expect(runtime.revealObserveHeights).toHaveLength(1);
    expect(runtime.pinSpacerHeights.length).toBeGreaterThanOrEqual(1);
    expect(runtime.revealRootMargins).toHaveLength(1);
    expect(runtime.revealRootMargins[0]).toContain(`${Math.ceil(runtime.revealObserveHeights[0])}px`);
    const { codaHeight, establishedDocumentHeight } = await page.evaluate(() => ({
      codaHeight: document.querySelector<HTMLElement>("[data-quiet-coda]")!
        .getBoundingClientRect().height,
      establishedDocumentHeight: document.documentElement.scrollHeight,
    }));
    expect(Math.abs(establishedDocumentHeight - codaHeight - baseline.documentHeight)).toBeLessThan(0.75);
    console.log("M6_PIN_SPACING", {
      delta: establishedDocumentHeight - runtime.revealObserveHeights[0],
      establishedDocumentHeight,
      mode: baseline.mode,
      observerDocumentHeight: runtime.revealObserveHeights[0],
    });

    await scrollInstantly(page, baseline.storyTop + baseline.travel + 100);
    await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
    await expect(connectedReveal(page)).toHaveAttribute("data-reveal-motion", "none");
    expect(await stage(page).evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
    await scrollInstantly(page, 0);
    await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
    expect(await page.evaluate(() => (window as typeof window & { m6Runtime?: { animationStarts: number } }).m6Runtime!.animationStarts)).toBe(0);
    await expect(page.locator(".pin-spacer")).toHaveCount(1);
  };

  await verifyMode(1280, 800, baselines["full-1280"]);
  await verifyMode(900, 720, baselines["adapted-900"]);
});

test("pending intro survives resize boundaries, reduced motion, and route remount", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "full-1280", "Cross-mode lifecycle chain runs once.");
  await page.goto("/");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "static");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  const narrowEntry = await revealEntryY(page);
  await scrollInstantly(page, narrowEntry - 4);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await scrollInstantly(page, narrowEntry + 4);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as typeof window & { m6Runtime?: { animationStarts: number } }).m6Runtime!.animationStarts)).toBe(1);

  await scrollInstantly(page, 0);
  await page.reload();
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await scrollInstantly(page, "bottom");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await scrollInstantly(page, 0);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");

  await page.reload();
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.setViewportSize({ width: 1024, height: 720 });
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "full");
  await page.setViewportSize({ width: 1024, height: 719 });
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "adapted");
  await page.setViewportSize({ width: 1023, height: 720 });
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await scrollInstantly(page, "bottom");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-motion", "none");
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "static");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await page.reload();
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "static");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await scrollInstantly(page, 0);
  await page.getByRole("button", { name: "Continue Demo" }).first().click();
  await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test("restored and throttled entry stays fail-visible while page-level motion remains independent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "full-1280", "Rendered handoff and restoration run once.");
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await installRestoredScrollHandshake(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & {
      m6Runtime?: { revealObserveHeights: number[] };
    }).m6Runtime?.revealObserveHeights.length ?? 0,
  )).toBeGreaterThan(0);
  const benefitsTrack = page.locator("[data-benefits-track]");
  await expect(benefitsTrack).toHaveAttribute("data-motion-ready", "true");
  const entryY = await revealEntryY(page);
  await scrollInstantly(page, entryY - 8);
  await scrollInstantly(page, entryY + 4);

  const samples: Array<{ introOpacity: number; trackX: number }> = [];
  for (let index = 0; index < 7; index += 1) {
    samples.push(await connectedReveal(page).evaluate((element) => ({
      introOpacity: Number(getComputedStyle(element).opacity),
      trackX: new DOMMatrix(getComputedStyle(document.querySelector("[data-benefits-track]")!).transform).m41,
    })));
    await page.waitForTimeout(45);
  }
  expect(samples.at(-1)?.introOpacity).toBe(1);
  expect(samples.every((sample, index) => index === 0 || sample.introOpacity >= samples[index - 1].introOpacity)).toBe(true);
  expect(samples.at(-1)!.trackX).toBeLessThan(samples[0].trackX - 2);
  await expect(connectedReveal(page)).toHaveCSS("transform", "none");

  const baseline = baselines["full-1280"];
  await scrollInstantly(page, baseline.storyTop + baseline.travel * 0.05);
  await expect(story(page)).toHaveAttribute("data-active-chapter", "applications");
  // Keep this synthetic native-restoration target reachable before runtime pin
  // spacing exists. The adapted companion below restores directly into
  // Preparation, while this throttled branch verifies the stale-sample
  // handshake within the full-mode pin.
  await scrollInstantly(page, baseline.storyTop + baseline.travel * 0.3);
  await expect(story(page)).toHaveAttribute("data-active-chapter", "interviews");
  const restoredY = await page.evaluate(() => scrollY);
  await queueRestoredScroll(page, restoredY);
  await page.reload();
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & {
      m6Runtime?: { restoredHandshake: { phase: string } | null };
    }).m6Runtime?.restoredHandshake?.phase,
  )).toBe("reconciliation-returned");
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(restoredY - 2);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-motion", "none");
  await expect(story(page)).toHaveAttribute("data-active-chapter", "interviews");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  const fullRuntime = await page.evaluate(() => (window as typeof window & {
    m6Runtime?: {
      animationStarts: number;
      revealCallbackSamples: Array<{
        currentBottom: number;
        entryIntersecting: boolean;
      }>;
      revealDisconnects: number;
      revealObserveHeights: number[];
      restoredHandshake: {
        callbackDeliveries: number;
        currentBottom: number;
        currentTop: number;
        eventOrder: string[];
        phase: string;
        staleBottom: number;
        staleTop: number;
        targetY: number;
      } | null;
    };
  }).m6Runtime!);
  expect(fullRuntime.revealCallbackSamples[0]?.entryIntersecting).toBe(false);
  expect(fullRuntime.revealCallbackSamples[0]?.currentBottom).toBeLessThanOrEqual(0);
  expect(fullRuntime.restoredHandshake).toMatchObject({
    callbackDeliveries: 1,
    eventOrder: [
      "observer-created",
      "stale-snapshot-captured",
      "restoration-applied",
      "current-geometry-confirmed",
      "callback-released",
      "observer-disconnected",
      "reconciliation-returned",
    ],
    phase: "reconciliation-returned",
    targetY: restoredY,
  });
  expect(fullRuntime.restoredHandshake!.staleTop).toBeGreaterThanOrEqual(801);
  expect(fullRuntime.restoredHandshake!.currentBottom).toBeLessThanOrEqual(0);
  expect(fullRuntime.restoredHandshake!.staleTop).toBeGreaterThan(
    fullRuntime.restoredHandshake!.currentTop,
  );
  expect(fullRuntime.revealDisconnects).toBe(1);
  expect(fullRuntime.animationStarts).toBe(0);
  // Content-fit eligibility starts from the fail-visible Static DOM before pinning.
  // Quiet Coda is downstream of Connected Workspace, so remove only its height
  // before comparing the frozen pre-Coda geometry.
  const fullCodaHeight = await page.locator("[data-quiet-coda]").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(fullRuntime.revealObserveHeights.map((height) => height - fullCodaHeight)).toEqual([2460]);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight) - fullCodaHeight,
  ).toBe(4395);
  await scrollInstantly(page, baseline.storyTop + baseline.travel * 0.9);
  await expect(story(page)).toHaveAttribute("data-active-chapter", "action-center");
  await scrollInstantly(page, baseline.storyTop + baseline.travel * 0.3);
  await expect(story(page)).toHaveAttribute("data-active-chapter", "interviews");
  await scrollInstantly(page, baseline.storyTop + baseline.travel + 2);
  await expect.poll(() => stage(page).evaluate(
    (element) => getComputedStyle(element).position,
  )).not.toBe("fixed");
  await scrollInstantly(page, baseline.storyTop + baseline.travel * 0.68);
  await expect(story(page)).toHaveAttribute("data-active-chapter", "preparation");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});

test("adapted runtime spacing reconciles a stale restored-scroll handshake", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "full-1280", "Adapted restored-scroll reproduction runs once.");
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  // This test controls sample -> restoration -> callback ordering, not elapsed
  // watchdog time. The preceding test retains the 4x-CPU fail-visible coverage.
  await installRestoredScrollHandshake(page);
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto("/");

  const adaptedBaseline = baselines["adapted-900"];
  await expect(story(page)).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await scrollInstantly(page, adaptedBaseline.storyTop + adaptedBaseline.travel * 0.55);
  await expect(story(page)).toHaveAttribute("data-active-chapter", "preparation");
  const restoredY = await page.evaluate(() => scrollY);
  await queueRestoredScroll(page, restoredY);
  await page.reload();

  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(restoredY - 2);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-motion", "none");
  await expect(story(page)).toHaveAttribute("data-active-chapter", "preparation");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  const runtime = await page.evaluate(() => (window as typeof window & {
    m6Runtime?: {
      animationStarts: number;
      revealCallbackSamples: Array<{
        currentBottom: number;
        entryIntersecting: boolean;
      }>;
      revealDisconnects: number;
      revealObserveHeights: number[];
      restoredHandshake: {
        callbackDeliveries: number;
        currentBottom: number;
        eventOrder: string[];
        phase: string;
        staleTop: number;
        targetY: number;
      } | null;
    };
  }).m6Runtime!);
  expect(runtime.revealCallbackSamples[0]?.entryIntersecting).toBe(false);
  expect(runtime.revealCallbackSamples[0]?.currentBottom).toBeLessThanOrEqual(0);
  expect(runtime.restoredHandshake).toMatchObject({
    callbackDeliveries: 1,
    phase: "reconciliation-returned",
    targetY: restoredY,
  });
  expect(runtime.restoredHandshake!.staleTop).toBeGreaterThanOrEqual(721);
  expect(runtime.restoredHandshake!.currentBottom).toBeLessThanOrEqual(0);
  expect(runtime.revealDisconnects).toBe(1);
  expect(runtime.animationStarts).toBe(0);
  const adaptedCodaHeight = await page.locator("[data-quiet-coda]").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(runtime.revealObserveHeights.map((height) => height - adaptedCodaHeight)).toEqual([2875]);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight) - adaptedCodaHeight,
  ).toBe(4106);
  await scrollInstantly(page, 0);
  await expect(connectedReveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expectNoHorizontalOverflow(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
