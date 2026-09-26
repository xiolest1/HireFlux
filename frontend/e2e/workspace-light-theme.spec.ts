import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpportunityWorkspace } from "../src/api/schemas";
import { makeApplication, testDashboard } from "../src/test/fixtures";
import { applicationId, installDeterministicApi, installWorkspaceTheme } from "./fixtures";
import { homeFixtureActions, installHomeFixture, type HomeFixtureName } from "./homeFixtures";

const widths = [1440, 1280, 1024, 768, 430, 390, 320];

async function expectLightWorkspace(page: Page) {
  await expect(page.locator("[data-workspace-shell]")).toHaveCount(1);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--hf-canvas").trim())).toBe("#eef0f1");
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

// The legacy shared mock embeds a full interview where this response requires
// a compact preparation flag. Scope a valid response to the healthy route audit,
// leaving unrelated baseline fixtures and production validation unchanged.
async function installHealthyOpportunities(page: Page) {
  const workspace: OpportunityWorkspace = {
    generated_at: "2026-08-27T14:00:00Z",
    groups: {
      needs_action: { total_count: 0, items: [], next_cursor: null },
      moving_forward: {
        total_count: 1, next_cursor: null,
        items: [{
          application: makeApplication({ application_id: "22222222-2222-4222-8222-222222222222", company_name: "Cedar Analytics", status: "INTERVIEW" }),
          classification: { group: "moving_forward", reason_code: "INTERVIEW_SCHEDULED", relevant_date: null, relevant_at: "2026-09-02T15:00:00Z", action_type: "PREPARE_INTERVIEW", interview_id: "44444444-4444-4444-8444-444444444444", next_interview: { interview_id: "44444444-4444-4444-8444-444444444444", scheduled_at: "2026-09-02T15:00:00Z", preparation_essentials_complete: false } },
        }],
      },
      waiting: {
        total_count: 1, next_cursor: null,
        items: [{ application: makeApplication(), classification: { group: "waiting", reason_code: "RECENTLY_APPLIED", relevant_date: null, relevant_at: null, action_type: "OPEN_OPPORTUNITY", interview_id: null, next_interview: null } }],
      },
    },
  };
  await page.route("**/api/v1/applications/workspace?**", (route) => route.fulfill({ json: workspace }));
}

// Inspect actual browser colors, including color-mix and transparent ancestors;
// decorative outlines and genuinely disabled controls are not text/graphic cues.
async function inspectContrast(page: Page) {
  return page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    function color(css: string): number[] {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    }
    function composite(fg: number[], bg: number[]): number[] {
      return fg.slice(0, 3).map((v, i) => v * fg[3] / 255 + bg[i] * (1 - fg[3] / 255)).concat(255);
    }
    function background(element: Element | null): number[] {
      if (!element) return [255, 255, 255, 255];
      return composite(color(getComputedStyle(element).backgroundColor), background(element.parentElement));
    }
    function luminance(rgb: number[]): number {
      const c = rgb.slice(0, 3).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    }
    function ratio(fg: number[], bg: number[]): number {
      const a = luminance(composite(fg, bg)), b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    const textFailures = Array.from(document.querySelectorAll<HTMLElement>("main *")).flatMap((element) => {
      const ownText = Array.from(element.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim();
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!ownText || rect.width < 3 || rect.height < 3 || element.closest('[inert], .sr-only, [disabled]') || style.visibility === "hidden") return [];
      const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && parseInt(style.fontWeight) >= 700) ? 3 : 4.5;
      const actual = ratio(color(style.color), background(element));
      return actual >= required ? [] : [{ text: ownText.slice(0, 75), actual, required, color: style.color }];
    });
    const chart = document.querySelector(".hf-home-chart-bar")!;
    const select = document.querySelector("#dashboard-range")!;
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => color(root.getPropertyValue(`--hf-${name}`).trim());
    const tokenChecks = ["surface-raised", "canvas", "surface-muted", "surface-hover", "surface-pressed"].map((surface) => ({ surface, tertiary: ratio(token("ink-tertiary"), token(surface)), control: ratio(token("line-strong"), token(surface)) }));
    const focused = document.activeElement!;
    return {
      textFailures, tokenChecks,
      chart: ratio(color(getComputedStyle(chart).backgroundColor), background(chart.parentElement)),
      selectBorder: ratio(color(getComputedStyle(select).borderColor), background(select.parentElement)),
      focus: ratio(color(getComputedStyle(focused).outlineColor), background(focused.parentElement)),
      focusStyle: getComputedStyle(focused).outlineStyle,
    };
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "This suite explicitly exercises its full viewport matrix.");
  await installDeterministicApi(page);
  await installWorkspaceTheme(page);
});

for (const name of Object.keys(homeFixtureActions) as HomeFixtureName[]) {
  test(`refined light fixture: ${name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await installHomeFixture(page, name);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !(name === "partial" && message.text().includes("503"))) errors.push(message.text()); });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Recently updated" })).toBeVisible();
    const decision = page.locator("[data-home-decision]");
    if (name === "partial") await expect(page.getByText("Evidence is incomplete; this is not an all-clear.")).toBeVisible();
    if (name === "waiting") await expect(page.getByText("3 recorded opportunities are waiting")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : width <= 430 ? 844 : 900 });
      await expectLightWorkspace(page);
      await expectNoOverflow(page);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: join(tmpdir(), `hireflux-light-refinement-after-${name}-${width}.png`), fullPage: true });
      console.log(`Light geometry ${name} ${width}: ${await decision.evaluate((e) => e.getBoundingClientRect().height)}px`);
      if (width === 1280 || width === 390) {
        const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(accessibility.violations).toEqual([]);
      }
    }
    if (name === "volume") {
      await page.getByRole("button", { name: /See all 8 returned items/ }).click();
      await expect(page.getByRole("link", { name: /Research Partnership 8/ })).toBeVisible();
      await expectNoOverflow(page);
    }
    expect(errors).toEqual([]);
  });
}

test("rendered text, graphics, controls and focus retain sufficient contrast", async ({ page }, testInfo) => {
  await installHomeFixture(page, "peers");
  await page.goto("/dashboard");
  await expectLightWorkspace(page);
  const disclosure = page.locator('button[aria-controls="home-group-overdue-details"]');
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Complete follow-up" })).toBeVisible();
  const result = await inspectContrast(page);
  expect(result.textFailures).toEqual([]);
  for (const check of result.tokenChecks) {
    expect(check.tertiary, check.surface).toBeGreaterThanOrEqual(4.5);
    expect(check.control, check.surface).toBeGreaterThanOrEqual(3);
  }
  expect(result.chart).toBeGreaterThanOrEqual(3);
  expect(result.selectBorder).toBeGreaterThanOrEqual(3);
  expect(result.focus).toBeGreaterThanOrEqual(3);
  expect(result.focusStyle).not.toBe("none");
  await testInfo.attach("rendered-contrast", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  console.log(`Rendered contrast: chart ${result.chart.toFixed(2)}, control ${result.selectBorder.toFixed(2)}, focus ${result.focus.toFixed(2)}`);
});

test("workspace tokens reach portals, switch synchronously and leave landing defaults intact", async ({ page }) => {
  await page.goto("/dashboard");
  await expectLightWorkspace(page);
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Reset this demo?" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((e) => Boolean(e.closest("[data-workspace-shell]")))).toBe(false);
  expect(await dialog.evaluate((e) => getComputedStyle(e).getPropertyValue("--hf-ink").trim())).toBe("#20262f");
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-dialog.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--hf-canvas").trim())).toBe("#070b14");
  await expect.poll(() => page.locator('[aria-label="Primary navigation"] a[aria-current="page"]').evaluate((e) => getComputedStyle(e).boxShadow)).toBe("none");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expectLightWorkspace(page);
  await page.reload();
  await expectLightWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "More navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Workspace" })).toBeVisible();
  expect(await page.getByRole("dialog", { name: "Workspace" }).evaluate((e) => getComputedStyle(e).getPropertyValue("--hf-surface-muted").trim())).toBe("#e7ebed");
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("[data-workspace-shell]")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--hf-canvas").trim())).toBe("#f4f5f6");
});

test("all workspace destinations inherit the palette without overflow", async ({ page }) => {
  test.setTimeout(90_000);
  await installHealthyOpportunities(page);
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    for (const route of ["/applications", `/applications/${applicationId}`, "/applications/new", `/applications/${applicationId}/edit`, "/interviews", "/analytics", "/settings"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expectLightWorkspace(page);
      if (route === "/applications") await expect(page.getByRole("article").first()).toBeVisible();
      await expectNoOverflow(page);
      if (width === 1280 || width === 390) {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: join(tmpdir(), `hireflux-light-refinement-route-${route.slice(1).replaceAll("/", "-")}-${width}.png`), fullPage: true });
        expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
      }
    }
  }
});

test("menus, editing drawers and focused interview workspaces inherit light surfaces", async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/applications/${applicationId}`);
    await expectLightWorkspace(page);
    const trigger = page.getByRole("button", { name: "More opportunity actions" });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "More opportunity actions" });
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(255, 255, 255)");
    await page.screenshot({ path: join(tmpdir(), `hireflux-light-refinement-menu-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    const transition = page.getByRole("button", { name: "Move to Screening" });
    await transition.click();
    const drawer = page.getByRole("dialog", { name: "Move to Screening" });
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((e) => getComputedStyle(e).getPropertyValue("--hf-canvas").trim())).toBe("#eef0f1");
    await expect(drawer.getByRole("button", { name: "Close panel" })).toBeFocused();
    await expectNoOverflow(page);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: join(tmpdir(), `hireflux-light-refinement-edit-drawer-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(transition).toBeFocused();
    await page.goto("/interviews");
    await page.getByRole("button", { name: "Continue preparation" }).first().click();
    const workspace = page.getByRole("dialog", { name: "Interview preparation" });
    await expect(workspace).toBeVisible();
    expect(await workspace.evaluate((e) => Boolean(e.closest("[data-workspace-shell]")))).toBe(false);
    expect(await workspace.evaluate((e) => getComputedStyle(e).getPropertyValue("--hf-surface-muted").trim())).toBe("#e7ebed");
    await expect(workspace.getByRole("button", { name: "Close workspace" })).toBeFocused();
    await expectNoOverflow(page);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: join(tmpdir(), `hireflux-light-refinement-focused-workspace-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(workspace).toHaveCount(0);
  }
});

test("loading, no records and mutation feedback remain distinct in light mode", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/v1/dashboard?**", async (route) => {
    await pending;
    await route.fulfill({ json: { ...testDashboard, summary: { ...testDashboard.summary, total_tracked: 0, active_pursuits: 0 } } });
  });
  await page.goto("/dashboard");
  await expectLightWorkspace(page);
  await expect(page.getByRole("status", { name: "Checking recorded work" })).toBeVisible();
  await expect(page.locator('[data-home-decision="loading"]')).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-loading.png"), fullPage: true });
  release();
  await expect(page.getByRole("link", { name: "Record an application" })).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-no-records.png"), fullPage: true });
  await installHomeFixture(page, "peers");
  await page.route("**/api/v1/applications/*/follow-up/complete", (route) => route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT", message: "The record changed. Try again.", request_id: "light-fixture" } } }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Details.*Recorded overdue/ }).click();
  await page.getByRole("button", { name: "Complete follow-up" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up could not be updated" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete follow-up" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Overdue follow-up" })).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-mutation-error.png"), fullPage: true });
  let finish!: () => void;
  const completion = new Promise<void>((resolve) => { finish = resolve; });
  let completed = false;
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: { ...testDashboard, actions: completed ? homeFixtureActions.peers.slice(1) : homeFixtureActions.peers } }));
  await page.route("**/api/v1/applications/*/follow-up/complete", async (route) => {
    await completion;
    completed = true;
    await route.fulfill({ json: makeApplication({ follow_up_date: null, version: 2 }) });
  });
  await page.getByRole("button", { name: "Complete follow-up" }).click();
  await expect(page.getByRole("button").filter({ has: page.getByRole("status").filter({ hasText: "Completing…" }) })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reschedule", exact: true })).toBeDisabled();
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-mutation-pending.png"), fullPage: true });
  finish();
  await expect(page.getByText("Follow-up completed.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What can I work on now?" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Overdue follow-up" })).toHaveCount(0);
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-mutation-success.png"), fullPage: true });
});

test("320px enlarged text keeps long content and workflow controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: { ...testDashboard, actions: [{ ...homeFixtureActions.peers[0], company_name: "International Systems and Research Partnership", job_title: "Senior Infrastructure Reliability Engineer, Developer Productivity & Internal Platforms", label: "Confirm the recorded next step and whether the candidate should prepare more portfolio examples." }] } }));
  await page.goto("/dashboard");
  await expectLightWorkspace(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const disclosure = page.locator('button[aria-controls="home-group-overdue-details"]');
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  const complete = page.getByRole("button", { name: "Complete follow-up" });
  await expect(complete).toBeVisible();
  await complete.focus();
  await expect(complete).toBeFocused();
  expect(await complete.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await expectNoOverflow(page);
  await page.screenshot({ path: join(tmpdir(), "hireflux-light-refinement-enlarged-expanded-320.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
});
