import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

const progressiveExplicitlyDisabled = process.env.VITE_CONNECTED_STORY_PROGRESSIVE_C === "off";
const story = (page: Page) => page.locator("[data-connected-story]");
const progressive = (page: Page) => page.locator("section[data-connected-c-presentation=progressive]");

async function instrumentProgressiveObserver(page: Page) {
  await page.addInitScript(() => {
    const Original = window.IntersectionObserver;
    const counts = { created: 0, active: 0, disconnected: 0, progressiveCreated: 0, progressiveActive: 0 };
    Object.defineProperty(window, "__hirefluxProgressiveObserverCounts", { value: counts });
    window.IntersectionObserver = class extends Original {
      private readonly progressive: boolean;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        this.progressive = String(options?.rootMargin).includes("-49%");
        counts.created += 1;
        counts.active += 1;
        if (this.progressive) {
          counts.progressiveCreated += 1;
          counts.progressiveActive += 1;
        }
      }
      override disconnect() {
        counts.disconnected += 1;
        counts.active = Math.max(0, counts.active - 1);
        if (this.progressive) counts.progressiveActive = Math.max(0, counts.progressiveActive - 1);
        super.disconnect();
      }
    };
  });
}

async function openProgressive(page: Page) {
  await installDeterministicApi(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(story(page)).toHaveAttribute("data-connected-family", "c");
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "progressive");
  await expect(progressive(page)).toHaveCount(1);
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(progressiveExplicitlyDisabled, "Progressive-C was explicitly disabled");
  test.skip(!["tablet-768", "desktop-1024"].includes(testInfo.project.name));
  await instrumentProgressiveObserver(page);
});

test("progressive-C owns one synchronized upper-anchored scene and advances through all four chapters", async ({ page }, testInfo) => {
  await openProgressive(page);
  const states = [];
  for (const chapter of ["applications", "interviews", "preparation", "action-center"]) {
    const semantic = progressive(page).locator(`[data-connected-c-semantic-chapter="${chapter}"]`);
    await semantic.evaluate((element, currentChapter) => {
      const rect = element.getBoundingClientRect();
      const root = element.closest<HTMLElement>("[data-connected-c-presentation=progressive]")!;
      const stage = root.querySelector<HTMLElement>("[data-connected-c-stage]")!;
      const scene = root.querySelector<HTMLElement>("[data-connected-c-sticky-scene]")!;
      const target = currentChapter === "applications"
        ? stage.getBoundingClientRect().top + window.scrollY - Number.parseFloat(getComputedStyle(scene).top) + 2
        : rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2;
      window.scrollTo({ top: target, behavior: "instant" });
    }, chapter);
    await expect(progressive(page)).toHaveAttribute("data-active-chapter", chapter);
    states.push(await progressive(page).evaluate((root) => {
      const scene = root.querySelector<HTMLElement>("[data-connected-c-sticky-scene]")!;
      const workspace = root.querySelector<HTMLElement>("[data-connected-c-workspace]")!;
      const sceneRect = scene.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      return {
        activeEndpoints: root.querySelectorAll('[data-connected-c-endpoint][data-active="true"]').length,
        activeEndpoint: root.querySelector('[data-connected-c-endpoint][data-active="true"]')?.getAttribute("data-connected-c-endpoint"),
        activeNarrative: root.querySelector("[data-connected-c-visual-narrative]")?.getAttribute("data-connected-visual-chapter"),
        sceneTop: sceneRect.top,
        sceneHeight: sceneRect.height,
        scenePosition: getComputedStyle(scene).position,
        workspaceHeight: workspaceRect.height,
        workspacePosition: getComputedStyle(workspace).position,
      };
    }));
  }
  expect(states.map((state) => state.activeEndpoint)).toEqual(["applications", "interviews", "preparation", "action-center"]);
  expect(states.map((state) => state.activeNarrative)).toEqual(["applications", "interviews", "preparation", "action-center"]);
  states.forEach((state) => {
    expect(state.activeEndpoints).toBe(1);
    expect(state.sceneHeight).toBeCloseTo(560, 0);
    expect(state.workspaceHeight).toBeCloseTo(560, 0);
    expect(state.scenePosition).toBe("sticky");
    expect(state.workspacePosition).toBe("static");
  });
  const expectedTop = testInfo.project.name === "desktop-1024" ? 76.8 : 102.4;
  states.forEach((state) => expect(state.sceneTop).toBeCloseTo(expectedTop, 0));
  expect(Math.max(...states.map((state) => state.sceneTop)) - Math.min(...states.map((state) => state.sceneTop))).toBeLessThanOrEqual(1);
  const geometry = await progressive(page).evaluate((root) => {
    const stage = root.querySelector<HTMLElement>("[data-connected-c-stage]")!;
    const owner = root.querySelector<HTMLElement>("[data-connected-c-sticky-owner]")!;
    const track = root.querySelector<HTMLElement>("[data-connected-c-semantic-track]")!;
    return {
      chapterHeights: Array.from(root.querySelectorAll<HTMLElement>("[data-connected-c-semantic-chapter]"))
        .map((chapter) => chapter.getBoundingClientRect().height),
      actionHold: Number.parseFloat(getComputedStyle(track).paddingBottom),
      releaseLead: stage.getBoundingClientRect().height - owner.getBoundingClientRect().height,
      releaseTails: root.querySelectorAll("[data-connected-c-release-tail]").length,
    };
  });
  if (testInfo.project.name === "desktop-1024") {
    expect(geometry.chapterHeights).toEqual([416, 384, 448, 512]);
    expect(geometry.actionHold).toBeCloseTo(122.88, 1);
    expect(geometry.releaseLead).toBeCloseTo(91.2, 0);
  } else {
    expect(geometry.chapterHeights).toEqual([544, 512, 593.90625, 672]);
    expect(geometry.actionHold).toBeCloseTo(160, 1);
    expect(geometry.releaseLead).toBeCloseTo(321.6, 0);
  }
  expect(geometry.releaseTails).toBe(0);
  await expect(progressive(page).locator("[data-connected-c-sticky-owner]")).toHaveCount(1);
  await expect(progressive(page).locator("[data-connected-c-sticky-owner]")).toHaveAttribute("aria-hidden", "true");
  await expect(progressive(page).locator("[data-connected-c-sticky-owner] [data-connected-c-visual-narrative]")).toHaveCount(1);
  await expect(progressive(page).locator("[data-connected-c-sticky-owner] [data-connected-c-workspace]")).toHaveCount(1);
  await expect(progressive(page).locator("[data-connected-c-semantic-copy].sr-only")).toHaveCount(4);
  expect(await progressive(page).locator("[data-connected-c-semantic-copy]").evaluateAll((copies) => copies.filter((copy) => {
    const rect = copy.getBoundingClientRect();
    return rect.width > 2 || rect.height > 2;
  }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.__hirefluxProgressiveObserverCounts.progressiveActive)).toBe(1);
  expect(await story(page).locator(".pin-spacer")).toHaveCount(0);
  expect(await story(page).locator('[data-connected-timeline-active="true"]')).toHaveCount(0);
});

test("Action holds while pinned and releases bidirectionally before the Coda takes over", async ({ page }) => {
  await openProgressive(page);
  for (const chapter of ["action-center", "preparation", "interviews", "applications"]) {
    await progressive(page).locator(`[data-connected-c-semantic-chapter="${chapter}"]`).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
    });
    await expect(progressive(page)).toHaveAttribute("data-active-chapter", chapter);
  }
  const releaseGeometry = await progressive(page).evaluate((root) => {
    const owner = root.querySelector<HTMLElement>("[data-connected-c-sticky-owner]")!;
    const scene = root.querySelector<HTMLElement>("[data-connected-c-sticky-scene]")!;
    const action = root.querySelector<HTMLElement>('[data-connected-c-semantic-chapter="action-center"]')!;
    const coda = document.querySelector<HTMLElement>("[data-quiet-coda]")!;
    const anchor = Number.parseFloat(getComputedStyle(scene).top);
    const ownerTop = owner.getBoundingClientRect().top + window.scrollY;
    const actionTop = action.getBoundingClientRect().top + window.scrollY;
    const releaseEnd = ownerTop + owner.getBoundingClientRect().height - scene.getBoundingClientRect().height - anchor;
    const actionStart = actionTop - window.innerHeight / 2;
    return {
      anchor,
      releaseEnd,
      codaEnter: coda.getBoundingClientRect().top + window.scrollY - window.innerHeight,
      pinnedActionDwell: releaseEnd - actionStart,
    };
  });
  expect(releaseGeometry.pinnedActionDwell).toBeGreaterThan(280);

  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), releaseGeometry.releaseEnd - 2);
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
  const beforeRelease = await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('section[data-connected-c-presentation="progressive"] [data-connected-c-sticky-scene]')!;
    const coda = document.querySelector<HTMLElement>("[data-quiet-coda]")!;
    const sceneRect = scene.getBoundingClientRect();
    return {
      sceneTop: sceneRect.top,
      sceneBottom: sceneRect.bottom,
      codaTop: coda.getBoundingClientRect().top,
    };
  });
  expect(beforeRelease.sceneTop).toBeCloseTo(releaseGeometry.anchor, 0);
  expect(beforeRelease.codaTop).toBeGreaterThan(beforeRelease.sceneBottom);

  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), releaseGeometry.codaEnter + 1);
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
  const releasedTop = await progressive(page).locator("[data-connected-c-sticky-scene]").evaluate((scene) => scene.getBoundingClientRect().top);
  expect(releasedTop).toBeLessThan(releaseGeometry.anchor - 20);

  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), releaseGeometry.releaseEnd - 2);
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
  await expect.poll(() => progressive(page).locator("[data-connected-c-sticky-scene]").evaluate((scene) => scene.getBoundingClientRect().top))
    .toBeCloseTo(releaseGeometry.anchor, 0);
});

test("reduced motion and capability loss retain a complete native story", async ({ page }) => {
  await installDeterministicApi(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(story(page)).toHaveAttribute("data-connected-family", "c");
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "native");
  await expect(story(page).locator("[data-connected-native-story=c]")).toHaveCount(1);
  await expect(story(page).locator("[data-connected-c-semantic-chapter]")).toHaveCount(0);
  await expect(story(page).locator("[data-connected-chapter]")).toHaveCount(4);
});

test("the progressive story remains one accessible semantic narrative", async ({ page }) => {
  await openProgressive(page);
  await expect(progressive(page).locator("[data-connected-c-semantic-track] > li")).toHaveCount(4);
  await expect(progressive(page).getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(progressive(page).locator("[aria-live]")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include("section[data-connected-c-presentation=progressive]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("same-family capability changes preserve Preparation without stale progressive ownership", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-768");
  await openProgressive(page);
  const preparation = progressive(page).locator('[data-connected-c-semantic-chapter="preparation"]');
  await preparation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
  });
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "preparation");

  await page.setViewportSize({ width: 768, height: 700 });
  await expect(story(page)).toHaveAttribute("data-connected-family", "c");
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "native");
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
  await expect(story(page).locator('[data-connected-native-story="c"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.__hirefluxProgressiveObserverCounts.progressiveActive)).toBe(0);
  expect((await page.evaluate(() => history.state?.__hirefluxConnectedStory?.chapter))).toBe("preparation");

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "progressive");
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "preparation");
  expect(await page.evaluate(() => window.__hirefluxProgressiveObserverCounts.progressiveActive)).toBe(1);
});

test("fast traversal settles directly on the latest valid Action state", async ({ page }) => {
  await openProgressive(page);
  const target = progressive(page).locator('[data-connected-c-semantic-chapter="action-center"]');
  await progressive(page).locator('[data-connected-c-semantic-chapter="interviews"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
  });
  await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
  });
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
  await expect(progressive(page).locator('[data-connected-c-endpoint="action-center"]')).toHaveAttribute("data-active", "true");
  await expect(progressive(page).locator('[data-connected-c-endpoint][data-active="true"]')).toHaveCount(1);
});

test("forward and reverse endpoint handoffs hide outgoing content before the destination settles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-768");
  await openProgressive(page);

  const centerChapter = async (chapter: string) => {
    await progressive(page).locator(`[data-connected-c-semantic-chapter="${chapter}"]`).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
    });
    await expect(progressive(page)).toHaveAttribute("data-active-chapter", chapter);
  };

  const assertCleanHandoff = async (source: string, destination: string) => {
    await centerChapter(source);
    await page.waitForTimeout(220);
    await centerChapter(destination);
    await page.waitForTimeout(45);

    await expect(progressive(page).locator("[data-connected-c-visual-narrative]")).toHaveAttribute(
      "data-connected-visual-chapter",
      destination,
    );

    const early = await progressive(page).evaluate((root, stages) => {
      const read = (stage: string) => {
        const endpoint = root.querySelector<HTMLElement>(`[data-connected-c-endpoint="${stage}"]`)!;
        const style = getComputedStyle(endpoint);
        return { opacity: Number(style.opacity), visibility: style.visibility };
      };
      return { source: read(stages.source), destination: read(stages.destination) };
    }, { source, destination });
    expect(early.source.visibility).toBe("hidden");
    expect(early.destination.visibility).toBe("visible");
    expect(early.destination.opacity).toBeGreaterThan(0.1);

    await page.waitForTimeout(180);
    await expect(progressive(page).locator(`[data-connected-c-endpoint="${destination}"]`)).toHaveCSS("opacity", "1");
  };

  for (const [source, destination] of [
    ["applications", "interviews"],
    ["interviews", "preparation"],
    ["preparation", "action-center"],
    ["action-center", "preparation"],
    ["preparation", "interviews"],
    ["interviews", "applications"],
  ]) {
    await assertCleanHandoff(source, destination);
  }
});

test("a restored Action checkpoint bootstraps without an Applications endpoint flash", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-768");
  await openProgressive(page);
  const target = progressive(page).locator('[data-connected-c-semantic-chapter="action-center"]');
  await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
  });
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
  await expect.poll(() => page.evaluate(() => history.state?.__hirefluxConnectedStory?.chapter)).toBe("action-center");
  await page.addInitScript(() => {
    window.__hirefluxFirstProgressiveEndpoint = null;
    const observer = new MutationObserver(() => {
      const mounted = document.querySelector<HTMLElement>('section[data-connected-c-presentation="progressive"]');
      if (!mounted) return;
      window.__hirefluxFirstProgressiveEndpoint = mounted.dataset.activeChapter ?? null;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
  expect(await page.evaluate(() => window.__hirefluxFirstProgressiveEndpoint)).toBe("action-center");
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
});

declare global {
  interface Window {
    __hirefluxProgressiveObserverCounts: { created: number; active: number; disconnected: number; progressiveCreated: number; progressiveActive: number };
    __hirefluxFirstProgressiveEndpoint: string | null;
  }
}
