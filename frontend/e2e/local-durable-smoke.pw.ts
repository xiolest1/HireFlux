import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("real durable local workspace survives refresh, leave, and reactivation", async ({ page }) => {
  const bootstrapRequests: string[] = [];
  const failures: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) {
      expect(request.headers()["authorization"]).toBeUndefined();
      expect(request.headers()["x-user-id"]).toBeUndefined();
    }
    if (request.url().endsWith("/me/bootstrap")) bootstrapRequests.push(request.url());
  });
  page.on("pageerror", (error) => failures.push(error.message));

  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "No active applications", exact: true })).toBeVisible();
  expect(bootstrapRequests).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Reset demo" })).toHaveCount(0);
  await expect(page.getByText(/Expires in/)).toHaveCount(0);

  await page.goto("/applications/new");
  await page.getByRole("textbox", { name: /Company/ }).fill("Phase 2B Fictional Labs");
  await page.getByRole("textbox", { name: /Role/ }).fill("Durable Local Engineer");
  await page.getByText("Applied", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Applied", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  await page.getByRole("link", { name: "View application" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Durable Local Engineer");
  const applicationPath = new URL(page.url()).pathname;

  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page.getByRole("textbox", { name: "New note" }).fill("Fictional note survives refresh and reactivation.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText("Fictional note survives refresh and reactivation.")).toBeVisible();

  await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
  await page.getByRole("combobox", { name: "Interview type" }).selectOption("TECHNICAL_SCREEN");
  await page.getByLabel("Date and time").fill("2026-10-12T14:30");
  await page.locator('button[form="interview-schedule-form"]').click();
  await expect(page.getByText("Interview scheduled.", { exact: true })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("combobox", { name: "Time zone" }).selectOption("Asia/Tokyo");
  await page.getByRole("combobox", { name: "Color theme" }).selectOption("LIGHT");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved for this durable workspace.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Time zone" })).toHaveValue("Asia/Tokyo");
  await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveValue("LIGHT");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByText("Personal account preview")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: "test-results/phase2b-durable-settings-320.png", fullPage: true });

  await page.goto(applicationPath);
  await page.locator("#notes").scrollIntoViewIfNeeded();
  await expect(page.getByText("Fictional note survives refresh and reactivation.")).toBeVisible();
  await expect(page.getByText("Technical screen", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "More navigation", exact: true }).click();
  await page.getByRole("button", { name: "Leave local workspace" }).click();
  await expect(page.locator("[data-workspace-shell]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open local durable workspace" }).first()).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-workspace-shell]")).toHaveCount(0);
  await page.getByRole("button", { name: "Open local durable workspace" }).first().click();
  await expect(page.locator("[data-workspace-shell]")).toHaveCount(1);
  await page.goto(applicationPath);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Durable Local Engineer");
  await page.locator("#notes").scrollIntoViewIfNeeded();
  await expect(page.getByText("Fictional note survives refresh and reactivation.")).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("combobox", { name: "Time zone" })).toHaveValue("Asia/Tokyo");
  expect(failures).toEqual([]);
});
