import { expect, test } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

const sizes = [[1440, 900], [1280, 900], [1280, 800], [1818, 1080], [2182, 1651], [2215, 1687], [2157, 1797]] as const;
const checkpoints = [0.12, 0.32, 0.55, 0.76, 0.9, 0.94, 0.96, 0.98, 1, 1.02];

for (const theme of ["dark", "light"] as const) {
  for (const [width, height] of sizes) {
    test(`shared closing boundary ${width}x${height} ${theme}: forward, release, and reverse`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop-1280");
      test.setTimeout(60_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await installDeterministicApi(page);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: theme });
      await page.addInitScript((value) => localStorage.setItem("hireflux-color-theme", value), theme);
      await page.goto("/");
      await expect(page.locator("[data-connected-story]")).toHaveAttribute("data-connected-family", "j3");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/);
      await page.evaluate(() => document.fonts.ready);
      const range = await page.locator("[data-connected-j3]").evaluate((owner) => ({
        start: Number((owner as HTMLElement).dataset.connectedScrollStart),
        end: Number((owner as HTMLElement).dataset.connectedScrollEnd),
      }));
      expect(range.end - range.start).toBe(Math.round(height * 2.5));
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(range.end);
      const frames: unknown[] = [];
      for (const [direction, points] of [["forward", checkpoints], ["reverse", [...checkpoints].reverse()]] as const) {
        if (direction === "reverse") {
          // Short desktops reach the existing viewport-entry line after unpin.
          await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
          await expect(page.locator(".hf-post-story-reveal")).toHaveAttribute("data-reveal-state", "revealed");
        }
        for (const progress of points) {
          await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), range.start + (range.end - range.start) * progress);
          await page.waitForTimeout(750);
          const frame = await page.evaluate(() => {
            const find = (selector: string) => document.querySelector<HTMLElement>(selector)!;
            const track = find("[data-connected-closing-track]");
            const stage = find("[data-scroll-story-pin]");
            const shell = find("[data-connected-j3] [data-workspace-shell]");
            const heading = find("#quiet-coda-title");
            const coda = find("[data-quiet-coda]");
            return {
              stageTop: stage.getBoundingClientRect().top,
              shellBottom: shell.getBoundingClientRect().bottom,
              spacerBottom: track.parentElement!.getBoundingClientRect().bottom,
              codaTop: coda.getBoundingClientRect().top,
              headingTop: heading.getBoundingClientRect().top,
              gap: heading.getBoundingClientRect().top - shell.getBoundingClientRect().bottom,
              trackPosition: getComputedStyle(track).position,
              chapter: find("[data-connected-j3]").dataset.activeChapter,
              actualProgress: Number(find("[data-connected-j3]").dataset.connectedProgress),
              reveal: find(".hf-post-story-reveal").dataset.revealState,
              motion: find(".hf-post-story-reveal").dataset.revealMotion,
              spacers: document.querySelectorAll(".pin-spacer").length,
              owners: document.querySelectorAll("[data-connected-family-owner]").length,
              timelines: document.querySelectorAll('[data-connected-timeline-active="true"]').length,
              triggers: document.querySelectorAll('[data-connected-trigger-active="true"]').length,
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              introInsidePin: track.contains(find("#proof-title")),
              footerInsidePin: track.contains(find("footer")),
              footerAfterCoda: !!(coda.compareDocumentPosition(find("footer")) & Node.DOCUMENT_POSITION_FOLLOWING),
            };
          });
          frames.push({ direction, progress, ...frame });
          expect(frame.gap).toBeGreaterThanOrEqual(99);
          expect(frame.gap).toBeLessThanOrEqual(frame.reveal === "pending" ? 112 : 109);
          expect(frame).toMatchObject({ spacers: 1, owners: 1, timelines: 1, triggers: 1, introInsidePin: false, footerInsidePin: false, footerAfterCoda: true });
          expect(frame.overflow).toBeLessThanOrEqual(1);
          if (progress < 1) expect(frame.trackPosition).toBe("fixed");
          if (progress > 1) expect(frame.trackPosition).toBe("static");
          expect(Math.abs(frame.actualProgress - Math.min(1, progress))).toBeLessThan(0.001);
          const chapter = frame.actualProgress < 0.24 ? "applications" : frame.actualProgress < 0.46 ? "interviews" : frame.actualProgress < 0.76 ? "preparation" : "action-center";
          expect(frame.chapter).toBe(chapter);
          if (direction === "forward" && progress <= 0.9) expect(frame.reveal).toBe("pending");
          if (direction === "reverse") expect(frame.reveal).toBe("revealed");
        }
      }
      await info.attach("shared-boundary-geometry", { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
      expect(errors).toEqual([]);
    });
  }
}

test("Coda keyboard focus exits the shared pin and bypasses child choreography permanently", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1280");
  await installDeterministicApi(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const owner = page.locator("[data-connected-j3]");
  await expect(owner).toHaveAttribute("data-connected-timeline-active", "true");
  const range = await owner.evaluate((element) => ({ start: Number((element as HTMLElement).dataset.connectedScrollStart), end: Number((element as HTMLElement).dataset.connectedScrollEnd) }));
  await page.evaluate((y) => scrollTo(0, y), range.start + (range.end - range.start) * 0.55);
  await page.waitForTimeout(500);
  const action = page.locator("[data-quiet-coda] button");
  await action.focus();
  await expect(action).toBeFocused();
  await expect(action).toBeInViewport();
  await expect(page.locator("[data-connected-closing-track]")).toHaveCSS("position", "static");
  await expect(page.locator(".hf-post-story-reveal")).toHaveAttribute("data-reveal-motion", "none");
  for (const selector of ["[data-quiet-coda-word]", "[data-quiet-coda-support]", "[data-quiet-coda-action-cluster]"]) {
    await expect(page.locator(selector).first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(selector).first()).toHaveCSS("opacity", "1");
  }
  await action.evaluate((element) => (element as HTMLElement).blur());
  await expect(page.locator("[data-quiet-coda-action-cluster]")).toHaveCSS("animation-name", "none");
  await action.click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
});

test("height changes refresh without drift and tall J3 reload restores its chapter", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1280");
  await installDeterministicApi(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 2215, height: 1687 });
  await page.goto("/");
  const owner = page.locator("[data-connected-j3]");
  await expect(owner).toHaveAttribute("data-connected-timeline-active", "true");
  const range = await owner.evaluate((element) => ({ start: Number((element as HTMLElement).dataset.connectedScrollStart), end: Number((element as HTMLElement).dataset.connectedScrollEnd) }));
  await page.evaluate((y) => scrollTo(0, y), range.start + (range.end - range.start) * 0.55);
  await expect(owner).toHaveAttribute("data-active-chapter", "preparation");
  await expect.poll(() => page.evaluate(() => history.state?.__hirefluxConnectedStory?.chapter)).toBe("preparation");
  await page.reload();
  await expect(owner).toHaveAttribute("data-active-chapter", "preparation");
  await expect(page.locator("[data-connected-story]")).toHaveAttribute("data-connected-transition", "settled");
  await expect(page.locator(".hf-post-story-reveal")).toHaveAttribute("data-reveal-motion", "none");
  for (const height of [900, 1687, 900, 1687]) {
    await page.setViewportSize({ width: 2215, height });
    await expect.poll(() => owner.evaluate((element) => Number((element as HTMLElement).dataset.connectedScrollEnd) - Number((element as HTMLElement).dataset.connectedScrollStart))).toBe(Math.round(height * 2.5));
    await expect(owner).toHaveAttribute("data-connected-pin-top", height === 900 ? "0" : "462");
    // ScrollTrigger's existing delayed viewport refresh also needs to settle
    // before a synthetic checkpoint jump, which is not trusted user input.
    await page.waitForTimeout(350);
    const refreshed = await owner.evaluate((element) => ({ start: Number((element as HTMLElement).dataset.connectedScrollStart), end: Number((element as HTMLElement).dataset.connectedScrollEnd) }));
    await page.evaluate((y) => scrollTo(0, y), refreshed.start + (refreshed.end - refreshed.start) * 0.55);
    await page.waitForTimeout(500);
    await expect(owner).toHaveAttribute("data-active-chapter", "preparation");
    const gap = await page.evaluate(() => document.querySelector("#quiet-coda-title")!.getBoundingClientRect().top - document.querySelector("[data-connected-j3] [data-workspace-shell]")!.getBoundingClientRect().bottom);
    expect(gap).toBeCloseTo(height === 900 ? 100 : 108, 0);
    await expect(page.locator(".pin-spacer")).toHaveCount(1);
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator("[data-quiet-coda] button")).toBeInViewport();
  await page.reload();
  await expect(page.locator(".hf-post-story-reveal")).toHaveAttribute("data-reveal-state", "revealed");
  await expect(page.locator(".hf-post-story-reveal")).toHaveAttribute("data-reveal-motion", "none");
  await expect(page.locator("[data-quiet-coda-word]").first()).toHaveCSS("animation-name", "none");
  await expect(page.locator("[data-quiet-coda] button")).toBeInViewport();
});

test("Coda provisioning feedback shares Hero state and updates the existing closing geometry", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1280");
  await installDeterministicApi(page);
  await page.addInitScript(() => sessionStorage.removeItem("hireflux.demo-session.v1"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let fail!: () => void;
  const gate = new Promise<void>((resolve) => { fail = resolve; });
  await page.route("**/api/v1/demo-sessions", async (route) => {
    await gate;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Try again shortly.", request_id: "closing-test" } }) });
  });
  await page.goto("/");
  await expect(page.locator("[data-connected-j3]")).toHaveAttribute("data-connected-timeline-active", "true");
  await page.locator("[data-quiet-coda] button").focus();
  await page.locator("[data-quiet-coda] button").click();
  await expect(page.getByRole("button", { name: "Preparing your workspace…" })).toHaveCount(2);
  await expect(page.locator("[data-quiet-coda] button")).toBeDisabled();
  fail();
  await expect(page.locator("[data-quiet-coda]")).toContainText("Demo workspace could not be prepared");
  await expect(page.getByRole("button", { name: "Explore the Demo" })).toHaveCount(2);
  await expect(page.locator("[data-quiet-coda] button")).toBeEnabled();
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  const gap = await page.evaluate(() => document.querySelector("#quiet-coda-title")!.getBoundingClientRect().top - document.querySelector("[data-connected-j3] [data-workspace-shell]")!.getBoundingClientRect().bottom);
  expect(gap).toBeCloseTo(100, 0);
});
