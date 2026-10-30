import { expect, test } from "@playwright/test";
import { makeApplication } from "../src/test/fixtures";
import { installDeterministicApi } from "./fixtures";

for (const width of [390, 640, 768, 1280]) {
  test(`group disclosure preserves access and pagination at ${width}px`, async ({ page, context }) => {
    const externalRequests: string[] = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.fallback();
      externalRequests.push(url.hostname);
      await route.abort();
    });
    await page.setViewportSize({ width, height: 900 });
    await installDeterministicApi(page);
    const headers = { "access-control-allow-origin": new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin };

    let total = 0;
    let requests: Array<string | null> = [];
    const allItems = () => Array.from({ length: total }, (_, index) => ({
      application: makeApplication({
        application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
        company_name: `Company ${index + 1}`,
        job_title: `Role ${index + 1}`,
      }),
      classification: {
        group: "needs_action",
        reason_code: "CANDIDATE_ACTION_UNSCHEDULED",
        relevant_date: null,
        relevant_at: null,
        action_type: "OPEN_OPPORTUNITY",
        interview_id: null,
        next_interview: null,
      },
    }));

    await page.route("**/api/v1/applications/workspace?**", (route) => route.fulfill({ headers, json: {
      generated_at: "2026-08-27T14:00:00Z",
      groups: {
        needs_action: { total_count: total, items: allItems().slice(0, 4), next_cursor: total > 4 ? "preview" : null },
        moving_forward: { total_count: 0, items: [], next_cursor: null },
        waiting: { total_count: 0, items: [], next_cursor: null },
      },
    } }));
    await page.route("**/api/v1/applications/workspace/groups/needs_action?**", (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      requests.push(cursor);
      expect(url.searchParams.get("limit")).toBe("20");
      return route.fulfill({ headers, json: {
        total_count: total,
        items: cursor ? allItems().slice(20) : allItems().slice(0, 20),
        next_cursor: !cursor && total > 20 ? "second-page" : null,
      } });
    });

    for (const count of [0, 1, 3, 4, 5, 21]) {
      total = count;
      requests = [];
      await page.goto("/applications?view=ACTIVE");
      if (count === 0) {
        await expect(page.getByRole("heading", { name: "No active applications" })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Show \d+ more/ })).toHaveCount(0);
        expect(requests).toEqual([]);
        continue;
      }

      const group = page.getByRole("region", { name: "Needs your attention" });
      const recordLinks = group.getByRole("link", { name: /^Role \d+$/ });
      await expect(recordLinks).toHaveCount(Math.min(3, count));
      for (const link of await recordLinks.all()) {
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", /\/applications\/[\da-f-]+$/);
      }
      expect(requests).toEqual([]);
      if (count <= 3) {
        await expect(group.getByRole("button", { name: /^Show \d+ more/ })).toHaveCount(0);
        continue;
      }

      const disclosure = group.getByRole("button", { name: `Show ${count - 3} more needs your attention` });
      await expect(disclosure).toBeVisible();
      await expect(disclosure).toHaveAttribute("aria-expanded", "false");
      await disclosure.focus();
      await page.keyboard.press("Space");
      await expect(recordLinks).toHaveCount(Math.min(20, count));
      expect(requests).toEqual([null]);
      if (count > 20) {
        await group.getByRole("button", { name: "Load more" }).click();
        await expect(recordLinks).toHaveCount(21);
        expect(requests).toEqual([null, "second-page"]);
        await expect(group.getByRole("button", { name: "Load more" })).toHaveCount(0);
      }
      for (const link of await recordLinks.all()) {
        await expect(link).toBeVisible();
        await link.focus();
        await expect(link).toBeFocused();
      }
      await group.getByRole("button", { name: "Show fewer needs your attention" }).click();
      await expect(recordLinks).toHaveCount(3);
      await disclosure.focus();
      await page.keyboard.press("Enter");
      await expect(recordLinks).toHaveCount(count);
      expect(requests).toEqual(count > 20 ? [null, "second-page"] : [null]);
      if (count === 4) {
        await group.getByRole("link", { name: "Role 4", exact: true }).click();
        await expect(page).toHaveURL(/\/applications\/11111111-1111-4111-8111-000000000004$/);
      } else if (count === 21) {
        await group.getByRole("link", { name: "Role 21", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/applications\/11111111-1111-4111-8111-000000000021$/);
      }
    }
    expect(externalRequests).toEqual([]);
  });
}
