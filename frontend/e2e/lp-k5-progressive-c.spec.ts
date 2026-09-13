import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

const candidateEnabled = process.env.VITE_CONNECTED_STORY_PROGRESSIVE_C === "on";
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

async function openCandidate(page: Page) {
  await installDeterministicApi(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(story(page)).toHaveAttribute("data-connected-family", "c");
  await expect(story(page)).toHaveAttribute("data-connected-c-presentation", "progressive");
  await expect(progressive(page)).toHaveCount(1);
  await expect(story(page)).toHaveAttribute("data-connected-transition", "settled");
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!candidateEnabled, "candidate production build is not enabled");
  test.skip(!["tablet-768", "desktop-1024"].includes(testInfo.project.name));
  await instrumentProgressiveObserver(page);
});

test("progressive-C owns one stable workspace and advances through all four chapters", async ({ page }) => {
  await openCandidate(page);
  const states = [];
  for (const chapter of ["applications", "interviews", "preparation", "action-center"]) {
    const semantic = progressive(page).locator(`[data-connected-c-semantic-chapter="${chapter}"]`);
    await semantic.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo({ top: rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2, behavior: "instant" });
    });
    await expect(progressive(page)).toHaveAttribute("data-active-chapter", chapter);
    states.push(await progressive(page).evaluate((root) => {
      const workspace = root.querySelector<HTMLElement>("[data-connected-c-workspace]")!;
      const rect = workspace.getBoundingClientRect();
      return {
        activeEndpoints: root.querySelectorAll('[data-connected-c-endpoint][data-active="true"]').length,
        activeEndpoint: root.querySelector('[data-connected-c-endpoint][data-active="true"]')?.getAttribute("data-connected-c-endpoint"),
        top: rect.top,
        height: rect.height,
        position: getComputedStyle(workspace).position,
      };
    }));
  }
  expect(states.map((state) => state.activeEndpoint)).toEqual(["applications", "interviews", "preparation", "action-center"]);
  states.forEach((state) => {
    expect(state.activeEndpoints).toBe(1);
    expect(state.height).toBeCloseTo(560, 0);
    expect(state.position).toBe("sticky");
  });
  expect(Math.max(...states.map((state) => state.top)) - Math.min(...states.map((state) => state.top))).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.__hirefluxProgressiveObserverCounts.progressiveActive)).toBe(1);
  expect(await story(page).locator(".pin-spacer")).toHaveCount(0);
  expect(await story(page).locator('[data-connected-timeline-active="true"]')).toHaveCount(0);
});

test("reverse traversal is deterministic and Action releases before the Coda takes over", async ({ page }) => {
  await openCandidate(page);
  for (const chapter of ["action-center", "preparation", "interviews", "applications"]) {
    await progressive(page).locator(`[data-connected-c-semantic-chapter="${chapter}"]`).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo(0, rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2);
    });
    await expect(progressive(page)).toHaveAttribute("data-active-chapter", chapter);
  }
  const action = progressive(page).locator('[data-connected-c-semantic-chapter="action-center"]');
  await action.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.75));
  await expect(progressive(page)).toHaveAttribute("data-active-chapter", "action-center");
  const release = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('section[data-connected-c-presentation="progressive"] [data-connected-c-workspace]')!;
    const coda = document.querySelector<HTMLElement>("[data-quiet-coda]")!;
    const workspaceRect = workspace.getBoundingClientRect();
    return {
      workspacePosition: getComputedStyle(workspace).position,
      workspaceBottom: workspaceRect.bottom,
      codaTop: coda.getBoundingClientRect().top,
    };
  });
  expect(release.workspacePosition).toBe("sticky");
  expect(release.codaTop).toBeGreaterThan(release.workspaceBottom);
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
  await openCandidate(page);
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
  await openCandidate(page);
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
  await openCandidate(page);
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
  await openCandidate(page);

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
  await openCandidate(page);
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
