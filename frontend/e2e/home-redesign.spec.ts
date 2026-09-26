import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDashboard } from "../src/test/fixtures";
import { installDeterministicApi } from "./fixtures";
import { homeFixtureActions, installHomeFixture, type HomeFixtureName } from "./homeFixtures";

test.beforeEach(async ({ page }) => {
  await installDeterministicApi(page);
});

test("Home retains distinct waiting and incomplete-evidence outcomes", async ({ page }) => {
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: testDashboard }));
  await page.route("**/api/v1/applications/workspace?**", (route) => route.fulfill({
    json: {
      generated_at: "2026-08-12T13:00:00Z",
      groups: {
        needs_action: { total_count: 0, items: [], next_cursor: null },
        moving_forward: { total_count: 0, items: [], next_cursor: null },
        waiting: { total_count: 3, items: [], next_cursor: null },
      },
    },
  }));
  await page.goto("/dashboard");
  const band = page.getByRole("region", { name: "What can I work on now?" });
  await expect(band.getByText("Some opportunities are in a waiting state")).toBeVisible();
  await expect(band.getByText(/Check each record's ownership/)).toBeVisible();
  await expect(band.getByText(/all-clear/)).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('section[aria-labelledby="home-decision-title"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Home does not infer an all-clear when ownership evidence fails", async ({ page }) => {
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: testDashboard }));
  await page.route("**/api/v1/applications/workspace?**", (route) => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Unavailable", request_id: "test" } } }));
  await page.goto("/dashboard");
  const band = page.getByRole("region", { name: "What can I work on now?" });
  await expect(band.getByText("The full decision context is not available")).toBeVisible();
  await expect(band.getByText("Evidence is incomplete; this is not an all-clear.")).toBeVisible();
  await expect(band.getByRole("button", { name: "Retry missing information" })).toBeVisible();
});

test("an empty recorded search cannot inherit a conflicting Analytics story", async ({ page }) => {
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({
    json: { ...testDashboard, summary: { ...testDashboard.summary, total_tracked: 0, active_pursuits: 0 }, actions: [], recent_applications: [] },
  }));
  await page.goto("/dashboard");
  const band = page.getByRole("region", { name: "What can I work on now?" });
  await expect(band.getByText("Start with a recorded opportunity")).toBeVisible();
  await expect(band.getByRole("link", { name: "Record an application" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search activity" })).toHaveCount(0);
});

test("Home keeps long peer commitments and their reasons visible without horizontal overflow", async ({ page }) => {
  const actions = Array.from({ length: 8 }, (_, index) => ({
    kind: "FOLLOW_UP_OVERDUE",
    application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    company_name: `International Systems and Research Partnership ${index + 1}`,
    job_title: "Senior Infrastructure Reliability Engineer, Developer Productivity & Internal Platforms",
    due_date: "2026-08-11",
    priority: "HIGH",
    label: "Check back about the recorded next step and confirm whether there is anything the candidate should prepare.",
    responsibility: "EMPLOYER",
  }));
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: { ...testDashboard, actions } }));
  await page.goto("/dashboard");
  const band = page.getByRole("region", { name: "What can I work on now?" });
  await expect(band.getByText("8 overdue")).toBeVisible();
  await expect(band.getByRole("link", { name: /Senior Infrastructure Reliability Engineer.*Partnership 1/ })).toBeVisible();
  await expect(band.getByText(/Check back about the recorded next step/).first()).toBeVisible();
  await expect(band.getByRole("button", { name: /See all 8 returned items/ })).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await band.getByRole("button", { name: /See all 8 returned items/ }).click();
  await expect(band.getByRole("link", { name: /Senior Infrastructure Reliability Engineer.*Partnership 8/ })).toBeVisible();
});

test("a single recorded commitment leads without promoting review suggestions", async ({ page }) => {
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: {
    ...testDashboard,
    actions: [
      { kind: "FOLLOW_UP_TODAY", application_id: "11111111-1111-4111-8111-111111111111", company_name: "Northstar Labs", job_title: "Product Designer", due_date: "2026-08-12", priority: "MEDIUM", label: "Send saved follow-up", responsibility: "CANDIDATE" },
      { kind: "STALE_APPLICATION", application_id: "22222222-2222-4222-8222-222222222222", company_name: "Beacon", job_title: "Analyst", priority: "LOW", label: "Review after 14 days in stage" },
    ],
  } }));
  await page.goto("/dashboard");
  const decision = page.getByRole("region", { name: "What can I work on now?" });
  await expect(decision.getByText("1 due today")).toBeVisible();
  await expect(decision.getByRole("heading", { name: "Due today" })).toBeVisible();
  await expect(decision.getByRole("heading", { name: "Suggested review · Time in stage" })).toBeVisible();
  await expect(decision.getByText(/No recorded deadline/).first()).toBeVisible();
  await expect(decision.locator('[aria-labelledby="home-group-today"]')).toHaveAttribute("data-focal", "true");
  await expect(decision.locator('[aria-labelledby="home-group-review"]')).not.toHaveAttribute("data-focal", "true");
});

test("competing commitments remain peers and interviews open the correct opportunity section", async ({ page }, testInfo) => {
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: {
    ...testDashboard,
    actions: [
      { kind: "FOLLOW_UP_OVERDUE", application_id: "11111111-1111-4111-8111-111111111111", company_name: "Northstar", job_title: "Designer", due_date: "2026-08-11", priority: "HIGH", label: "Send saved check-back" },
      { kind: "INTERVIEW_SOON", application_id: "22222222-2222-4222-8222-222222222222", company_name: "Cedar", job_title: "Engineer", due_at: "2026-08-13T13:00:00Z", priority: "HIGH", label: "Prepare for scheduled interview" },
    ],
  } }));
  await page.goto("/dashboard");
  const decision = page.getByRole("region", { name: "What can I work on now?" });
  await expect(decision.getByText("1 overdue")).toBeVisible();
  await expect(decision.getByText("1 interview")).toBeVisible();
  await expect(decision.locator('[aria-labelledby="home-group-overdue"]')).not.toHaveAttribute("data-focal", "true");
  await expect(decision.locator('[aria-labelledby="home-group-interviews"]')).not.toHaveAttribute("data-focal", "true");
  await expect(decision.getByRole("link", { name: "Interviews for Engineer · Cedar" })).toHaveAttribute("href", "/applications/22222222-2222-4222-8222-222222222222?section=interviews");
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  if ((page.viewportSize()?.width ?? 0) <= 390) {
    const positions = await page.evaluate(() => ({
      strip: document.querySelector('[aria-label="Recorded conditions"]')?.getBoundingClientRect().bottom ?? Infinity,
      secondBottom: document.querySelector('[aria-labelledby="home-group-interviews"] a')?.getBoundingClientRect().bottom ?? Infinity,
      viewport: window.innerHeight,
    }));
    expect(positions.strip).toBeLessThan(positions.viewport - 64);
    expect(positions.secondBottom).toBeLessThan(positions.viewport - 64);
    if (page.viewportSize()?.width === 320) {
      const interviewNavLines = await page.getByRole("navigation", { name: "Mobile navigation" }).getByText("Interviews").evaluate((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return range.getClientRects().length;
      });
      expect(interviewNavLines).toBe(1);
      await page.screenshot({ path: testInfo.outputPath("home-peer-320.png") });
    }
  }
  const axe = await new AxeBuilder({ page }).include('section[aria-labelledby="home-decision-title"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("peer commitments remain readable and keyboard-operable at enlarged phone text", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "narrow-320");
  await page.goto("/dashboard");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const decision = page.getByRole("region", { name: "What can I work on now?" });
  await expect(decision.getByText("1 overdue")).toBeVisible();
  await expect(decision.getByText("1 interview")).toBeVisible();
  const interview = decision.getByRole("link", { name: /Interviews for Product Design Systems Lead/ });
  await interview.focus();
  await expect(interview).toBeFocused();
  await expect(interview).toHaveAttribute("href", /\/applications\/.*\?section=interviews/);
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((element) => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })),
  }));
  expect(width.scroll, JSON.stringify(width.offenders)).toBeLessThanOrEqual(width.client + 1);
  const details = decision.locator('button[aria-controls="home-group-overdue-details"]');
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("aria-expanded", "true");
  const complete = decision.getByRole("button", { name: "Complete follow-up" });
  await expect(complete).toBeVisible();
  await complete.focus();
  await expect(complete).toBeFocused();
  expect(await complete.evaluate((element) => element.getBoundingClientRect().right <= element.closest("article")!.getBoundingClientRect().right)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.screenshot({ path: testInfo.outputPath("home-320-200-percent.png"), fullPage: true });
});

test("peer decision hierarchy remains distinct in phone light mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "More navigation" }).click();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const decision = page.getByRole("region", { name: "What can I work on now?" });
  await expect(decision.getByText("1 overdue")).toBeVisible();
  await expect(decision.getByText("1 interview")).toBeVisible();
  await expect(decision.locator('[aria-labelledby="home-group-overdue"]')).not.toHaveAttribute("data-focal", "true");
  await expect(decision.locator('[aria-labelledby="home-group-interviews"]')).not.toHaveAttribute("data-focal", "true");
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  const axe = await new AxeBuilder({ page }).include('section[aria-labelledby="home-decision-title"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Home composition remains coherent at wide desktop and 430px in both themes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    const decision = page.getByRole("region", { name: "What can I work on now?" });
    await expect(decision.getByText("1 overdue")).toBeVisible();
    await expect(decision.getByText("1 interview")).toBeVisible();
    for (const theme of ["dark", "light"] as const) {
      if (theme === "light") {
        if (viewport.width < 768) await page.getByRole("button", { name: "More navigation" }).click();
        await page.getByRole("button", { name: "Switch to light mode" }).click();
        if (viewport.width < 768) {
          await page.getByRole("button", { name: "Close panel" }).click();
          await expect(page.locator('[role="dialog"]')).toHaveCount(0);
        }
        await expect(page.locator("html")).not.toHaveClass(/dark/);
      }
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}-${theme}.png`), fullPage: true });
    }
  }
});

for (const name of Object.keys(homeFixtureActions) as HomeFixtureName[]) {
  test(`open-canvas rendered fixture: ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1280");
    test.setTimeout(90_000);
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("503")) consoleErrors.push(message.text()); });
    await installHomeFixture(page, name);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1440, 1280, 768, 430, 390, 320]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : width <= 430 ? 844 : 900 });
      await page.goto("/dashboard");
      const decision = page.getByRole("region", { name: "What can I work on now?" });
      await expect(page.getByText("16 tracked", { exact: false })).toBeVisible();
      await expect(decision.getByText("Limited Home result")).toBeVisible();
      if (name === "partial") await expect(decision.getByText("Evidence is incomplete; this is not an all-clear.")).toBeVisible();
      if (name === "waiting") await expect(decision.getByText("3 recorded opportunities are waiting")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recently updated" })).toBeVisible();
      await expect(page.getByRole("figure", { name: "Weekly submitted applications" })).toBeVisible();
      const commitmentCount = name === "peers" || name === "volume" ? 3 : name === "focal" ? 1 : 0;
      await expect(decision.locator("[data-home-commitment]")).toHaveCount(commitmentCount);
      await expect(decision.locator('[data-focal="true"]')).toHaveCount(name === "focal" ? 1 : 0);
      for (const theme of ["dark", "light"] as const) {
        await page.evaluate((nextTheme) => {
          localStorage.setItem("hireflux-color-theme", nextTheme);
          document.documentElement.classList.toggle("dark", nextTheme === "dark");
          window.dispatchEvent(new Event("hireflux-theme-change"));
        }, theme);
        await page.evaluate(() => document.fonts.ready);
        const geometry = await decision.evaluate((element) => ({ height: element.getBoundingClientRect().height, width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        expect(geometry.width).toBeLessThanOrEqual(geometry.viewport + 1);
        if (name === "peers") {
          // Comparative exposure, not a production height limit: all copy still wraps naturally.
          expect(geometry.height).toBeLessThan(width >= 1280 ? 700 : width === 390 ? 950 : 1600);
        }
        await page.mouse.move(0, 0);
        const path = join(tmpdir(), `hireflux-open-home-after-${name}-${width}-${theme}.png`);
        await page.screenshot({ path, fullPage: true });
        if (width === 1280 || width === 390) await testInfo.attach(`${name}-${width}-${theme}`, { path, contentType: "image/png" });
        if (width === 1280 || width === 390) console.log(`Home geometry ${name} ${width} ${theme}: ${geometry.height}px`);
      }
    }
    // Every returned item remains reachable inline; these are not equivalent to an exhaustive search.
    if (name === "volume") {
      await page.getByRole("button", { name: /See all 8 returned items/ }).click();
      await expect(page.getByRole("link", { name: /Research Partnership 8/ })).toBeVisible();
    }
    if (name === "peers" || name === "focal" || name === "undated") {
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(axe.violations).toEqual([]);
    }
    expect(consoleErrors).toEqual([]);
  });
}
