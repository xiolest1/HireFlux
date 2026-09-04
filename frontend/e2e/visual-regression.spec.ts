import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import {
  application,
  applicationId,
  installDeterministicApi,
} from "./fixtures";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
    body: JSON.stringify(body),
  });
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: element.textContent?.trim().slice(0, 80),
        };
      })
      .filter(
        ({ left, right, width }) =>
          width > 0 && (left < -1 || right > window.innerWidth + 1),
      )
      .slice(0, 12),
  }));
  expect(
    dimensions.scrollWidth,
    `Horizontal overflow: ${JSON.stringify(dimensions.offenders)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectLandingContentInsideViewport(page: Page) {
  const clipped = await page.locator("[data-landing-clip-check]:visible").evaluateAll(
    (elements) => elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim().slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1),
  );
  expect(clipped).toEqual([]);
}

async function waitForLandingAnimationsToSettle(page: Page) {
  await page.locator("#landing-main").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations({ subtree: true }).map((animation) =>
        animation.finished.catch(() => undefined),
      ),
    );
  });
}

const routes = [
  {
    name: "landing",
    path: "/",
    heading: "Keep every opportunity connected to what comes next.",
  },
  { name: "dashboard", path: "/dashboard", heading: "Welcome back" },
  { name: "applications", path: "/applications", heading: "Applications" },
  {
    name: "application-create",
    path: "/applications/new",
    heading: "Add an application",
  },
  {
    name: "application-detail",
    path: `/applications/${applicationId}`,
    heading: "Senior Frontend Platform Engineer",
  },
  { name: "interviews", path: "/interviews", heading: "Interviews" },
  { name: "analytics", path: "/analytics", heading: "Analytics" },
  {
    name: "pipeline",
    path: "/analytics?section=pipeline",
    heading: "Analytics",
  },
  { name: "settings", path: "/settings", heading: "Settings & profile" },
] as const;

test.beforeEach(async ({ page }) => {
  await installDeterministicApi(page);
});

for (const route of routes) {
  test(`${route.name} is responsive and accessible`, async ({
    page,
  }, testInfo) => {
    if (route.name === "landing") {
      await page.emulateMedia({ reducedMotion: "reduce" });
    }
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading, level: 1 }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expectNoHorizontalPageOverflow(page);

    if (route.name === "landing") {
      await expect(page.locator("[data-hero-story]")).toBeVisible();
      await expectLandingContentInsideViewport(page);
      await waitForLandingAnimationsToSettle(page);
      await expect(page.getByTestId("mobile-product-story")).toBeVisible();
      await expect(page.getByTestId("desktop-product-story")).toBeHidden();
    }

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);

    if (testInfo.project.name === "desktop-1280") {
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
      });
    }
  });
}

test("landing story becomes a stable complete state with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-hero-story]")).toHaveAttribute(
    "data-story-scene",
    "resolved",
  );
  await expect(
    page.getByRole("button", { name: /application story/i }),
  ).toHaveCount(0);
  await expect(page.locator("[data-flux-story]")).toHaveAttribute(
    "data-hero-settled",
    "true",
  );
  await expect(page.locator("[data-persistent-opportunity]")).toBeVisible();
  await expect(page.locator("[data-flux-provenance]")).toBeVisible();
  await expect(page.locator("[data-flux-next-action]")).toBeVisible();
  await expect(page.locator("[data-flux-interview]")).toHaveCount(0);
  await expect(page.locator("[data-flux-preparation]")).toHaveCount(0);
  await expect(page.getByTestId("mobile-product-story")).toBeVisible();
  await expect(page.getByTestId("desktop-product-story")).toBeHidden();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  const staticAction = page.locator('[data-scroll-static-stage="action-center"]');
  await expect(staticAction.locator("[data-workspace-action-decision]")).toContainText("Send a thoughtful follow-up");
  await expect(staticAction.locator("[data-workspace-action-urgency]")).toHaveText("Due today");
  await expect(staticAction.locator("[data-workspace-action-rationale]")).toContainText("Technical screen complete");
  await expect(staticAction.locator("[data-workspace-action-rationale]")).toContainText("Preparation retained");
});

test("static benefit signals stay compact, semantic, and internally contained", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const region = page.getByRole("region", { name: "A clearer way through the search." });
  const viewport = region.locator("[data-benefits-viewport]");
  const signals = region.locator("[data-benefit-signal]");
  const expectedFullyVisible = {
    "narrow-320": 1,
    "mobile-390": 1,
    "tablet-768": 2,
    "desktop-1024": 3,
    "desktop-1280": 4,
  }[testInfo.project.name];

  expect(expectedFullyVisible).toBeDefined();
  await expect(region.locator("ol")).toHaveCount(1);
  await expect(signals).toHaveCount(7);
  await expect(region.getByRole("article")).toHaveCount(7);
  await expect(region.getByRole("button")).toHaveCount(0);
  await expect(region.locator('[role="carousel"], [aria-live], [data-benefit-clone], [data-active-benefit]')).toHaveCount(0);

  const geometry = await viewport.evaluate((element) => {
    const viewportRect = element.getBoundingClientRect();
    const signalRects = Array.from(element.querySelectorAll<HTMLElement>("[data-benefit-signal]"))
      .map((signal) => {
        const rect = signal.getBoundingClientRect();
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, viewportRect.right) - Math.max(rect.left, viewportRect.left),
        );
        return {
          height: rect.height,
          visibleWidth,
          fullyVisible: rect.left >= viewportRect.left - 1 && rect.right <= viewportRect.right + 1,
          textClipped: signal.scrollHeight > signal.clientHeight + 1,
        };
      });
    return {
      sectionHeight: element.closest<HTMLElement>("[data-product-benefits]")?.getBoundingClientRect().height ?? 0,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      signalRects,
    };
  });

  const heights = geometry.signalRects.map(({ height }) => height);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  expect(heights[0]).toBeGreaterThanOrEqual(112);
  expect(heights[0]).toBeLessThanOrEqual(128);
  expect(geometry.signalRects.filter(({ fullyVisible }) => fullyVisible)).toHaveLength(expectedFullyVisible);
  expect(geometry.signalRects.some(({ fullyVisible, visibleWidth }) => !fullyVisible && visibleWidth >= 16)).toBe(true);
  expect(geometry.signalRects.every(({ textClipped }) => !textClipped)).toBe(true);
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  expect(geometry.sectionHeight).toBeGreaterThanOrEqual(250);
  expect(geometry.sectionHeight).toBeLessThanOrEqual(320);
  await expectNoHorizontalPageOverflow(page);
});

test("ambient benefit stream loops on exact measured geometry and remains explicitly controllable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const region = page.getByRole("region", { name: "A clearer way through the search." });
  const viewport = region.locator("[data-benefits-viewport]");
  const track = region.locator("[data-benefits-track]");
  await expect(track).toHaveAttribute("data-motion-ready", "true");
  await expect(viewport).toHaveAttribute("data-benefits-motion", "ambient");
  await expect(viewport).not.toHaveAttribute("tabindex");
  await expect(region.locator("ol")).toHaveCount(1);
  await expect(region.locator("[data-benefit-signal]")).toHaveCount(7);
  await expect(region.locator("[data-benefit-clone]")).toHaveCount(7);
  await expect(region.getByRole("article")).toHaveCount(7);
  expect(await viewport.evaluate((element) => getComputedStyle(element).overflowX)).toBe("hidden");

  const geometry = await region.evaluate((element) => {
    const realGroup = element.querySelector<HTMLElement>("[data-benefit-real-group]")!;
    const realSignals = Array.from(realGroup.querySelectorAll<HTMLElement>("[data-benefit-signal]"));
    const cloneA = element.querySelector<HTMLElement>("[data-benefit-clone='search-perspective']")!;
    const first = realSignals[0].getBoundingClientRect();
    const second = realSignals[1].getBoundingClientRect();
    const last = realSignals.at(-1)!.getBoundingClientRect();
    const clone = cloneA.getBoundingClientRect();
    const distance = Number(element.querySelector<HTMLElement>("[data-benefits-track]")!.dataset.loopDistance);
    const duration = Number(element.querySelector<HTMLElement>("[data-benefits-track]")!.dataset.loopDuration);
    return {
      distance,
      duration,
      groupWidth: realGroup.getBoundingClientRect().width,
      ordinaryGap: second.left - first.right,
      seamGap: clone.left - last.right,
      startToCloneStart: clone.left - first.left,
    };
  });

  expect(Math.abs(geometry.groupWidth - geometry.distance)).toBeLessThan(0.1);
  expect(Math.abs(geometry.startToCloneStart - geometry.distance)).toBeLessThan(0.1);
  expect(Math.abs(geometry.seamGap - geometry.ordinaryGap)).toBeLessThan(0.1);
  expect(Math.abs(geometry.distance / geometry.duration - 28)).toBeLessThan(0.1);

  const seamContinuity = await track.evaluate((element) => {
    const animation = element.getAnimations()[0];
    const durationMs = Number(element.dataset.loopDuration) * 1_000;
    const realA = element.querySelector<HTMLElement>("[data-benefit-signal='search-perspective']")!;
    const cloneA = element.querySelector<HTMLElement>("[data-benefit-clone='search-perspective']")!;
    animation.pause();
    animation.currentTime = durationMs - 0.5;
    const before = cloneA.getBoundingClientRect().left;
    animation.currentTime = durationMs + 0.5;
    const after = realA.getBoundingClientRect().left;
    animation.currentTime = durationMs * 3 + 0.5;
    const afterThreeCycles = realA.getBoundingClientRect().left;
    return { before, after, afterThreeCycles };
  });
  expect(Math.abs(seamContinuity.before - seamContinuity.after)).toBeLessThan(0.1);
  expect(Math.abs(seamContinuity.after - seamContinuity.afterThreeCycles)).toBeLessThan(0.1);

  const pause = region.getByRole("button", { name: "Pause benefit stream" });
  await pause.click();
  await expect(track).toHaveAttribute("data-motion-state", "paused");
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await region.getByRole("button", { name: "Play benefit stream" }).click();
  await expect(track).toHaveAttribute("data-motion-state", "playing");
  await expect(track).toHaveCSS("animation-play-state", "running");

  const accessibility = await new AxeBuilder({ page })
    .include("[data-product-benefits]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await expectNoHorizontalPageOverflow(page);
});

test("ambient benefit stream visual is frozen at one deterministic coordinate", async ({
  page,
}, testInfo) => {
  test.skip(!["mobile-390", "desktop-1280"].includes(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const region = page.getByRole("region", { name: "A clearer way through the search." });
  const track = region.locator("[data-benefits-track]");
  await expect(track).toHaveAttribute("data-motion-ready", "true");
  await track.evaluate((element) => {
    element.style.setProperty("--hf-benefits-test-translation", "-384px");
    element.dataset.motionTest = "frozen";
  });
  const x = await track.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41);
  expect(x).toBe(-384);
  await expect(region).toHaveScreenshot("benefit-stream-frozen.png");
});

test("desktop scroll story reorganizes one workspace and releases from Action Center", async ({
  page,
}, testInfo) => {
  test.skip(!["desktop-1024", "desktop-1280"].includes(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });

  const story = page.locator("[data-scroll-story]");
  const stage = page.locator("[data-scroll-story-pin]");
  await expect(page.getByTestId("desktop-product-story")).toBeVisible();
  await expect(page.getByTestId("mobile-product-story")).toBeHidden();
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect(stage.locator("[data-connected-workspace]")).toHaveCount(1);
  await expect(stage.locator("[data-workspace-opportunity]")).toHaveCount(6);
  await expect(stage.locator("[data-flux-rail]")).toHaveCount(0);
  await expect(stage.locator("[data-workspace-applications]")).toBeVisible();
  expect(await stage.locator("[data-workspace-applications]").evaluate(
    (element) => Number(getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.98);
  await expect(stage.locator('[data-scroll-copy-stage="applications"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /Explore the Demo|Continue Demo/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Start Demo Workspace|Return to Workspace/ })).toHaveCount(0);

  const metrics = await stage.evaluate((element) => ({
    start: element.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2.5,
  }));
  const moveTo = async (progress: number) => {
    await page.evaluate(
      ({ start, travel, progress }) => window.scrollTo(0, start + travel * progress),
      { ...metrics, progress },
    );
    await page.waitForTimeout(450);
  };
  const readStageGeometry = async () => stage.evaluate((element) => {
    const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const shell = rect("[data-workspace-shell]");
    const envelope = rect("[data-workspace-stage-envelope]");
    const narrative = rect("[data-scroll-narrative]");
    const matrix = new DOMMatrix(getComputedStyle(element.querySelector("[data-workspace-shell]")!).transform);
    return {
      shell: { left: shell.left, right: shell.right, top: shell.top, bottom: shell.bottom, width: shell.width, height: shell.height },
      envelope: { left: envelope.left, right: envelope.right, top: envelope.top, bottom: envelope.bottom },
      gap: shell.left - narrative.right,
      transform: { x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d },
    };
  });
  const readNarrativeAnchors = async () => stage.evaluate((element) => {
    const activeCopy = Array.from(element.querySelectorAll<HTMLElement>("[data-scroll-copy-stage]"))
      .find((copy) => {
        const style = getComputedStyle(copy);
        return style.visibility !== "hidden" && Number(style.opacity) > 0.5;
      });
    if (!activeCopy) throw new Error("No visible narrative chapter");
    const top = (selector: string, root: ParentNode = activeCopy) =>
      (root.querySelector(selector) as HTMLElement).getBoundingClientRect().top;
    return {
      narrative: top("[data-scroll-narrative]", element),
      label: top("[data-scroll-copy-label]"),
      question: top("[data-scroll-copy-question]"),
      headline: top("[data-scroll-copy-headline]"),
      body: top("[data-scroll-copy-body]"),
      progress: top("[data-scroll-progress]", element),
    };
  });
  const expectAnchoredNarrative = (
    current: Awaited<ReturnType<typeof readNarrativeAnchors>>,
    baseline: Awaited<ReturnType<typeof readNarrativeAnchors>>,
  ) => {
    for (const anchor of ["narrative", "label", "question", "headline", "body", "progress"] as const) {
      expect(Math.abs(current[anchor] - baseline[anchor])).toBeLessThan(1.5);
    }
  };
  const expectStableGeometry = (current: Awaited<ReturnType<typeof readStageGeometry>>, baseline: Awaited<ReturnType<typeof readStageGeometry>>) => {
    expect(current.gap).toBeGreaterThanOrEqual(16);
    expect(current.shell.left).toBeGreaterThanOrEqual(current.envelope.left);
    expect(current.shell.right).toBeLessThanOrEqual(current.envelope.right);
    expect(current.shell.top).toBeGreaterThanOrEqual(current.envelope.top);
    expect(current.shell.bottom).toBeLessThanOrEqual(current.envelope.bottom);
    expect(Math.abs(current.shell.left - baseline.shell.left)).toBeLessThan(1);
    expect(Math.abs(current.shell.top - baseline.shell.top)).toBeLessThan(1);
    expect(Math.abs(current.shell.width - baseline.shell.width)).toBeLessThan(1);
    expect(Math.abs(current.shell.height - baseline.shell.height)).toBeLessThan(1);
    expect(Math.abs(current.transform.x)).toBeLessThan(0.1);
    expect(Math.abs(current.transform.y)).toBeLessThan(0.1);
    expect(Math.abs(current.transform.scaleX - 1)).toBeLessThan(0.001);
    expect(Math.abs(current.transform.scaleY - 1)).toBeLessThan(0.001);
  };
  const readProgressState = async () => stage.locator("[data-scroll-progress]").evaluate((element) => {
    const container = element.getBoundingClientRect();
    const segments = Array.from(element.querySelectorAll<HTMLElement>("[data-scroll-progress-segment]")).map((segment) => {
      const rect = segment.getBoundingClientRect();
      return {
        stage: segment.dataset.scrollProgressSegment,
        active: segment.hasAttribute("data-active"),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });
    return { left: container.left, top: container.top, width: container.width, height: container.height, segments };
  });
  const expectProgressState = async (
    chapter: string,
    baseline: Awaited<ReturnType<typeof readProgressState>>,
  ) => {
    const current = await readProgressState();
    for (const key of ["left", "top", "width", "height"] as const) {
      expect(Math.abs(current[key] - baseline[key])).toBeLessThan(1);
    }
    expect(current.segments.filter((segment) => segment.active).map((segment) => segment.stage)).toEqual([chapter]);
    expect(current.segments).toHaveLength(4);
    current.segments.forEach((segment, index) => {
      const expected = baseline.segments[index];
      for (const key of ["left", "top", "width", "height"] as const) {
        expect(Math.abs(segment[key] - expected[key])).toBeLessThan(1);
      }
    });
  };

  await moveTo(0.1);
  await expect(story).toHaveAttribute("data-active-chapter", "applications");
  await expect(stage.locator('[data-workspace-focus-primary="applications"]')).toBeVisible();
  await expect(stage.locator('[data-workspace-applications] [data-northstar-identity="applications"] [data-northstar-mark]')).toHaveText("NS");
  await expect(stage.locator('[data-workspace-applications] [data-workspace-opportunity="Atlas Systems"]')).toBeVisible();
  await expect(stage.locator('[data-workspace-applications] [data-workspace-opportunity="Harborline"]')).toBeVisible();
  const applicationsGeometry = await readStageGeometry();
  const applicationsNarrative = await readNarrativeAnchors();
  const applicationsProgress = await readProgressState();
  expectStableGeometry(applicationsGeometry, applicationsGeometry);
  await expectProgressState("applications", applicationsProgress);
  await moveTo(0.25);
  await expect(story).toHaveAttribute("data-active-chapter", "interviews");
  await expect(stage.locator("[data-workspace-applications]")).toBeHidden();
  await expect(stage.locator("[data-workspace-recent]")).toBeVisible();
  await expect(stage.locator("[data-workspace-handoff]")).toBeVisible();
  expect(await stage.locator("[data-workspace-shell]").evaluate(
    (element) => Number(getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.98);
  expect(await stage.locator("[data-workspace-recent]").evaluate(
    (element) => Number(getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.9);
  expect(await stage.locator("[data-workspace-interviews]").evaluate(
    (element) => Number(getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.98);
  expect(await stage.locator("[data-workspace-interview-content]").evaluate(
    (element) => Number(getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.7);
  expect(await stage.locator("[data-scroll-copy-stage]").filter({ visible: true }).count()).toBe(1);
  expectStableGeometry(await readStageGeometry(), applicationsGeometry);
  expectAnchoredNarrative(await readNarrativeAnchors(), applicationsNarrative);
  await expectProgressState("interviews", applicationsProgress);
  await page.evaluate(({ start }) => window.scrollTo(0, start - 100), metrics);
  await page.waitForTimeout(450);
  await expect(stage.locator("[data-workspace-applications]")).toBeVisible();
  await expect(stage.locator("[data-workspace-interviews]")).toBeHidden();
  await expect(stage.locator('[data-scroll-copy-stage="applications"]')).toBeVisible();
  await moveTo(0.32);
  await expect(story).toHaveAttribute("data-active-chapter", "interviews");
  await expect(stage.locator("[data-workspace-interviews]")).toBeVisible();
  await expect(stage.locator('[data-workspace-interviews] [data-workspace-focus-primary="interviews"]')).toContainText("Platform architecture and collaboration");
  await expect(stage.locator('[data-workspace-interviews] [data-workspace-focus-supporting="interviews"]')).toContainText("Next preparation action");
  await expect(stage.locator('[data-workspace-interviews] [data-northstar-identity="interviews"] [data-northstar-mark]')).toHaveText("NS");
  expectStableGeometry(await readStageGeometry(), applicationsGeometry);
  await moveTo(0.55);
  await expect(story).toHaveAttribute("data-active-chapter", "preparation");
  await expect(stage.locator("[data-workspace-interview-context]")).toBeVisible();
  await expect(stage.locator("[data-workspace-preparation]")).toBeVisible();
  await expect(stage.locator("[data-workspace-preparation-primary]")).toBeVisible();
  await expect(stage.locator('[data-workspace-preparation] [data-workspace-focus-primary="preparation"]')).toContainText("Write one more candidate question");
  await expect(stage.locator('[data-workspace-preparation] [data-workspace-focus-supporting="preparation"]')).toContainText("Candidate question");
  const retainedNorthstarMark = stage.locator('[data-workspace-interview-context] [data-northstar-mark]');
  const preparationNorthstarMark = stage.locator('[data-workspace-preparation] [data-northstar-identity="preparation"] [data-northstar-mark]');
  await expect(retainedNorthstarMark).toHaveText("NS");
  await expect(preparationNorthstarMark).toHaveText("NS");
  expect(
    await preparationNorthstarMark.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThan(
    await retainedNorthstarMark.evaluate((element) => element.getBoundingClientRect().width),
  );
  expectStableGeometry(await readStageGeometry(), applicationsGeometry);
  expectAnchoredNarrative(await readNarrativeAnchors(), applicationsNarrative);
  await expectProgressState("preparation", applicationsProgress);
  expect(await stage.locator("[data-scroll-copy-stage]").filter({ visible: true }).count()).toBe(1);
  expect(Math.abs(await stage.evaluate((element) => element.getBoundingClientRect().top))).toBeLessThan(3);
  await moveTo(0.81);
  await expect(story).toHaveAttribute("data-active-chapter", "action-center");
  await expectProgressState("action-center", applicationsProgress);
  await expect(stage.locator("[data-workspace-history]")).toBeVisible();
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  await expect(stage.locator("[data-workspace-priority-primary]")).toBeVisible();
  await expect(stage.locator('[data-workspace-actions] [data-workspace-focus-primary="action-center"]')).toContainText("Send a thoughtful follow-up");
  const featuredAction = stage.locator('[data-workspace-actions] [data-workspace-priority-primary]');
  await expect(featuredAction.locator("[data-workspace-action-decision]")).toHaveText("Send a thoughtful follow-up");
  await expect(featuredAction.locator("[data-workspace-action-urgency]")).toHaveText("Due today");
  await expect(featuredAction.locator("[data-workspace-action-rationale]")).toContainText("Technical screen complete");
  await expect(featuredAction.locator("[data-workspace-action-rationale]")).toContainText("Preparation retained");
  await expect(stage.locator('[data-workspace-actions] [data-workspace-focus-supporting="action-center"]')).toContainText("Atlas Systems");
  await expect(stage.locator('[data-workspace-actions] [data-northstar-identity="action-center"] [data-northstar-mark]')).toHaveText("NS");
  await expect(stage.locator('[data-workspace-actions] [data-workspace-priority="waiting"]')).toContainText("Atlas Systems");
  await expect(stage.locator('[data-workspace-actions] [data-workspace-priority="later"]')).toContainText("Harborline");
  expect(
    await stage.locator("[data-workspace-action-content]").evaluate(
      (element) => Number(getComputedStyle(element).opacity),
    ),
  ).toBeGreaterThan(0.75);
  expect(
    await stage.locator("[data-workspace-preparation]").evaluate(
      (element) => Number(getComputedStyle(element).opacity),
    ),
  ).toBeLessThan(0.06);
  expect(await stage.locator("[data-scroll-copy-stage]").filter({ visible: true }).count()).toBe(1);
  await moveTo(0.9);
  await expect(story).toHaveAttribute("data-active-chapter", "action-center");
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  await expect(stage.locator("[data-workspace-priority]")).toHaveCount(3);
  await expect(stage.locator("[data-workspace-priority-supporting]")).toBeVisible();
  expectStableGeometry(await readStageGeometry(), applicationsGeometry);
  expectAnchoredNarrative(await readNarrativeAnchors(), applicationsNarrative);
  await moveTo(0.68);
  await expect(story).toHaveAttribute("data-active-chapter", "preparation");
  await expect(stage.locator("[data-workspace-interview-context]")).toBeVisible();
  await expect(stage.locator("[data-workspace-preparation]")).toBeVisible();
  await expect(stage.locator("[data-workspace-actions]")).toBeHidden();
  await expect(stage.locator("[data-workspace-history]")).toBeHidden();
  await page.evaluate(
    ({ start, travel }) => {
      window.scrollTo(0, start + travel * 0.91);
      window.scrollTo(0, start + travel * 0.68);
      window.scrollTo(0, start + travel * 0.9);
    },
    metrics,
  );
  await page.waitForTimeout(500);
  await expect(story).toHaveAttribute("data-active-chapter", "action-center");
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  await moveTo(0.3);
  await expect(story).toHaveAttribute("data-active-chapter", "interviews");
  await expect(stage.locator("[data-workspace-interviews]")).toBeVisible();
  await expect(stage.locator("[data-workspace-preparation]")).toBeHidden();
  await expect(stage.locator("[data-workspace-interview-context]")).toBeHidden();
  await expect(stage.locator("[data-workspace-recent]")).toBeVisible();
  await page.evaluate(
    ({ start, travel }) => {
      window.scrollTo(0, start + travel * 0.68);
      window.scrollTo(0, start + travel * 0.31);
      window.scrollTo(0, start + travel * 0.66);
    },
    metrics,
  );
  await page.waitForTimeout(500);
  await expect(story).toHaveAttribute("data-active-chapter", "preparation");
  await expect(stage.locator("[data-workspace-preparation-primary]")).toBeVisible();
  await moveTo(0.1);
  await expect(story).toHaveAttribute("data-active-chapter", "applications");
  await expect(stage.locator("[data-workspace-applications]")).toBeVisible();
  await moveTo(0.98);
  await page.waitForTimeout(600);
  await expect(story).toHaveAttribute("data-active-chapter", "action-center");
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  await expect(stage.locator("[data-workspace-story-cta]")).toHaveCount(0);
  await expectProgressState("action-center", applicationsProgress);

  const footer = page.locator("footer");
  const release = await footer.evaluate((element) => ({
    footerTop: element.getBoundingClientRect().top + window.scrollY,
    viewportHeight: window.innerHeight,
  }));
  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel - 1),
    metrics,
  );
  await page.waitForTimeout(450);
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  expect(await footer.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(release.viewportHeight);
  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel + 1),
    metrics,
  );
  await page.waitForTimeout(450);
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  await page.evaluate(
    ({ footerTop, viewportHeight }) => window.scrollTo(0, footerTop - viewportHeight + 1),
    release,
  );
  await page.waitForTimeout(450);
  await expect(footer).toBeVisible();
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  await expectNoHorizontalPageOverflow(page);
});

test("scroll story breakpoint changes do not duplicate pin wrappers", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "full");

  await page.setViewportSize({ width: 1023, height: 720 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await page.setViewportSize({ width: 1024, height: 719 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await page.setViewportSize({ width: 1024, height: 720 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  const stage = page.locator("[data-scroll-story-pin]");
  await stage.scrollIntoViewIfNeeded();
  await page.setViewportSize({ width: 900, height: 768 });
  expect(await page.evaluate(() => matchMedia("(min-width: 900px) and (max-width: 1023.99px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)").matches)).toBe(true);
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect(page.getByTestId("desktop-product-story")).toBeVisible();

  await page.setViewportSize({ width: 899, height: 768 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "static");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);

  await page.setViewportSize({ width: 900, height: 768 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "static");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.getByTestId("mobile-product-story")).toBeVisible();

  await page.setViewportSize({ width: 1180, height: 650 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect(page.getByTestId("desktop-product-story")).toBeVisible();

  await page.setViewportSize({ width: 1180, height: 639 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "static");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);

  await page.setViewportSize({ width: 1180, height: 640 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "static");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.getByTestId("mobile-product-story")).toBeVisible();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect(page.getByTestId("desktop-product-story")).toBeVisible();
  expect(await page.locator(".pin-spacer").count()).toBe(1);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-scroll-mode", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
});

test("adapted scroll story remains progressive, contained, and reversible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.setViewportSize({ width: 900, height: 768 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });

  const story = page.locator("[data-scroll-story]");
  const stage = page.locator("[data-scroll-story-pin]");
  const shell = stage.locator("[data-workspace-shell]");
  const envelope = stage.locator("[data-workspace-stage-envelope]");
  await expect(story).toHaveAttribute("data-scroll-mode", "adapted");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect(page.getByTestId("desktop-product-story")).toBeVisible();
  await expect(page.getByTestId("mobile-product-story")).toBeHidden();

  const metrics = await stage.evaluate((element) => ({
    start: element.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2,
  }));
  const moveTo = async (progress: number) => {
    await page.evaluate(
      ({ start, travel, progress }) => window.scrollTo(0, start + travel * progress),
      { ...metrics, progress },
    );
    await page.waitForTimeout(900);
  };
  const expectContained = async () => {
    const geometry = await stage.evaluate((element) => {
      const shellRect = element.querySelector("[data-workspace-shell]")!.getBoundingClientRect();
      const envelopeRect = element.querySelector("[data-workspace-stage-envelope]")!.getBoundingClientRect();
      const narrativeRect = element.querySelector("[data-scroll-narrative]")!.getBoundingClientRect();
      return {
        gap: shellRect.left - narrativeRect.right,
        contained: shellRect.left >= envelopeRect.left
          && shellRect.right <= envelopeRect.right
          && shellRect.top >= envelopeRect.top
          && shellRect.bottom <= envelopeRect.bottom,
      };
    });
    expect(geometry.gap).toBeGreaterThanOrEqual(16);
    expect(geometry.contained).toBe(true);
    await expectNoHorizontalPageOverflow(page);
  };
  const readNarrativeAnchors = async () => stage.evaluate((element) => {
    const activeCopy = Array.from(element.querySelectorAll<HTMLElement>("[data-scroll-copy-stage]"))
      .find((copy) => {
        const style = getComputedStyle(copy);
        return style.visibility !== "hidden" && Number(style.opacity) > 0.5;
      });
    if (!activeCopy) throw new Error("No visible narrative chapter");
    const top = (selector: string, root: ParentNode = activeCopy) =>
      (root.querySelector(selector) as HTMLElement).getBoundingClientRect().top;
    return [
      top("[data-scroll-narrative]", element),
      top("[data-scroll-copy-label]"),
      top("[data-scroll-copy-question]"),
      top("[data-scroll-copy-headline]"),
      top("[data-scroll-copy-body]"),
      top("[data-scroll-progress]", element),
    ];
  });
  let narrativeBaseline: number[] | undefined;

  for (const [progress, chapter] of [
    [0.1, "applications"],
    [0.3, "interviews"],
    [0.55, "preparation"],
    [0.92, "action-center"],
  ] as const) {
    await moveTo(progress);
    await expect(story).toHaveAttribute("data-active-chapter", chapter);
    await expect(stage.locator(`[data-scroll-copy-stage="${chapter}"]`)).toBeVisible();
    await expectContained();
    const anchors = await readNarrativeAnchors();
    narrativeBaseline ??= anchors;
    anchors.forEach((anchor, index) => {
      expect(Math.abs(anchor - narrativeBaseline![index])).toBeLessThan(1.5);
    });
  }
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  await expect(stage.locator("[data-workspace-story-cta]")).toHaveCount(0);
  await expect(stage).toHaveScreenshot("scroll-story-adapted-action-center.png");
  await moveTo(0.55);
  await expect(story).toHaveAttribute("data-active-chapter", "preparation");
  await expect(stage.locator('[data-scroll-copy-stage="preparation"]')).toBeVisible();
  await moveTo(0.36);
  await expect(story).toHaveAttribute("data-active-chapter", "interviews");
  await expect(stage.locator('[data-scroll-copy-stage="interviews"]')).toBeVisible();
  await expectContained();
  await expect(stage).toHaveScreenshot("scroll-story-adapted-interviews.png");

  await moveTo(0.98);
  await expect(stage.locator("[data-workspace-actions]")).toBeVisible();
  await page.evaluate(({ start, travel }) => window.scrollTo(0, start + travel + 1), metrics);
  await page.waitForTimeout(900);
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  expect(await shell.count()).toBe(1);
  expect(await envelope.count()).toBe(1);
});

test("narrative handoffs transfer ownership at the semantic chapter boundaries", async ({ page }, testInfo) => {
  test.setTimeout(75_000);
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });

  const story = page.locator("[data-scroll-story]");
  const stage = page.locator("[data-scroll-story-pin]");
  const transitions = [
    { outgoing: "applications", incoming: "interviews", boundary: 0.24 },
    { outgoing: "interviews", incoming: "preparation", boundary: 0.46 },
    { outgoing: "preparation", incoming: "action-center", boundary: 0.76 },
  ] as const;
  const verifyMode = async (travelViewportHeights: number) => {
    const metrics = await stage.evaluate((element, travelViewportHeights) => ({
      start: element.getBoundingClientRect().top + window.scrollY,
      travel: window.innerHeight * travelViewportHeights,
    }), travelViewportHeights);
    const moveTo = async (progress: number) => {
      await page.evaluate(
        ({ start, travel, progress }) => window.scrollTo(0, start + travel * progress),
        { ...metrics, progress },
      );
      await page.waitForTimeout(700);
    };
    const samplePosition = async (progress: number) => {
      await page.evaluate(
        ({ start, travel, progress }) => window.scrollTo(0, start + travel * progress),
        { ...metrics, progress },
      );
      await page.waitForTimeout(120);
    };
    const opacity = (chapter: string) => stage.locator(`[data-scroll-copy-stage="${chapter}"]`).evaluate(
      (element) => Number(getComputedStyle(element).opacity),
    );
    const narrativeCoordinates = () => stage.evaluate((element) => {
      const rectangle = (target: Element) => {
        const rect = target.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width };
      };
      const progress = rectangle(element.querySelector("[data-scroll-progress]")!);
      const stackTransform = getComputedStyle(element.querySelector("[data-scroll-copy-stack]")!).transform;
      const chapters = Array.from(element.querySelectorAll<HTMLElement>("[data-scroll-copy-stage]")).map((copy) => {
        const rect = (selector: string) => rectangle(copy.querySelector(selector)!);
        const matrix = new DOMMatrix(getComputedStyle(copy).transform);
        return {
          stage: copy.dataset.scrollCopyStage,
          wrapper: rectangle(copy),
          label: rect("[data-scroll-copy-label]"),
          index: rect("[data-scroll-copy-index]"),
          question: rect("[data-scroll-copy-question]"),
          headline: rect("[data-scroll-copy-headline]"),
          body: rect("[data-scroll-copy-body]"),
          progress,
          translateX: matrix.m41,
          translateY: matrix.m42,
        };
      });
      return { chapters, stackTransform };
    });
    await moveTo(0.1);
    const coordinateBaseline = await narrativeCoordinates();
    const baselineChapter = coordinateBaseline.chapters.find(({ stage: baselineStage }) => baselineStage === "applications")!;
    const expectPositionLocked = async () => {
      const current = await narrativeCoordinates();
      expect(current.stackTransform).toBe("none");
      for (const chapter of current.chapters) {
        for (const anchor of ["wrapper", "label", "index", "question", "headline", "body", "progress"] as const) {
          for (const coordinate of ["left", "top", "width"] as const) {
            expect(Math.abs(chapter[anchor][coordinate] - baselineChapter[anchor][coordinate])).toBeLessThanOrEqual(0.25);
          }
        }
        expect(Math.abs(chapter.translateX)).toBeLessThan(0.01);
        expect(Math.abs(chapter.translateY)).toBeLessThan(0.01);
      }
    };

    for (const [progress, chapter] of [
      [0.1, "applications"],
      [0.3, "interviews"],
      [0.55, "preparation"],
      [0.9, "action-center"],
    ] as const) {
      await moveTo(progress);
      await expect(story).toHaveAttribute("data-active-chapter", chapter);
      await expectPositionLocked();
    }

    for (const { outgoing, incoming, boundary } of transitions) {
      for (const sample of [-0.012, -0.007, -0.002, 0.003, 0.008]) {
        await samplePosition(boundary + sample);
        await expectPositionLocked();
      }
      await moveTo(boundary - 0.01);
      await expect(story).toHaveAttribute("data-active-chapter", outgoing);
      expect(await opacity(outgoing)).toBeGreaterThan(0.65);
      expect(await opacity(incoming)).toBeLessThan(0.05);

      await moveTo(boundary + 0.003);
      await expect(story).toHaveAttribute("data-active-chapter", incoming);
      expect(await opacity(outgoing)).toBeLessThan(0.1);
      expect(await opacity(incoming)).toBeGreaterThan(0.85);
    }

    for (const { outgoing, incoming, boundary } of [...transitions].reverse()) {
      await moveTo(boundary + 0.006);
      expect(await opacity(incoming)).toBeGreaterThan(0.98);
      await moveTo(boundary - 0.01);
      await expect(story).toHaveAttribute("data-active-chapter", outgoing);
      expect(await opacity(outgoing)).toBeGreaterThan(0.65);
      expect(await opacity(incoming)).toBeLessThan(0.05);
      await expectPositionLocked();
    }

    await page.evaluate(
      ({ start, travel }) => {
        window.scrollTo(0, start + travel * 0.763);
        window.scrollTo(0, start + travel * 0.453);
        window.scrollTo(0, start + travel * 0.243);
      },
      metrics,
    );
    await page.waitForTimeout(750);
    await expect(story).toHaveAttribute("data-active-chapter", "interviews");
    expect(await opacity("applications")).toBeLessThan(0.1);
    expect(await opacity("interviews")).toBeGreaterThan(0.85);
    await expectPositionLocked();
  };

  await expect(story).toHaveAttribute("data-scroll-mode", "full");
  await verifyMode(2.5);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 900, height: 680 });
  await page.goto("/");
  await expect(story).toHaveAttribute("data-scroll-mode", "adapted");
  await verifyMode(2);
  await expectNoHorizontalPageOverflow(page);
});

test("scroll chapter semantics stay synchronized during large scrubbed jumps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });

  const story = page.locator("[data-scroll-story]");
  const stage = page.locator("[data-scroll-story-pin]");
  const metrics = await stage.evaluate((element) => ({
    start: element.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2.5,
  }));
  const assertSemanticVisualSync = async () => {
    const state = await story.evaluate((element) => ({
      active: element.getAttribute("data-active-chapter"),
      visibleCopies: Array.from(element.querySelectorAll<HTMLElement>("[data-scroll-copy-stage]"))
        .filter((copy) => {
          const styles = getComputedStyle(copy);
          return styles.visibility !== "hidden" && Number(styles.opacity) > 0.5;
        })
        .map((copy) => copy.dataset.scrollCopyStage),
    }));
    expect(state.visibleCopies).toEqual([state.active]);
  };

  for (const progress of [0.92, 0.1, 0.55, 0.3, 0.98] as const) {
    await page.evaluate(
      ({ start, travel, progress }) => window.scrollTo(0, start + travel * progress),
      { ...metrics, progress },
    );
    for (let sample = 0; sample < 4; sample += 1) {
      await page.waitForTimeout(80);
      await assertSemanticVisualSync();
    }
  }
});

test("footer enters only after the 1440 desktop story releases", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const stage = page.locator("[data-scroll-story-pin]");
  const footer = page.locator("footer");
  expect(await stage.locator("[data-workspace-shell]").evaluate(
    (element) => element.getBoundingClientRect().width,
  )).toBeGreaterThan(920);
  await expect(stage.locator("[data-workspace-applications]")).toBeVisible();
  const metrics = await stage.evaluate((element) => ({
    start: element.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2.5,
  }));
  const release = await footer.evaluate((element) => ({
    footerTop: element.getBoundingClientRect().top + window.scrollY,
    viewportHeight: window.innerHeight,
  }));

  await page.evaluate(({ start, travel }) => window.scrollTo(0, start + travel - 1), metrics);
  await page.waitForTimeout(450);
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  expect(await footer.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(release.viewportHeight);
  await page.evaluate(({ start, travel }) => window.scrollTo(0, start + travel + 1), metrics);
  await page.waitForTimeout(450);
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  await page.evaluate(({ footerTop, viewportHeight }) => window.scrollTo(0, footerTop - viewportHeight + 1), release);
  await page.waitForTimeout(450);
  await expect(footer).toBeVisible();
  expect(await stage.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
  await expectNoHorizontalPageOverflow(page);
});

test("desktop scroll story has focused Applications, Interviews, Preparation, and Action Center baselines", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const stage = page.locator("[data-scroll-story-pin]");
  const metrics = await stage.evaluate((element) => ({
    start: element.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2.5,
  }));
  expect(await stage.locator("[data-workspace-shell]").evaluate(
    (element) => element.getBoundingClientRect().width,
  )).toBeGreaterThan(820);

  for (const [chapter, progress] of [["applications", 0.05], ["interviews", 0.38], ["preparation", 0.68], ["action-center", 0.98]] as const) {
    await page.evaluate(
      ({ start, travel, progress }) => window.scrollTo(0, start + travel * progress),
      { ...metrics, progress },
    );
    await page.waitForTimeout(450);
    await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-active-chapter", chapter);
    await expect(stage).toHaveScreenshot(`scroll-story-${chapter}.png`);
  }

  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel * 0.25),
    metrics,
  );
  await page.waitForTimeout(700);
  await expect(stage).toHaveScreenshot("scroll-story-applications-to-interviews.png");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel * 0.5),
    metrics,
  );
  await page.waitForTimeout(1_500);
  await expect(stage).toHaveScreenshot("scroll-story-interviews-to-preparation.png");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel * 0.81),
    metrics,
  );
  await page.waitForTimeout(1_500);
  await expect(stage).toHaveScreenshot("scroll-story-preparation-to-action-center.png");
});

test("desktop transition and Action Center remain defined in light mode", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  await page.addInitScript(() =>
    window.localStorage.setItem("hireflux-color-theme", "light"),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const stage = page.locator("[data-scroll-story-pin]");
  const metrics = await stage.evaluate((element) => ({
    start: element.getBoundingClientRect().top + window.scrollY,
    travel: window.innerHeight * 2.5,
  }));
  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel * 0.25),
    metrics,
  );
  await page.waitForTimeout(700);
  expect(await stage.locator("[data-workspace-interview-content]").evaluate(
    (element) => Number(getComputedStyle(element).opacity),
  )).toBeGreaterThan(0.7);
  await expect(stage).toHaveScreenshot("scroll-story-applications-to-interviews-light.png");
  await page.evaluate(
    ({ start, travel }) => window.scrollTo(0, start + travel * 0.98),
    metrics,
  );
  await page.waitForTimeout(600);
  await expect(page.locator("[data-scroll-story]")).toHaveAttribute("data-active-chapter", "action-center");
  await expect(stage).toHaveScreenshot("scroll-story-action-center-light.png");
});

test("connected hero resolves one opportunity into one useful action", async ({
  page,
}, testInfo) => {
  test.skip(!["mobile-390", "desktop-1280"].includes(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  if (testInfo.project.name === "mobile-390") {
    await page.addInitScript(() =>
      window.localStorage.setItem("hireflux-color-theme", "light"),
    );
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Keep every opportunity connected to what comes next.",
      level: 1,
    }),
  ).toBeVisible();

  const story = page.locator("[data-flux-story]");
  await expect(story).toHaveAttribute("data-visual-stage", "resolved");
  await expect(story).toHaveAttribute("data-hero-settled", "true");
  await expect(story.locator("[data-persistent-opportunity]")).toHaveCount(1);
  await expect(story.locator("[data-flux-provenance]")).toContainText(
    "Interview complete · Preparation retained",
  );
  await expect(story.locator("[data-flux-next-action]")).toContainText(
    "Send a thoughtful follow-up",
  );
  await expect(
    page.getByRole("button", { name: /application story/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /show (capture|progress|prepare|act)/i }),
  ).toHaveCount(0);
  await expect(story.locator("[data-flux-interview]")).toHaveCount(0);
  await expect(story.locator("[data-flux-preparation]")).toHaveCount(0);
  await expect(story.locator("[data-flux-action]")).toHaveCount(0);
  await expect(story).toHaveScreenshot("connected-hero-resolved.png");

  await expectNoHorizontalPageOverflow(page);
  await page.reload();
  await expect(story).toHaveAttribute("data-hero-settled", "true");
  await expect(story.locator("[data-flux-next-action]")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
  await expect(page.locator("[data-flux-story]")).toHaveCount(0);

  await page.goto("/");
  await expect(page.locator("[data-flux-story]")).toHaveAttribute(
    "data-hero-settled",
    "true",
  );
  await expect(page.locator("[data-persistent-opportunity]")).toHaveCount(1);
});

test("authenticated entry does not download the lazy landing route", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  const landingChunkRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/(?:LandingPage|gsap|ScrollTrigger)-[^/]+\.js$/.test(request.url())) {
      landingChunkRequests.push(request.url());
    }
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
  expect(landingChunkRequests).toEqual([]);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Keep every opportunity connected to what comes next.", level: 1 }),
  ).toBeVisible();
  expect(landingChunkRequests.length).toBeGreaterThanOrEqual(1);
});

test("Home progress story stays coherent, keyboard-operable, and accessible", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const story = page.getByRole("region", {
    name: "How is my search progressing?",
  });
  await expect(story).toBeVisible();
  await expect(
    story.getByRole("link", { name: "View full Analytics" }),
  ).toHaveCount(1);
  await expect(story.getByText("Submission activity")).toHaveCount(0);
  await expect(story.getByText("Progress brief")).toHaveCount(0);

  const disclosure = story.getByRole("button", {
    name: "See what changed and why",
  });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(story.getByText("Compared with what", { exact: true })).toBeVisible();
  await expect(
    story.getByRole("heading", {
      name: "Two equal-length periods in your selected range",
    }),
  ).toBeVisible();
  await expect(story.getByText(/is compared with/)).toBeVisible();
  await expect(
    story.getByRole("progressbar", {
      name: "Active opportunities with a scheduled next step",
    }),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  const accessibility = await new AxeBuilder({ page })
    .include('section[aria-labelledby="progress-story-title"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await page.keyboard.press("Space");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
});

test("interview journey selection, preparation, and deep-link refresh stay connected", async ({
  page,
}) => {
  await page.goto("/interviews");
  await expect(
    page.getByRole("heading", { name: "Interview queue" }),
  ).toBeVisible();
  const responsiveSwitcher = page.getByRole("button", {
    name: "Switch interview",
  });
  const compactSwitcherVisible = await responsiveSwitcher.isVisible();
  if (compactSwitcherVisible) {
    await responsiveSwitcher.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Hide interview choices" }),
    ).toHaveAttribute("aria-expanded", "true");
  }

  const scheduledRound = page.getByRole("button", {
    name: /Northstar Labs, Technical screen/,
  });
  await scheduledRound.focus();
  await page.keyboard.press("Enter");
  if (compactSwitcherVisible) {
    await expect(
      page.getByRole("button", { name: "Switch interview" }),
    ).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(scheduledRound).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page).toHaveURL(
    /interview=44444444-4444-4444-8444-444444444444/,
  );
  await expect(page.getByText("Round 1 of 1")).toBeVisible();

  const prepare = page
    .getByRole("button", { name: "Continue preparation" })
    .first();
  await prepare.click();
  const drawer = page.getByRole("dialog", { name: "Interview preparation" });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Close workspace" }),
  ).toBeFocused();

  const firstChecklistItem = drawer.getByRole("checkbox", {
    name: /company and role/,
  });
  await firstChecklistItem.check();
  await expect(firstChecklistItem).toBeChecked();

  const addQuestion = drawer.getByRole("button", { name: "Add question" });
  await addQuestion.click();
  await drawer.getByRole("textbox", { name: "Candidate question 1" }).fill(
    "What does success look like?",
  );
  await drawer.getByRole("textbox", { name: "Candidate question 2" }).fill(
    "How does the team collaborate?",
  );
  await drawer.getByRole("textbox", { name: "Candidate question 3" }).fill(
    "What are the immediate priorities?",
  );
  await drawer
    .getByRole("button", { name: "Remove candidate question 2" })
    .click();
  await expect(
    drawer.getByRole("textbox", { name: "Candidate question 1" }),
  ).toBeFocused();
  await expect(
    drawer.getByRole("textbox", { name: /Candidate question/ }),
  ).toHaveCount(2);

  await drawer.getByText("Go deeper · optional preparation").click();
  await drawer
    .getByRole("textbox", { name: "Custom preparation item" })
    .fill("Review the portfolio example");
  await drawer.getByRole("button", { name: "Add item" }).click();
  await expect(
    drawer.getByRole("checkbox", { name: /Review the portfolio example/ }),
  ).toBeVisible();
  await drawer
    .getByRole("button", {
      name: "Remove custom preparation item: Review the portfolio example",
    })
    .click();
  await expect(
    drawer.getByRole("checkbox", { name: /Review the portfolio example/ }),
  ).toHaveCount(0);

  const moreTips = drawer.getByRole("button", { name: /more tips/ });
  await moreTips.click();
  await expect(
    drawer.getByRole("button", { name: "Show fewer tips" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(
    drawer.getByRole("alertdialog", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Discard changes" }).click();
  await expect(drawer).toBeHidden();
  await expect(prepare).toBeFocused();

  await page.reload();
  if (compactSwitcherVisible) {
    await expect(
      page.getByRole("button", { name: "Switch interview" }),
    ).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(scheduledRound).toHaveAttribute("aria-pressed", "true");
  }
  await expectNoHorizontalPageOverflow(page);
});

test("analytics overview progressively discloses supporting detail", async ({
  page,
}, testInfo) => {
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Your search story" }),
  ).toBeVisible();

  const outcomes = page.getByRole("button", {
    name: /Outcomes and conversion/,
  });
  const activity = page.getByRole("button", { name: /Activity and change/ });
  const followUp = page.getByRole("button", { name: /Follow-up readiness/ });
  const workPreferences = page.getByRole("button", {
    name: /Work preferences/,
  });
  for (const disclosure of [outcomes, activity, followUp, workPreferences]) {
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  }

  await outcomes.click();
  await activity.click();
  await expect(outcomes).toHaveAttribute("aria-expanded", "true");
  await expect(activity).toHaveAttribute("aria-expanded", "true");
  await expect(followUp).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Average first response")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compared with the previous period" }),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  if (testInfo.project.name === "desktop-1280") {
    await followUp.click();
    await workPreferences.click();
    await expect(page).toHaveScreenshot("analytics-overview-expanded.png", {
      fullPage: true,
    });
  }
});

test("analytics overview stays clear in the light theme", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("hireflux-color-theme", "light"),
  );
  await page.route("http://localhost:8000/api/v1/settings", async (route) => {
    await fulfillJson(route, {
      time_zone: "UTC",
      default_follow_up_days: 7,
      default_application_view: "ACTIVE",
      default_dashboard_range: "30d",
      theme: "LIGHT",
      created_at: "2026-08-10T13:00:00Z",
      updated_at: "2026-08-10T13:00:00Z",
      version: 1,
    });
  });

  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Your search story" }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expectNoHorizontalPageOverflow(page);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  if (testInfo.project.name === "desktop-1280") {
    await expect(page).toHaveScreenshot("analytics-overview-light.png", {
      fullPage: true,
    });
  }
});

test("keeps navigation present and consistent at breakpoint edges", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Run the breakpoint contract once.",
  );
  await page.addInitScript(() =>
    window.localStorage.setItem("hireflux-sidebar-collapsed", "false"),
  );

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 767, height: 844 },
    { width: 768, height: 1024 },
    { width: 1023, height: 1024 },
    { width: 1024, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Welcome back", level: 1 }),
    ).toBeVisible();
    await expectNoHorizontalPageOverflow(page);

    const sidebar = page.getByRole("complementary", {
      name: "Workspace navigation",
    });
    const mobileNavigation = page.getByRole("navigation", {
      name: "Mobile navigation",
    });

    if (viewport.width < 768) {
      await expect(sidebar).toBeHidden();
      await expect(mobileNavigation).toBeVisible();
      continue;
    }

    await expect(sidebar).toBeVisible();
    await expect(mobileNavigation).toBeHidden();

    if (viewport.width < 1024) {
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toBeVisible();
      await expect(
        sidebar.locator('nav[aria-label="Primary navigation"]'),
      ).toBeVisible();
      const sidebarWidth = await sidebar.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
      );
      expect(sidebarWidth).toBe(72);

      const trigger = page.getByRole("button", { name: "Open navigation" });
      await trigger.click();
      const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
      await expect(drawer).toBeVisible();
      await expect(
        drawer.getByRole("link", { name: "Analytics" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(trigger).toBeFocused();
      continue;
    }

    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeVisible();
    const expandedWidth = await sidebar.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width),
    );
    expect(expandedWidth).toBe(240);
  }
});

test("unified workspace links, staged filters, and drawer focus work with the keyboard", async ({
  page,
}) => {
  await page.goto("/applications");
  const filtersButton = page.getByRole("button", { name: /^Filters/ });
  await filtersButton.click();
  const drawer = page.getByRole("dialog", { name: "Application filters" });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Close panel" }),
  ).toBeFocused();
  await drawer.getByLabel("Source").selectOption("REFERRAL");
  await expect(page).not.toHaveURL(/source=/);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(filtersButton).toBeFocused();

  await filtersButton.click();
  await drawer.getByLabel("Source").selectOption("REFERRAL");
  await drawer.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/source=REFERRAL/);
  await expect(
    page.getByRole("button", { name: "Remove Source: Referral filter" }),
  ).toBeVisible();

  let previewRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      new URL(request.url()).pathname.endsWith("/notes/preview")
    ) {
      previewRequests += 1;
    }
  });
  await page.goto(`/applications/${applicationId}?section=notes`);
  await expect(page.getByText(/Review design-system decisions/)).toBeVisible();
  expect(previewRequests).toBeGreaterThan(0);
  await expect(page).toHaveURL(/section=notes/);
  await page.goto(`/applications/${applicationId}?tab=interviews`);
  await expect(page).toHaveURL(/section=interviews/);
  await expect(page.getByRole("heading", { name: "Interview process" })).toBeAttached();
});

test("application retrieval rows, transition drawer, and progressive form disclosure stay usable", async ({
  page,
}) => {
  await page.goto("/applications?view=ALL&layout=list");
  await expect(page).toHaveURL(/view=ALL/);
  await expect(page).not.toHaveURL(/layout=/);
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "List view" })).toHaveCount(0);

  await page.goto(`/applications/${applicationId}`);
  const statusTrigger = page.getByRole("button", { name: "Move to Screening" });
  await statusTrigger.click();
  const statusDrawer = page.getByRole("dialog", { name: "Move to Screening" });
  await expect(statusDrawer).toBeVisible();
  await expect(statusDrawer.getByRole("button", { name: "Close panel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(statusDrawer).toBeHidden();
  await expect(statusTrigger).toBeFocused();

  await page.goto("/applications/new");
  await expect(
    page.getByRole("heading", { name: "Add an application" }),
  ).toBeVisible();
  const optionalDetails = page
    .locator("details")
    .filter({ hasText: "More details" });
  await expect(optionalDetails).not.toHaveAttribute("open", "");
  await optionalDetails.locator("summary").click();
  await expect(optionalDetails).toHaveAttribute("open", "");
  await page.getByLabel(/Company/).fill("Acme");
  await page.getByLabel(/Role/).fill("Platform Engineer");
  await page.getByLabel(/Job description/).evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, "x".repeat(5001));
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await optionalDetails.locator("summary").click();
  await expect(optionalDetails).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page.getByText("Description must be 5000 characters or fewer.")).toBeVisible();
  await expect(optionalDetails).toHaveAttribute("open", "");
  await expect(page.getByLabel(/Job description/)).toBeFocused();
});

test("duplicate advice and creation failures remain non-blocking and preserve quick-capture data", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/api/v1/applications/duplicate-candidates",
    async (route) => {
      await fulfillJson(route, {
        candidates: [
          {
            application_id: applicationId,
            company_name: "Northstar Labs",
            job_title: "Senior Frontend Platform Engineer",
            status: "APPLIED",
            applied_date: "2026-08-08",
            created_at: "2026-08-08T13:00:00Z",
            confidence: "HIGH",
            matched_on: ["COMPANY", "TITLE"],
          },
        ],
      });
    },
  );
  await page.route("http://localhost:8000/api/v1/applications", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await fulfillJson(
      route,
      {
        error: {
          code: "TEMPORARILY_UNAVAILABLE",
          message: "Creation is temporarily unavailable.",
          request_id: "browser-create-failure",
        },
      },
      503,
    );
  });

  await page.goto("/applications/new");
  const company = page.getByLabel(/Company/);
  const role = page.getByLabel(/Role/);
  await company.fill("Northstar Labs");
  await role.fill("Senior Frontend Platform Engineer");
  await expect(page.getByText("You may already be tracking this role")).toBeVisible();
  await page.getByRole("button", { name: "Add application" }).click();

  await expect(
    page.getByRole("heading", { name: "Application could not be added" }),
  ).toBeVisible();
  await expect(company).toHaveValue("Northstar Labs");
  await expect(role).toHaveValue("Senior Frontend Platform Engineer");
  await expect(page.getByText("You may already be tracking this role")).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("the explicit light theme persists and remains accessible", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("hireflux-color-theme"),
    ),
  ).toBe("light");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await waitForLandingAnimationsToSettle(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await expectNoHorizontalPageOverflow(page);
  if (testInfo.project.name !== "desktop-1024") {
    await expect(page).toHaveScreenshot("landing-light.png", { fullPage: true });
  }
});

test("quick capture remains accessible in explicit light mode", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("hireflux-color-theme", "light"),
  );
  await page.route("http://localhost:8000/api/v1/settings", async (route) => {
    await fulfillJson(route, {
      time_zone: "UTC",
      default_follow_up_days: 7,
      default_application_view: "ACTIVE",
      default_dashboard_range: "30d",
      theme: "LIGHT",
      created_at: "2026-08-10T13:00:00Z",
      updated_at: "2026-08-10T13:00:00Z",
      version: 1,
    });
  });
  await page.goto("/applications/new");
  await expect(page.getByRole("heading", { name: "Add an application" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expectNoHorizontalPageOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  if (testInfo.project.name === "desktop-1280") {
    await expect(page).toHaveScreenshot("light-application-create.png", {
      fullPage: true,
    });
  }
});

test("principal workspace routes retain their layout in light mode", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Desktop light-mode baselines only.",
  );

  for (const route of routes.filter(
    ({ name }) => name !== "landing" && name !== "application-create",
  )) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading, level: 1 }),
    ).toBeVisible();
    const themeToggle = page.getByRole("button", {
      name: "Switch to light mode",
    });
    if (await themeToggle.isVisible()) await themeToggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.waitForTimeout(300);
    await expectNoHorizontalPageOverflow(page);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(`light-${route.name}.png`, {
      fullPage: true,
    });
  }
});

test("application opportunity workspace has a stable visual baseline", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Desktop visual baselines only.",
  );
  await page.goto(`/applications/${applicationId}`);

  await expect(
    page.getByRole("heading", { name: "One opportunity, unfolding over time" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  await expect(page).toHaveScreenshot("application-detail-workspace.png", { fullPage: true });
});

test("application loading, empty, failure, and retry states are explicit", async ({
  page,
}) => {
  let mode: "loading" | "empty" | "failure" = "loading";
  let releaseResponse: (() => void) | undefined;

  await page.route(
    "http://localhost:8000/api/v1/applications/workspace*",
    async (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/applications/workspace") {
        await route.fallback();
        return;
      }

      if (mode === "loading") {
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
      }

      if (mode === "failure") {
        await fulfillJson(
          route,
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Applications are temporarily unavailable.",
            },
          },
          503,
        );
        return;
      }

      await fulfillJson(route, {
        generated_at: "2026-08-27T14:00:00Z",
        groups: {
          needs_action: { total_count: 0, items: [], next_cursor: null },
          moving_forward: { total_count: 0, items: [], next_cursor: null },
          waiting: { total_count: 0, items: [], next_cursor: null },
        },
      });
    },
  );

  await page.goto("/applications");
  await expect(
    page.getByRole("status", { name: "Loading applications…" }),
  ).toBeVisible();
  await expect.poll(() => typeof releaseResponse).toBe("function");
  mode = "empty";
  releaseResponse?.();
  await expect(
    page.getByRole("heading", { name: "No active applications" }),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  mode = "failure";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Opportunity workspace could not be loaded" }),
  ).toBeVisible();
  await expect(
    page.getByText("Applications are temporarily unavailable."),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  mode = "empty";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No active applications" }),
  ).toBeVisible();
});

test("long application content stays contained", async ({ page }) => {
  const longApplication = {
    ...application,
    company_name: `International hiring collective ${"Northstar".repeat(24)}`,
    job_title: `Principal accessibility platform engineer ${"Frontend".repeat(24)}`,
    source_detail: `Specialist community ${"Referral".repeat(24)}`,
    salary_text: `$135,000–$155,000 ${"negotiable".repeat(20)}`,
    description: `A deliberately long application description ${"accessible-product-platform".repeat(32)}`,
  };

  await page.route(
    "http://localhost:8000/api/v1/applications/workspace*",
    (route) => fulfillJson(route, {
      generated_at: "2026-08-27T14:00:00Z",
      groups: {
        needs_action: { total_count: 0, items: [], next_cursor: null },
        moving_forward: { total_count: 0, items: [], next_cursor: null },
        waiting: {
          total_count: 1,
          items: [{
            application: longApplication,
            classification: {
              group: "waiting",
              reason_code: "RECENTLY_APPLIED",
              relevant_date: null,
              relevant_at: null,
              action_type: "OPEN_OPPORTUNITY",
              interview_id: null,
              next_interview: null,
            },
          }],
          next_cursor: null,
        },
      },
    }),
  );
  await page.route(
    "http://localhost:8000/api/v1/applications*",
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/v1/applications") {
        await fulfillJson(route, {
          items: [longApplication],
          next_cursor: null,
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.route(
    `http://localhost:8000/api/v1/applications/${applicationId}`,
    (route) => fulfillJson(route, longApplication),
  );

  await page.goto("/applications");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  await page.goto(`/applications/${applicationId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Principal accessibility platform engineer",
  );
  await expect(
    page.getByText(/A deliberately long application description/),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test("the desktop layout remains usable at a 200 percent zoom equivalent", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "One desktop zoom check is sufficient.",
  );
  await page.goto("/dashboard");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
  await expect(
    page.getByRole("heading", { name: "Welcome back", level: 1 }),
  ).toBeVisible();
});
