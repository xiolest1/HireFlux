import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

const progressiveExplicitlyDisabled = process.env.VITE_CONNECTED_STORY_PROGRESSIVE_C === "off";
const story = (page: Page) => page.locator("[data-connected-story]");
const compact = (page: Page) => page.locator('section[data-connected-c-presentation="compact-progressive"]');

async function instrumentCompactObserver(page: Page) {
  await page.addInitScript(() => {
    const Original = window.IntersectionObserver;
    const counts = { created: 0, active: 0 };
    Object.defineProperty(window, "__hirefluxCompactObserverCounts", { value: counts });
    window.IntersectionObserver = class extends Original {
      private readonly compact: boolean;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        this.compact = options?.rootMargin === "-11% 0px -87% 0px";
        if (this.compact) {
          counts.created += 1;
          counts.active += 1;
        }
      }
      override disconnect() {
        if (this.compact) counts.active = Math.max(0, counts.active - 1);
        super.disconnect();
      }
    };
  });
}

async function openCompact(page: Page) {
  await instrumentCompactObserver(page);
  await installDeterministicApi(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(story(page)).toHaveAttribute("data-connected-family", "c");
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "compact-progressive");
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
}

async function placeChapterAtOwnershipLine(page: Page, chapter: string) {
  await compact(page).locator(`[data-connected-c-semantic-chapter="${chapter}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo({
      top: rect.top + window.scrollY - window.innerHeight * 0.12 + 2,
      behavior: "instant",
    });
  });
  await expect(compact(page)).toHaveAttribute("data-active-chapter", chapter);
}

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(progressiveExplicitlyDisabled, "Progressive-C was explicitly disabled");
  test.skip(testInfo.project.name !== "mobile-390");
});

test("compact Progressive-C is one accessible semantic story with one synchronized phone scene", async ({ page }) => {
  await openCompact(page);

  const measured = [];
  for (const chapter of ["applications", "interviews", "preparation", "action-center"]) {
    await placeChapterAtOwnershipLine(page, chapter);
    measured.push(await compact(page).evaluate((root) => {
      const scene = root.querySelector<HTMLElement>("[data-connected-c-compact-sticky-scene]")!;
      const workspace = root.querySelector<HTMLElement>("[data-connected-c-compact-workspace]")!;
      const endpoint = root.querySelector<HTMLElement>('[data-connected-c-compact-endpoint][data-active="true"]')!;
      const surface = endpoint.querySelector<HTMLElement>("[data-connected-compact-product-surface]")!;
      const sceneRect = scene.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      return {
        active: endpoint.dataset.connectedCCompactEndpoint,
        activeNarrative: root.querySelector("[data-connected-c-visual-narrative]")?.getAttribute("data-connected-visual-chapter"),
        activeCount: root.querySelectorAll('[data-connected-c-compact-endpoint][data-active="true"]').length,
        sceneHeight: sceneRect.height,
        sceneTop: sceneRect.top,
        sceneBottom: sceneRect.bottom,
        scenePosition: getComputedStyle(scene).position,
        shellHeight: workspaceRect.height,
        workspacePosition: getComputedStyle(workspace).position,
        surfaceOverflowX: surface.scrollWidth - surface.clientWidth,
        surfaceOverflowY: surface.scrollHeight - surface.clientHeight,
      };
    }));
  }

  expect(measured.map((state) => state.active)).toEqual(["applications", "interviews", "preparation", "action-center"]);
  expect(measured.map((state) => state.activeNarrative)).toEqual(["applications", "interviews", "preparation", "action-center"]);
  measured.forEach((state) => {
    expect(state.activeCount).toBe(1);
    expect(state.sceneHeight).toBeCloseTo(600, 0);
    expect(state.sceneBottom).toBeLessThanOrEqual(844 - 11);
    expect(state.scenePosition).toBe("sticky");
    expect(state.shellHeight).toBeCloseTo(420, 0);
    expect(state.workspacePosition).toBe("static");
    expect(state.surfaceOverflowX).toBeLessThanOrEqual(1);
    expect(state.surfaceOverflowY).toBeLessThanOrEqual(1);
  });
  expect(Math.max(...measured.map((state) => state.sceneTop)) - Math.min(...measured.map((state) => state.sceneTop))).toBeLessThanOrEqual(1);

  await expect(compact(page).locator("[data-connected-c-semantic-track] > li")).toHaveCount(4);
  await expect(compact(page).locator("[data-connected-c-semantic-copy].sr-only")).toHaveCount(4);
  await expect(compact(page).getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(compact(page).locator("[data-connected-c-compact-sticky-owner]")).toHaveCount(1);
  await expect(compact(page).locator("[data-connected-c-compact-sticky-owner]")).toHaveAttribute("aria-hidden", "true");
  await expect(compact(page).locator("[data-connected-c-compact-sticky-owner] [data-connected-c-visual-narrative]")).toHaveCount(1);
  await expect(compact(page).locator("[data-connected-c-compact-sticky-owner] [data-connected-c-compact-workspace]")).toHaveCount(1);
  expect(await compact(page).locator("[data-connected-c-semantic-copy]").evaluateAll((copies) => copies.filter((copy) => {
    const rect = copy.getBoundingClientRect();
    return rect.width > 2 || rect.height > 2;
  }).length)).toBe(0);
  await expect(compact(page).locator("[data-connected-c-compact-workspace]")).toHaveAttribute("aria-hidden", "true");
  await expect(compact(page).locator("[data-connected-c-compact-workspace]")).toHaveAttribute("inert", "");
  await expect(compact(page).locator("[aria-live]")).toHaveCount(0);
  await expect(compact(page).locator("button, a, input, [tabindex]")).toHaveCount(0);
  await expect(compact(page).locator(".pin-spacer")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => (
    window as unknown as { __hirefluxCompactObserverCounts?: { active: number } }
  ).__hirefluxCompactObserverCounts?.active)).toBe(1);

  const accessibility = await new AxeBuilder({ page })
    .include('section[data-connected-c-presentation="compact-progressive"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("compact progression reverses directly and reconciles with full Progressive-C", async ({ page }) => {
  await openCompact(page);
  for (const chapter of ["action-center", "preparation", "interviews", "applications"]) {
    await placeChapterAtOwnershipLine(page, chapter);
    await expect(compact(page).locator(`[data-connected-c-compact-endpoint="${chapter}"]`)).toHaveAttribute("data-active", "true");
  }

  await placeChapterAtOwnershipLine(page, "preparation");
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "progressive");
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
  await expect(story(page)).toHaveAttribute("data-connected-semantic-chapter", "preparation");
  await expect(story(page).locator('[data-connected-family-owner] [data-connected-c-endpoint="preparation"]')).toHaveAttribute("data-active", "true");
  await expect(story(page).locator("[data-connected-family-owner] > *")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "compact-progressive");
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
  await expect(compact(page)).toHaveAttribute("data-active-chapter", "preparation");
  await expect(story(page).locator("[data-connected-family-owner] > *")).toHaveCount(1);
});

test("compact retention tolerates bounded toolbar movement and reduced motion falls back to A", async ({ page }) => {
  await openCompact(page);
  await page.setViewportSize({ width: 390, height: 736 });
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "compact-progressive");
  await page.setViewportSize({ width: 390, height: 735 });
  await expect(story(page)).toHaveAttribute("data-connected-family", "a");
  await expect(story(page).locator("[data-connected-family-owner] [data-connected-c-compact-workspace]")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "compact-progressive");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(story(page)).toHaveAttribute("data-connected-family", "a");
  await expect(story(page).locator("[data-connected-family-owner] [data-connected-c-compact-workspace]")).toHaveCount(0);
  await expect(story(page).locator("[data-connected-native-story=a]")).toHaveCount(1);
});
