import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const reveal = (page: Page, id: string) =>
  page.locator(`[data-m4-id="${id}"] [data-landing-viewport-reveal]`);

async function loadHarness(page: Page) {
  await page.goto("/harness/m4/index.html");
  await expect(reveal(page, "intersecting")).toHaveAttribute("data-reveal-state", "revealed");
}

async function scrollInstantly(page: Page, y: number | "bottom") {
  const target = await page.evaluate((destination) => {
    document.documentElement.style.scrollBehavior = "auto";
    const nextY = destination === "bottom" ? document.documentElement.scrollHeight : destination;
    window.scrollTo(0, nextY);
    return Math.max(
      0,
      Math.min(nextY, document.documentElement.scrollHeight - window.innerHeight),
    );
  }, y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(target);
}

test("real geometry, entry, once-only behavior, focus, fast scroll, and remount remain safe", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await loadHarness(page);

  const intersecting = reveal(page, "intersecting");
  const nearBoundary = reveal(page, "near-boundary");
  const below = reveal(page, "below");
  const focusPending = reveal(page, "focus-pending");
  const fastScrollTarget = reveal(page, "fast-pending");

  await expect(intersecting).toHaveCSS("opacity", "1");
  await expect(intersecting).toHaveCSS("transform", "none");
  await expect(nearBoundary).toHaveAttribute("data-reveal-state", "revealed");
  await expect(nearBoundary).toHaveCSS("opacity", "1");
  await expect(below).toHaveAttribute("data-reveal-state", "pending");
  await expect(focusPending).toHaveAttribute("data-reveal-state", "pending");
  await expect(fastScrollTarget).toHaveAttribute("data-reveal-state", "pending");
  await page.waitForTimeout(400);
  await expect(below).toHaveAttribute("data-reveal-state", "pending");
  const pendingGeometry = await below.evaluate((element) => ({
    documentHeight: document.documentElement.scrollHeight,
    height: (element as HTMLElement).offsetHeight,
    width: (element as HTMLElement).offsetWidth,
  }));

  const initialFrames = await page.evaluate(() => window.__m4PaintFrames);
  expect(initialFrames.intersecting?.every((frame) => frame.state === "revealed" && frame.opacity === "1")).toBe(true);
  expect(initialFrames["near-boundary"]?.every((frame) => frame.state === "revealed" && frame.opacity === "1")).toBe(true);
  expect(initialFrames.below?.[0]?.state).toBe("pending");

  await below.scrollIntoViewIfNeeded();
  await expect(below).toHaveAttribute("data-reveal-state", "revealed");
  await expect(below).toHaveAttribute("data-reveal-motion", "entry");
  await expect(below).toHaveCSS("opacity", "1");
  await page.waitForTimeout(250);
  expect(await below.evaluate((element) => ({
    documentHeight: document.documentElement.scrollHeight,
    height: (element as HTMLElement).offsetHeight,
    width: (element as HTMLElement).offsetWidth,
  }))).toEqual(pendingGeometry);
  const firstAnimationCount = await page.evaluate(() => window.__m4AnimationStarts.below ?? 0);
  expect(firstAnimationCount).toBe(1);

  await scrollInstantly(page, 0);
  await below.scrollIntoViewIfNeeded();
  await expect(below).toHaveAttribute("data-reveal-state", "revealed");
  expect(await page.evaluate(() => window.__m4AnimationStarts.below ?? 0)).toBe(firstAnimationCount);

  await scrollInstantly(page, 0);
  await expect(focusPending).toHaveAttribute("data-reveal-state", "pending");
  const focusTarget = focusPending.locator("[data-m4-focus-target]");
  await focusTarget.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  await expect(focusTarget).toBeFocused();
  await expect(focusPending).toHaveAttribute("data-reveal-state", "revealed");
  await expect(focusPending).toHaveAttribute("data-reveal-motion", "none");
  await focusTarget.evaluate((element) => (element as HTMLElement).blur());
  await expect(focusPending).toHaveAttribute("data-reveal-state", "revealed");

  await scrollInstantly(page, 0);
  await expect(fastScrollTarget).toHaveAttribute("data-reveal-state", "pending");
  await scrollInstantly(page, "bottom");
  await expect(fastScrollTarget).toHaveAttribute("data-reveal-state", "revealed");
  await scrollInstantly(page, 0);
  await expect(fastScrollTarget).toHaveAttribute("data-reveal-state", "revealed");

  await page.reload();
  await expect(reveal(page, "below")).toHaveAttribute("data-reveal-state", "pending");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(await page.locator("[data-m4-card]").count()).toBeGreaterThanOrEqual(3);
  expect(browserErrors).toEqual([]);
});

test("restored-scroll mount and supported fail-open paths are final-visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Adversarial lifecycle sample runs once.");
  await loadHarness(page);

  await scrollInstantly(page, "bottom");
  await page.evaluate(() => window.__m4Harness?.mountPassed());
  const passed = reveal(page, "passed");
  await expect(passed).toHaveAttribute("data-reveal-state", "revealed");
  await expect(passed).toHaveAttribute("data-reveal-motion", "none");
  await expect(passed).toHaveCSS("opacity", "1");

  for (const failure of ["missing", "constructor", "observe", "handshake"] as const) {
    const failurePage = await page.context().newPage();
    await failurePage.addInitScript((mode) => {
      if (mode === "missing") {
        Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
      } else if (mode === "constructor") {
        Object.defineProperty(window, "IntersectionObserver", {
          configurable: true,
          value: class { constructor() { throw new Error("M4 constructor failure"); } },
        });
      } else {
        Object.defineProperty(window, "IntersectionObserver", {
          configurable: true,
          value: class {
            disconnect() {}
            observe() { if (mode === "observe") throw new Error("M4 observe failure"); }
            takeRecords() { return []; }
            unobserve() {}
          },
        });
      }
    }, failure);
    await failurePage.goto("/harness/m4/index.html");
    const failedBelow = reveal(failurePage, "below");
    if (failure === "handshake") {
      await expect(failedBelow).toHaveAttribute("data-reveal-state", "pending");
      await expect(failedBelow).toHaveAttribute("data-reveal-state", "revealed", { timeout: 1_000 });
    } else {
      await expect(failedBelow).toHaveAttribute("data-reveal-state", "revealed");
    }
    await expect(failedBelow).toHaveAttribute("data-reveal-motion", "none");
    await expect(failedBelow).toHaveCSS("opacity", "1");
    expect(await failurePage.evaluate(() => window.__m4AnimationStarts.below ?? 0)).toBe(0);
    await failurePage.close();
  }
});

test("live reduced motion resolves a pending instance permanently", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Preference lifecycle sample runs once.");
  await loadHarness(page);
  const below = reveal(page, "below");
  await expect(below).toHaveAttribute("data-reveal-state", "pending");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(below).toHaveAttribute("data-reveal-state", "revealed");
  await expect(below).toHaveAttribute("data-reveal-motion", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(below).toHaveAttribute("data-reveal-state", "revealed");
  expect(await page.evaluate(() => window.__m4AnimationStarts.below ?? 0)).toBe(0);
});

test("fresh reduced-motion mount is visible and the harness is accessible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Accessibility sample runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadHarness(page);
  await expect(reveal(page, "below")).toHaveAttribute("data-reveal-state", "revealed");
  await expect(reveal(page, "below")).toHaveCSS("opacity", "1");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("visible geometry never paints backward under CPU throttling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Paint torture sample runs once.");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await loadHarness(page);
  await page.waitForTimeout(500);

  const frames = await page.evaluate(() => window.__m4PaintFrames);
  for (const id of ["intersecting", "near-boundary"]) {
    expect(frames[id]?.length).toBeGreaterThan(0);
    expect(frames[id]?.every((frame) => frame.state === "revealed")).toBe(true);
    expect(frames[id]?.every((frame) => frame.opacity === "1")).toBe(true);
    expect(frames[id]?.every((frame) => frame.transform === "none")).toBe(true);
  }
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
