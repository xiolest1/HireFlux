import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

interface BenefitsBaseline {
  enterY: number;
  introHeight: number;
  introTop: number;
  sectionHeight: number;
  sectionTop: number;
  sectionWidth: number;
  viewportHeight: number;
  viewportTop: number;
}

const baselines: Record<string, BenefitsBaseline> = {
  "desktop-1440": { enterY: 14.19, introHeight: 66, introTop: 842.19, sectionHeight: 304, sectionTop: 762.19, sectionWidth: 1280, viewportHeight: 134, viewportTop: 932.19 },
  "desktop-1280": { enterY: 114.19, introHeight: 66, introTop: 842.19, sectionHeight: 304, sectionTop: 762.19, sectionWidth: 1280, viewportHeight: 134, viewportTop: 932.19 },
  "desktop-1024": { enterY: 243.98, introHeight: 66, introTop: 939.98, sectionHeight: 304, sectionTop: 859.98, sectionWidth: 1024, viewportHeight: 134, viewportTop: 1029.98 },
  "compact-900": { enterY: 488.53, introHeight: 66, introTop: 1184.53, sectionHeight: 304, sectionTop: 1104.53, sectionWidth: 900, viewportHeight: 134, viewportTop: 1274.53 },
  "tablet-768": { enterY: 232.53, introHeight: 66, introTop: 1184.53, sectionHeight: 304, sectionTop: 1104.53, sectionWidth: 768, viewportHeight: 134, viewportTop: 1274.53 },
  "mobile-430": { enterY: 259.45, introHeight: 114, introTop: 1083.45, sectionHeight: 328, sectionTop: 1027.45, sectionWidth: 430, viewportHeight: 134, viewportTop: 1221.45 },
  "mobile-390": { enterY: 455.45, introHeight: 146, introTop: 1175.45, sectionHeight: 360, sectionTop: 1119.45, sectionWidth: 390, viewportHeight: 134, viewportTop: 1345.45 },
  "narrow-320": { enterY: 864.8, introHeight: 146, introTop: 1308.8, sectionHeight: 360, sectionTop: 1252.8, sectionWidth: 320, viewportHeight: 134, viewportTop: 1478.8 },
};

const region = (page: Page) =>
  page.getByRole("region", { name: "A clearer way through the search." });
const reveal = (page: Page) =>
  region(page).locator("[data-landing-viewport-reveal]");
const track = (page: Page) => region(page).locator("[data-benefits-track]");

async function scrollInstantly(page: Page, y: number | "bottom") {
  const target = await page.evaluate((destination) => {
    document.documentElement.style.scrollBehavior = "auto";
    const nextY = destination === "bottom" ? document.documentElement.scrollHeight : destination;
    window.scrollTo(0, nextY);
    return Math.round(
      Math.max(0, Math.min(nextY, document.documentElement.scrollHeight - innerHeight)),
    );
  }, y);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(target);
}

async function introEntryScrollY(page: Page) {
  return reveal(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + scrollY - innerHeight * 0.88;
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await installDeterministicApi(page);
  await page.addInitScript(() => {
    const browserState = window as typeof window & {
      m5AnimationStarts?: number;
      m5RevealFrames?: Array<{ opacity: string; state: string | null; transform: string }>;
    };
    browserState.m5AnimationStarts = 0;
    browserState.m5RevealFrames = [];
    document.addEventListener("animationstart", (event) => {
      if (event.target instanceof Element && event.target.matches("[data-landing-viewport-reveal]")) {
        browserState.m5AnimationStarts = (browserState.m5AnimationStarts ?? 0) + 1;
      }
    });
    new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>("[data-product-benefits] [data-landing-viewport-reveal]");
      if (!element || element.dataset.m5Sampling) return;
      element.dataset.m5Sampling = "true";
      let remaining = 16;
      const sample = () => {
        const style = getComputedStyle(element);
        browserState.m5RevealFrames?.push({
          opacity: style.opacity,
          state: element.getAttribute("data-reveal-state"),
          transform: style.transform,
        });
        remaining -= 1;
        if (remaining > 0) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }).observe(document, { childList: true, subtree: true });
  });
});

test("production intro boundary preserves frozen geometry and reveals once", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const expected = baselines[testInfo.project.name];
  expect(expected).toBeDefined();
  const benefits = region(page);
  const intro = reveal(page);
  const viewport = benefits.locator("[data-benefits-viewport]");

  await expect(intro).toContainText("Why HireFlux");
  await expect(intro).toContainText("A clearer way through the search.");
  await expect(intro.locator("[data-benefits-viewport], [data-benefits-track], [data-benefits-control]")).toHaveCount(0);
  expect(await benefits.evaluate((element) => {
    const revealRoot = element.querySelector("[data-landing-viewport-reveal]");
    return {
      controlsInsideReveal: revealRoot?.contains(element.querySelector("[data-benefits-control]")) ?? false,
      viewportInsideReveal: revealRoot?.contains(element.querySelector("[data-benefits-viewport]")) ?? false,
    };
  })).toEqual({ controlsInsideReveal: false, viewportInsideReveal: false });

  const geometry = await benefits.evaluate((element) => {
    const sectionRect = element.getBoundingClientRect();
    const introRect = element.querySelector<HTMLElement>("[data-landing-clip-check]")!.getBoundingClientRect();
    const viewportRect = element.querySelector<HTMLElement>("[data-benefits-viewport]")!.getBoundingClientRect();
    return {
      sectionTop: sectionRect.top + scrollY,
      sectionHeight: sectionRect.height,
      sectionWidth: sectionRect.width,
      introTop: introRect.top + scrollY,
      introHeight: introRect.height,
      viewportTop: viewportRect.top + scrollY,
      viewportHeight: viewportRect.height,
    };
  });
  for (const key of Object.keys(expected) as Array<keyof BenefitsBaseline>) {
    if (key === "enterY") continue;
    expect(Math.abs(geometry[key] - expected[key]), `${key} changed`).toBeLessThan(0.75);
  }

  const initiallyEligible = expected.introTop < page.viewportSize()!.height + 1;
  if (initiallyEligible) {
    await expect(intro).toHaveAttribute("data-reveal-state", "revealed");
    expect(await page.evaluate(() => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0)).toBe(0);
  } else {
    await expect(intro).toHaveAttribute("data-reveal-state", "pending");
    await page.waitForTimeout(350);
    await expect(intro).toHaveAttribute("data-reveal-state", "pending");
    const entryY = await introEntryScrollY(page);
    await scrollInstantly(page, Math.max(0, entryY - 4));
    await expect(intro).toHaveAttribute("data-reveal-state", "pending");
    await scrollInstantly(page, entryY + 4);
    await expect(intro).toHaveAttribute("data-reveal-state", "revealed");
    await expect(intro).toHaveAttribute("data-reveal-motion", "entry");
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0)).toBe(1);
  }

  await scrollInstantly(page, 0);
  await expect(track(page)).toHaveAttribute("data-passively-blocked", "true");
  await scrollInstantly(page, Math.max(0, expected.enterY - 3));
  await expect(track(page)).toHaveAttribute("data-passively-blocked", "true");
  await scrollInstantly(page, expected.enterY + 3);
  await expect(track(page)).toHaveAttribute("data-passively-blocked", "false");

  const animationCount = await page.evaluate(
    () => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0,
  );
  await scrollInstantly(page, "bottom");
  await scrollInstantly(page, 0);
  await expect(intro).toHaveAttribute("data-reveal-state", "revealed");
  expect(await page.evaluate(() => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0)).toBe(animationCount);

  const frames = await page.evaluate(
    () => (window as typeof window & { m5RevealFrames?: Array<{ opacity: string; state: string | null }> }).m5RevealFrames ?? [],
  );
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.every((frame) => frame.state === (initiallyEligible ? "revealed" : "pending"))).toBe(true);
  expect(frames.every((frame) => frame.opacity === (initiallyEligible ? "1" : "0"))).toBe(true);

  const loop = await track(page).evaluate((element) => ({
    distance: Number(element.dataset.loopDistance),
    duration: Number(element.dataset.loopDuration),
  }));
  expect(Math.abs(loop.distance / loop.duration - 28)).toBeLessThan(0.1);
  expect(await viewport.evaluate((element) => getComputedStyle(element).maskImage)).not.toBe("none");
  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page }).include("[data-product-benefits]").analyze();
  expect(accessibility.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("pending intro survives responsive crossings without coupling to the stream", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Responsive lifecycle chain runs once.");
  await page.goto("/");
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  const narrowEntry = await introEntryScrollY(page);
  await scrollInstantly(page, narrowEntry - 4);
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await scrollInstantly(page, narrowEntry + 4);
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0)).toBe(1);
  await scrollInstantly(page, 0);
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await scrollInstantly(page, "bottom");
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(reveal(page)).toHaveAttribute("data-reveal-motion", "none");
  await scrollInstantly(page, 0);
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  const tabletEntry = await introEntryScrollY(page);
  await scrollInstantly(page, tabletEntry + 4);
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  expect(await region(page).locator("[data-benefits-track]").count()).toBe(1);
  await expectNoHorizontalOverflow(page);
});

test("controls, route remount, and live reduced motion remain independent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Ownership lifecycle chain runs once.");
  await page.goto("/");
  const entryY = await introEntryScrollY(page);
  await scrollInstantly(page, entryY + 4);
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await page.waitForTimeout(250);
  const starts = await page.evaluate(() => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0);

  const benefits = region(page);
  await benefits.scrollIntoViewIfNeeded();
  const next = benefits.getByRole("button", { name: "Next benefit" });
  await next.focus();
  await next.click();
  await expect(track(page)).toHaveAttribute("data-motion-state", "manual");
  await expect(next).not.toHaveAttribute("aria-disabled");
  await benefits.getByRole("button", { name: "Previous benefit" }).click();
  await expect(benefits.getByRole("button", { name: "Previous benefit" })).not.toHaveAttribute("aria-disabled");
  await benefits.getByRole("button", { name: "Play benefit stream" }).click();
  await expect(track(page)).toHaveAttribute("data-motion-state", "ambient");
  await benefits.getByRole("button", { name: "Pause benefit stream" }).click();
  await expect(track(page)).toHaveAttribute("data-motion-state", "paused");
  await benefits.getByRole("button", { name: "Play benefit stream" }).click();
  await expect(track(page)).toHaveAttribute("data-motion-state", "ambient");
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  expect(await page.evaluate(() => (window as typeof window & { m5AnimationStarts?: number }).m5AnimationStarts ?? 0)).toBe(starts);

  await scrollInstantly(page, 0);
  await page.getByRole("button", { name: "Continue Demo" }).first().click();
  await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(region(page)).toBeVisible();
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  expect(await page.locator("[data-product-benefits]").count()).toBe(1);
  expect(await track(page).count()).toBe(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(reveal(page)).toHaveAttribute("data-reveal-motion", "none");
  await expect(region(page).locator("[data-benefits-viewport]")).toHaveAttribute("data-benefits-motion", "static");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(region(page).locator("[data-benefits-viewport]")).toHaveAttribute("data-benefits-motion", "ambient");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "revealed");
  await expect(reveal(page)).toHaveAttribute("data-reveal-motion", "none");
  await expect(region(page).locator("[data-benefits-viewport]")).toHaveAttribute("data-benefits-motion", "static");
});

test("real handoff keeps the quiet intro subordinate to the moving stream", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Rendered handoff sample runs once.");
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("/");
  await expect(reveal(page)).toHaveAttribute("data-reveal-state", "pending");
  await track(page).evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.currentTime = 10_000;
    animation.play();
  });
  const entryY = await introEntryScrollY(page);
  await scrollInstantly(page, entryY + 4);

  const samples: Array<{ opacity: number; x: number }> = [];
  for (let sample = 0; sample < 7; sample += 1) {
    samples.push(await reveal(page).evaluate((element) => ({
      opacity: Number(getComputedStyle(element).opacity),
      x: new DOMMatrix(getComputedStyle(
        element.closest("[data-product-benefits]")!.querySelector("[data-benefits-track]")!,
      ).transform).m41,
    })));
    await page.waitForTimeout(45);
  }
  expect(samples.at(-1)?.opacity).toBe(1);
  expect(samples.every((sample, index) => index === 0 || sample.opacity >= samples[index - 1].opacity)).toBe(true);
  expect(samples.at(-1)!.x).toBeLessThan(samples[0].x - 3);
  await expect(reveal(page)).toHaveCSS("transform", "none");
  await expectNoHorizontalOverflow(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
