import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

type Family = "j3" | "c" | "a";

const connectedStory = (page: Page) => page.locator("[data-connected-story]");

async function waitForFamily(page: Page, family: Family) {
  await expect(connectedStory(page)).toHaveAttribute("data-connected-family", family);
  await expect(connectedStory(page).locator("[data-connected-family-owner]")).toHaveCount(1);
  await expect(connectedStory(page).locator("[data-connected-family-owner]")).toHaveAttribute(
    "data-connected-family-owner",
    family,
  );
}

async function runtimeState(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-connected-story]")!;
    return {
      family: root.dataset.connectedFamily,
      semanticOwner: root.dataset.connectedSemanticOwner,
      presentationOwner: root.dataset.connectedPresentationOwner,
      chapter: root.dataset.connectedSemanticChapter,
      transition: root.dataset.connectedTransition,
      owners: root.querySelectorAll("[data-connected-family-owner]").length,
      j3: root.querySelectorAll("[data-connected-j3]").length,
      timelines: root.querySelectorAll('[data-connected-timeline-active="true"]').length,
      triggers: root.querySelectorAll('[data-connected-trigger-active="true"]').length,
      pinSpacers: root.querySelectorAll(".pin-spacer").length,
      fitProbes: root.querySelectorAll("[data-connected-fit-probe]").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function openLanding(page: Page, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Keep every opportunity connected to what comes next." })).toBeVisible();
}

async function placeChapterOnReadingLine(page: Page, chapter: string) {
  await page.locator(`[data-connected-chapter="${chapter}"]`).evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - window.innerHeight / 4), behavior: "instant" });
  });
}

test.beforeEach(async ({ page }) => {
  await installDeterministicApi(page);
});

const productionMatrix: Record<string, Family> = {
  "narrow-320": "a",
  "mobile-390": "a",
  "tablet-768": "c",
  "desktop-1024": "c",
  "desktop-1280": "j3",
};

test("Policy B selects one production owner and one complete story", async ({ page }, testInfo) => {
  const expected = productionMatrix[testInfo.project.name];
  expect(expected).toBeTruthy();
  await openLanding(page);
  await waitForFamily(page, expected);

  const state = await runtimeState(page);
  expect(state.owners).toBe(1);
  expect(state.semanticOwner).toBe(expected);
  expect(state.presentationOwner).toBe(expected);
  expect(state.fitProbes).toBe(1);
  expect(state.overflow).toBeLessThanOrEqual(1);
  expect(state.pinSpacers).toBe(expected === "j3" ? 1 : 0);
  expect(state.timelines).toBe(expected === "j3" ? 1 : 0);
  expect(state.triggers).toBe(expected === "j3" ? 1 : 0);
  expect(state.j3).toBe(expected === "j3" ? 1 : 0);
  const familyChunkRequests = await page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => /ConnectedStoryJ3-.*\.js$/.test(name)));
  expect(familyChunkRequests.length).toBe(expected === "j3" ? 1 : 0);

  for (const question of [
    "How do I keep every opportunity in view?",
    "What should carry into the interview?",
    "How does that context help me prepare?",
    "What deserves attention next?",
  ]) {
    await expect(page.getByText(question, { exact: true }).first()).toBeAttached();
  }

  const accessibility = await new AxeBuilder({ page })
    .include("[data-connected-story]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("reduced motion selects the richest native family without J3 lifecycle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page, "reduce");
  await waitForFamily(page, "c");
  const state = await runtimeState(page);
  expect(state.j3).toBe(0);
  expect(state.timelines).toBe(0);
  expect(state.triggers).toBe(0);
  expect(state.pinSpacers).toBe(0);
});

test("J3, C, and A hand off atomically while preserving the Preparation chapter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");

  const pinGeometry = await page.locator("[data-scroll-story-pin]").evaluate((stage) => {
    const spacer = stage.parentElement!;
    return {
      start: spacer.getBoundingClientRect().top + window.scrollY,
      travel: window.innerHeight * 2.5,
    };
  });
  await page.evaluate(({ start, travel }) => window.scrollTo({ top: start + travel * 0.56, behavior: "instant" }), pinGeometry);
  await expect(page.locator("[data-connected-j3]")).toHaveAttribute("data-active-chapter", "preparation");

  await page.setViewportSize({ width: 900, height: 720 });
  await waitForFamily(page, "c");
  await expect(page.locator('[data-connected-chapter="preparation"]')).toBeInViewport();
  expect((await runtimeState(page)).pinSpacers).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForFamily(page, "a");
  await expect(page.locator('[data-connected-chapter="preparation"]')).toBeInViewport();

  await page.setViewportSize({ width: 900, height: 720 });
  await waitForFamily(page, "c");
  await page.setViewportSize({ width: 1280, height: 900 });
  await waitForFamily(page, "j3");
  await expect(page.locator("[data-connected-j3]")).toHaveAttribute("data-active-chapter", "preparation");
  const finalState = await runtimeState(page);
  expect(finalState.owners).toBe(1);
  expect(finalState.pinSpacers).toBe(1);
  expect(finalState.timelines).toBe(1);
  expect(finalState.triggers).toBe(1);
});

test("large text demotes monotonically to A with no clipping or pinning", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await waitForFamily(page, "a");
  const state = await runtimeState(page);
  expect(state.pinSpacers).toBe(0);
  expect(state.overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-connected-chapter="applications"]')).toBeVisible();
  await expect(page.locator('[data-connected-chapter="action-center"]')).toBeVisible();
});

test("a slow initial J3 load falls back within 800ms and late completion remains cache-only", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  let releaseChunk!: () => void;
  const chunkGate = new Promise<void>((resolve) => { releaseChunk = resolve; });
  await page.route(/ConnectedStoryJ3-.*\.js$/, async (route) => {
    await chunkGate;
    await route.continue();
  });
  await openLanding(page);
  await waitForFamily(page, "c");
  expect((await runtimeState(page)).j3).toBe(0);

  releaseChunk();
  await page.waitForTimeout(300);
  await waitForFamily(page, "c");
  expect((await runtimeState(page)).pinSpacers).toBe(0);

  await page.setViewportSize({ width: 1279, height: 900 });
  await waitForFamily(page, "j3");
  const state = await runtimeState(page);
  expect(state.j3).toBe(1);
  expect(state.pinSpacers).toBe(1);
});

test("a failed J3 request degrades safely and does not flash a speculative owner", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.route(/ConnectedStoryJ3-.*\.js$/, (route) => route.abort("failed"));
  await openLanding(page);
  await waitForFamily(page, "c");
  const state = await runtimeState(page);
  expect(state.j3).toBe(0);
  expect(state.timelines).toBe(0);
  expect(state.triggers).toBe(0);
  expect(state.pinSpacers).toBe(0);
});

test("a pending J3 request cannot claim ownership after reduced motion or resize wins", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  let releaseChunk!: () => void;
  const chunkGate = new Promise<void>((resolve) => { releaseChunk = resolve; });
  await page.route(/ConnectedStoryJ3-.*\.js$/, async (route) => {
    await chunkGate;
    await route.continue();
  });
  await openLanding(page);
  await expect(connectedStory(page)).toHaveAttribute("data-connected-transition", "loading-j3");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await waitForFamily(page, "c");
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForFamily(page, "a");
  releaseChunk();
  await page.waitForTimeout(300);
  await waitForFamily(page, "a");
  const state = await runtimeState(page);
  expect(state.j3).toBe(0);
  expect(state.pinSpacers).toBe(0);
});

test("checkpoint updates preserve Router and unrelated history state without recursive growth", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1024");
  await openLanding(page);
  await waitForFamily(page, "c");
  await page.evaluate(() => {
    history.replaceState({ ...history.state, usr: { from: "router" }, key: "stable-key", idx: 7, unrelated: "kept" }, "");
  });
  await placeChapterOnReadingLine(page, "interviews");
  await page.waitForTimeout(260);
  const first = await page.evaluate(() => history.state);
  expect(first.usr).toEqual({ from: "router" });
  expect(first.key).toBe("stable-key");
  expect(first.idx).toBe(7);
  expect(first.unrelated).toBe("kept");
  expect(first.__hirefluxConnectedStory).toMatchObject({ version: 1, chapter: "interviews" });

  await placeChapterOnReadingLine(page, "preparation");
  await page.waitForTimeout(260);
  const second = await page.evaluate(() => history.state);
  expect(Object.keys(second).sort()).toEqual(Object.keys(first).sort());
  expect(second.__hirefluxConnectedStory).toMatchObject({ version: 1, chapter: "preparation" });
});

test("Back/Forward restores a valid semantic checkpoint and keeps one owner", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1024");
  await openLanding(page);
  await waitForFamily(page, "c");
  await placeChapterOnReadingLine(page, "interviews");
  await page.waitForTimeout(260);
  await page.evaluate(() => history.pushState({ ...history.state, marker: "second" }, "", "/?entry=second"));
  await placeChapterOnReadingLine(page, "action-center");
  await page.waitForTimeout(260);
  await page.goBack();
  await expect(page).not.toHaveURL(/entry=second/);
  await waitForFamily(page, "c");
  const checkpoint = await page.evaluate(() => history.state?.__hirefluxConnectedStory);
  expect(checkpoint?.version).toBe(1);
  expect((await runtimeState(page)).owners).toBe(1);
  await page.goForward();
  await expect(page).toHaveURL(/entry=second/);
  await waitForFamily(page, "c");
  expect((await runtimeState(page)).owners).toBe(1);
});

test("route unmount and warm remount leave no stale J3 lifecycle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");
  await page.getByRole("button", { name: /Continue Demo|Explore the Demo/ }).first().click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator("[data-connected-story]")).toHaveCount(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Keep every opportunity connected to what comes next." })).toBeVisible();
  await waitForFamily(page, "j3");
  const state = await runtimeState(page);
  expect(state.owners).toBe(1);
  expect(state.pinSpacers).toBe(1);
  expect(state.timelines).toBe(1);
  expect(state.triggers).toBe(1);
});

test("trusted user scrolling vetoes a pending reconciliation correction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
  await page.setViewportSize({ width: 900, height: 720 });
  await page.mouse.wheel(0, 140);
  await waitForFamily(page, "c");
  const afterIntent = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(afterIntent);
});

test("J3 travel is exactly 2.5 viewport heights", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");
  const geometry = await page.locator("[data-scroll-story-pin]").evaluate((stage) => {
    const spacer = stage.parentElement!;
    return {
      viewportHeight: window.innerHeight,
      travel: spacer.getBoundingClientRect().height - stage.getBoundingClientRect().height,
    };
  });
  expect(geometry.travel).toBeCloseTo(geometry.viewportHeight * 2.5, 0);
});

test("a pending J3 import remains inert after route unmount and warms a later remount", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  let releaseChunk!: () => void;
  const chunkGate = new Promise<void>((resolve) => { releaseChunk = resolve; });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(/ConnectedStoryJ3-.*\.js$/, async (route) => {
    await chunkGate;
    await route.continue();
  });
  await openLanding(page);
  await expect(connectedStory(page)).toHaveAttribute("data-connected-transition", "loading-j3");

  await page.getByRole("button", { name: /Continue Demo|Explore the Demo/ }).first().click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(connectedStory(page)).toHaveCount(0);
  const routeState = await page.evaluate(() => ({ scrollY: window.scrollY, history: JSON.stringify(history.state) }));

  releaseChunk();
  await page.waitForTimeout(350);
  await expect(connectedStory(page)).toHaveCount(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(routeState.scrollY);
  expect(await page.evaluate(() => JSON.stringify(history.state))).toBe(routeState.history);
  expect(pageErrors).toEqual([]);

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Keep every opportunity connected to what comes next." })).toBeVisible();
  await waitForFamily(page, "j3");
  const state = await runtimeState(page);
  expect(state.owners).toBe(1);
  expect(state.timelines).toBe(1);
  expect(state.triggers).toBe(1);
  expect(state.pinSpacers).toBe(1);
});

test("trusted keyboard scrolling vetoes correction while editable keys remain local", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo({ top: 1200, behavior: "instant" });
  });
  await page.setViewportSize({ width: 900, height: 720 });
  await page.keyboard.press("End");
  await waitForFamily(page, "c");
  await page.waitForTimeout(500);
  const endPosition = await page.evaluate(() => ({
    current: window.scrollY,
    maximum: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(endPosition.maximum - endPosition.current).toBeLessThanOrEqual(8);

  await page.setViewportSize({ width: 1280, height: 900 });
  await waitForFamily(page, "j3");
  const pinGeometry = await page.locator("[data-scroll-story-pin]").evaluate((stage) => ({
    start: stage.parentElement!.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2.5,
  }));
  await page.evaluate(({ start, travel }) => {
    window.scrollTo({ top: start + travel * 0.56, behavior: "instant" });
    const editor = document.createElement("textarea");
    editor.dataset.intentEditor = "true";
    editor.value = "editable control";
    editor.style.cssText = "position:fixed;left:8px;top:8px;width:120px;height:44px";
    document.body.append(editor);
    editor.focus();
    editor.setSelectionRange(0, 0);
  }, pinGeometry);
  await page.setViewportSize({ width: 900, height: 720 });
  await page.keyboard.press("End");
  await waitForFamily(page, "c");
  await expect(page.locator('[data-connected-chapter="preparation"]')).toBeInViewport();
  await expect(page.locator("[data-intent-editor]")).toBeFocused();
  expect(await page.locator("[data-intent-editor]").evaluate((editor) => (editor as HTMLTextAreaElement).selectionStart)).toBe(16);
  await page.locator("[data-intent-editor]").evaluate((editor) => editor.remove());
});

test("touch intent veto remains unverified without a faithful moving-touch API", async () => {
  test.skip(
    true,
    "Playwright exposes trusted tap only; CDP desktop touch required artificial frame delays and did not reproduce native gesture timing faithfully.",
  );
});

test("trusted scrollbar input vetoes correction when a physical gutter is exposed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await openLanding(page);
  await waitForFamily(page, "j3");
  const gutter = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
  test.skip(gutter < 1, "Headless Chromium exposes overlay scrollbars with no automatable gutter.");
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
  await page.setViewportSize({ width: 900, height: 720 });
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  await page.mouse.move(clientWidth + gutter / 2, 360);
  await page.mouse.down();
  await page.mouse.up();
  await waitForFamily(page, "c");
  const afterIntent = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(afterIntent);
});

test("cold and warm production J3 loads request the family chunk once per document", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/ConnectedStoryJ3-.*\.js$/.test(request.url())) requests.push(request.url());
  });
  await openLanding(page);
  await waitForFamily(page, "j3");
  expect(requests).toHaveLength(1);
  await page.setViewportSize({ width: 900, height: 720 });
  await waitForFamily(page, "c");
  await page.setViewportSize({ width: 1280, height: 900 });
  await waitForFamily(page, "j3");
  expect(requests).toHaveLength(1);
});
