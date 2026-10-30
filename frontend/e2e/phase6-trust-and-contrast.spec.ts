import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { applicationId, installDeterministicApi, installWorkspaceTheme } from "./fixtures";

let externalRequests: string[] = [];
test.beforeEach(async ({ context, page }) => {
  externalRequests = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.fallback();
    externalRequests.push(url.hostname);
    await route.abort();
  });
  await installDeterministicApi(page);
});
test.afterEach(() => expect(externalRequests).toEqual([]));

for (const theme of ["LIGHT", "DARK"] as const) {
  test(`shared danger action effective contrast in ${theme.toLowerCase()} workspace`, async ({ page }, info) => {
    await installWorkspaceTheme(page, theme);
    await page.goto(`/applications/${applicationId}`);
    await page.getByRole("button", { name: "More opportunity actions" }).click();
    await page.getByRole("menuitem", { name: "Archive opportunity" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Archive this opportunity?" });
    const danger = dialog.getByRole("button", { name: "Archive opportunity", exact: true });
    await expect(danger).toBeVisible();
    await expect(page.locator("html")).toHaveClass(theme === "DARK" ? /dark/ : /^(?!.*dark).*$/);

    const contrast = () => danger.evaluate((element) => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const rgba = (css: string) => {
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      };
      const composite = (fg: number[], bg: number[]) => fg.slice(0, 3).map((v, i) => v * fg[3] / 255 + bg[i] * (1 - fg[3] / 255)).concat(255);
      const background = (node: Element | null): number[] => node ? composite(rgba(getComputedStyle(node).backgroundColor), background(node.parentElement)) : [255, 255, 255, 255];
      const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
      const style = getComputedStyle(element);
      const brightness = Number(/brightness\(([^)]+)\)/.exec(style.filter)?.[1] ?? 1);
      const filter = (rgb: number[]) => rgb.slice(0, 3).map(v => v * brightness).concat(255);
      const bg = filter(background(element));
      const parent = background(element.parentElement);
      return {
        text: ratio(filter(composite(rgba(style.color), background(element))), bg),
        boundary: ratio(filter(composite(rgba(style.borderColor), parent)), parent),
        focus: ratio(filter(composite(rgba(style.outlineColor), parent)), parent),
        outlineWidth: Number.parseFloat(style.outlineWidth),
        filter: style.filter,
        foreground: style.color,
        background: style.backgroundColor,
        disabledPalette: rgba(style.color).join() === rgba(style.getPropertyValue("--hf-ink-disabled").trim()).join()
          && rgba(style.backgroundColor).join() === rgba(style.getPropertyValue("--hf-surface-muted").trim()).join(),
      };
    });
    const enabled = await contrast();
    expect(enabled.text).toBeGreaterThanOrEqual(4.5);
    expect(enabled.boundary).toBeGreaterThanOrEqual(3);
    await danger.hover();
    await expect.poll(async () => (await contrast()).filter).toContain("brightness(0.9)");
    const hover = await contrast();
    expect(hover.text).toBeGreaterThanOrEqual(4.5);
    expect(hover.boundary).toBeGreaterThanOrEqual(3);
    await page.mouse.move(0, 0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(danger).toBeFocused();
    const focused = await contrast();
    expect(focused.text).toBeGreaterThanOrEqual(4.5);
    expect(focused.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focused.focus).toBeGreaterThanOrEqual(3);
    expect((await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze()).violations).toEqual([]);
    await dialog.screenshot({ path: info.outputPath(`archive-${theme.toLowerCase()}.png`) });

    // Synthetic DOM-only state inspection: never activate the archive action.
    await danger.evaluate((element: HTMLButtonElement) => { element.disabled = true; });
    await expect(danger).toBeDisabled();
    // The shared button transitions color/background for its existing UI duration.
    await expect.poll(async () => (await contrast()).disabledPalette).toBe(true);
    const disabled = await contrast();
    expect(disabled.foreground).not.toBe(enabled.foreground);
    expect(disabled.background).not.toBe(enabled.background);
    await info.attach("effective-danger-states", { body: JSON.stringify({ theme, enabled, hover, focused, disabled }), contentType: "application/json" });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

test("dirty Settings protect normal navigation and native reload while keeping the draft", async ({ page }) => {
  await page.goto("/settings");
  const range = page.getByLabel("Default dashboard range");
  await range.selectOption("90d");
  const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
  await sidebar.getByRole("link", { name: "Home", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving preferences?" });
  await expect(dialog).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(range).toHaveValue("90d");

  // A canceled reload deliberately has no completed navigation to await.
  const nativePrompt = page.waitForEvent("dialog", { timeout: 8_000 }).then(async (native) => {
    expect(native.type()).toBe("beforeunload");
    await native.dismiss();
  });
  await Promise.all([nativePrompt, page.evaluate(() => window.location.reload())]);
  await expect(range).toHaveValue("90d");
  await sidebar.getByRole("link", { name: "Home", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
