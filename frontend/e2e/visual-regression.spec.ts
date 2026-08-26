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

const routes = [
  {
    name: "landing",
    path: "/",
    heading: "Keep every opportunity moving forward.",
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
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading, level: 1 }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expectNoHorizontalPageOverflow(page);

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

  const scheduledRound = page.getByRole("button", {
    name: /Northstar Labs, Technical screen/,
  });
  await scheduledRound.focus();
  await page.keyboard.press("Enter");
  await expect(scheduledRound).toHaveAttribute("aria-pressed", "true");
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
    drawer.getByRole("button", { name: "Close panel" }),
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
  await expect(drawer).toBeHidden();
  await expect(prepare).toBeFocused();

  await page.reload();
  await expect(scheduledRound).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalPageOverflow(page);
});

test("analytics overview progressively discloses supporting detail", async ({
  page,
}, testInfo) => {
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Your search at a glance" }),
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
    page.getByRole("heading", { name: "Your search at a glance" }),
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

test("application layouts, transition drawer, and progressive form disclosure stay usable", async ({
  page,
}) => {
  await page.goto("/applications");
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  if (viewportWidth >= 768) {
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page).toHaveURL(/layout=list/);
    await expect(
      page.getByRole("table", { name: "Applications in compact list view" }),
    ).toBeVisible();
  } else {
    await page.goto("/applications?layout=list");
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Applications in compact list view" }),
    ).toBeHidden();
  }

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
}) => {
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
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot("landing-light.png", { fullPage: true });
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

  await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  await expect(page).toHaveScreenshot("application-detail-workspace.png", { fullPage: true });
});

test("application loading, empty, failure, and retry states are explicit", async ({
  page,
}) => {
  let mode: "loading" | "empty" | "failure" = "loading";
  let releaseResponse: (() => void) | undefined;

  await page.route(
    "http://localhost:8000/api/v1/applications*",
    async (route) => {
      if (new URL(route.request().url()).pathname !== "/api/v1/applications") {
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

      await fulfillJson(route, { items: [], next_cursor: null });
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
    page.getByRole("heading", { name: "No applications yet" }),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  mode = "failure";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Applications could not be loaded" }),
  ).toBeVisible();
  await expect(
    page.getByText("Applications are temporarily unavailable."),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  mode = "empty";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No applications yet" }),
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
