import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { makeApplication, testDashboard, testSettings } from "../src/test/fixtures";
import { application, applicationId, installDeterministicApi, installWorkspaceTheme } from "./fixtures";

const api = "http://localhost:8000/api/v1";
const longName = "Alexandria Maximiliana Fictional-Account-Name-With-Long-Text";
const subject = "phase6-p2-fictional-subject";
const profile = { user_id: subject, name: longName, email: "phase6-p2@example.invalid", role: "STANDARD_USER", created_at: testSettings.created_at, last_login_at: null };
const emptyGroup = { total_count: 0, items: [], next_cursor: null };
const emptyWorkspace = { generated_at: "2026-10-29T12:00:00Z", groups: { needs_action: emptyGroup, moving_forward: emptyGroup, waiting: emptyGroup } };
let nonLoopbackRequests: string[] = [];

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "http://127.0.0.1:4173" }, body: JSON.stringify(body) });
}

// Restore a wholly fictional account via the existing tab-store adapter. This
// qualifies presentation, not Cognito login or JWT validation. No provider call
// is permitted: the context-level guard rejects every non-loopback request.
async function persistentPresentation(page: Page, theme: "LIGHT" | "DARK" | "SYSTEM" = "SYSTEM") {
  const issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_P2FIXTURE";
  const client = "phase6p2fictionalclient";
  await page.addInitScript(({ issuer, client, subject }) => {
    sessionStorage.removeItem("hireflux.demo-session.v1");
    sessionStorage.setItem("hireflux.selected-workspace.v1", "cognito");
    const epoch = "11111111-1111-4111-8111-111111111111";
    const instanceId = "22222222-2222-4222-8222-222222222222";
    localStorage.setItem("hireflux.cognito.logout-epoch.v1", epoch);
    sessionStorage.setItem("hireflux.cognito.instance.v1", instanceId);
    const now = Math.floor(Date.now() / 1000);
    const token = (claims: Record<string, unknown>) => `${btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${btoa(JSON.stringify(claims))}.fictional-signature`;
    const user = { access_token: token({ iss: issuer, client_id: client, sub: subject, token_use: "access", iat: now, auth_time: now, exp: now + 3600, scope: "openid email profile" }),
      id_token: token({ iss: issuer, aud: client, sub: subject, token_use: "id", iat: now, exp: now + 3600 }),
      token_type: "Bearer", scope: "openid email profile", profile: { sub: subject }, expires_at: now + 3600 };
    sessionStorage.setItem("hireflux.cognito.user.v1", JSON.stringify({ epoch, instanceId, user: JSON.stringify(user) }));
  }, { issuer, client, subject });
  await page.route(`${api}/auth/config`, route => json(route, {
    version: 1, environment: "test", capabilities: ["demo", "cognito"], account_data_policy: "local_development", account_management_enabled: false,
    cognito: { issuer, client_id: client, domain: "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com", scopes: ["openid", "email", "profile"], self_registration_enabled: false },
  }));
  await page.route(`${api}/me/bootstrap`, route => json(route, { state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1,
    created_at: testSettings.created_at, updated_at: testSettings.updated_at, profile, settings: { ...testSettings, theme } }));
  await page.route(`${api}/me`, route => json(route, profile));
}

test.beforeEach(async ({ context, page }) => {
  nonLoopbackRequests = [];
  await context.route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    if (["localhost", "127.0.0.1"].includes(host)) return route.fallback();
    nonLoopbackRequests.push(host);
    return route.abort();
  });
  await installDeterministicApi(page);
});
test.afterEach(() => expect(nonLoopbackRequests).toEqual([]));

for (const theme of ["LIGHT", "DARK"] as const) {
  test(`empty personal Home creates a first ${theme === "LIGHT" ? "Saved" : "Applied"} application in ${theme.toLowerCase()} mode`, async ({ page }, info) => {
    await page.setViewportSize({ width: theme === "LIGHT" ? 390 : 1280, height: 900 });
    await persistentPresentation(page, theme);
    await installWorkspaceTheme(page, theme);
    let created = false;
    let postedStatus: unknown;
    const isSaved = theme === "LIGHT";
    const first = makeApplication({ owner_user_id: subject, company_name: "Fictional First Record", job_title: "Product Engineer", status: isSaved ? "DRAFT" : "APPLIED", applied_date: isSaved ? null : "2026-10-28", submitted_at: isSaved ? null : "2026-10-28T12:00:00Z", next_step_responsibility: null, next_step_note: null });
    await page.route(`${api}/applications/workspace?**`, route => json(route, emptyWorkspace));
    await page.route(`${api}/dashboard?**`, route => json(route, { ...testDashboard,
      summary: { total_tracked: created ? 1 : 0, active_pursuits: created && !isSaved ? 1 : 0, drafts: created && isSaved ? 1 : 0, accepted: 0, rejected: 0, withdrawn: 0, archived: 0 },
      actions: [], recent_applications: created ? [first] : [], upcoming_interviews: [] }));
    await page.route(`${api}/applications`, async route => {
      if (route.request().method() !== "POST") return route.fallback();
      postedStatus = route.request().postDataJSON().status;
      created = true;
      await json(route, first, 201);
    });
    await page.goto("/dashboard");
    const decision = page.getByRole("region", { name: "What can I work on now?" });
    await expect(decision.getByText("Your workspace is ready")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(theme === "DARK" ? /dark/ : /^(?!.*dark).*$/);
    await expect(decision.getByText("Limited Home result")).toHaveCount(0);
    const add = decision.getByRole("link", { name: "Add your first application" });
    await add.focus();
    await expect(add).toBeFocused();
    expect((await new AxeBuilder({ page }).include('[aria-labelledby="home-decision-title"]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`first-record-${theme.toLowerCase()}.png`), fullPage: true });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/applications\/new$/);
    await page.getByLabel(/^Company/).fill(first.company_name);
    await page.getByLabel(/^Role/).fill(first.job_title);
    const stage = page.getByRole("radio", { name: isSaved ? /Saved/ : /Applied/ });
    await stage.focus();
    await page.keyboard.press("Space");
    await expect(stage).toBeChecked();
    if (!isSaved) await page.getByLabel(/^Applied on/).fill("2026-10-28");
    await page.getByRole("button", { name: "Add application", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Product Engineer at Fictional First Record was added.", { exact: true })).toBeVisible();
    expect(postedStatus).toBe(isSaved ? "DRAFT" : "APPLIED");
    await expect(decision.getByRole("link", { name: "Add your first application" })).toHaveCount(0);
    await expect(decision.getByText("Your workspace is ready")).toHaveCount(0);
  });
}

test("filtered and sorted collection survives Edit save and a no-save exit", async ({ page }, info) => {
  const origin = "/applications?view=ALL&q=Northstar&sort=updated_asc";
  let current = { ...application };
  let edits = 0;
  await page.route(`${api}/applications?**`, route => json(route, { items: [current], next_cursor: null }));
  await page.route(`${api}/applications/${applicationId}`, async route => {
    if (route.request().method() === "PATCH") {
      edits++;
      current = { ...current, ...route.request().postDataJSON(), version: current.version + 1 };
    }
    await json(route, current);
  });
  await page.goto(origin);
  await page.getByRole("link", { name: /Senior Frontend Platform Engineer/ }).first().click();
  await page.getByRole("button", { name: "More opportunity actions" }).click();
  await page.getByRole("menuitem", { name: "Edit opportunity" }).click();
  await page.getByLabel(/^Company name/).fill("Northstar Updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Application details updated.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More opportunity actions" }).click();
  await page.getByRole("menuitem", { name: "Edit opportunity" }).click();
  await page.getByRole("link", { name: "Back to application", exact: true }).click();
  await page.getByRole("link", { name: "Back to applications", exact: true }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:4173${origin}`);
  expect(edits).toBe(1);
  await page.screenshot({ path: info.outputPath("restored-collection.png"), fullPage: true });
});

for (const mode of ["DEMO", "PERSISTENT"] as const) {
  for (const width of [320, 390, 768]) {
    test(`${mode} navigation and missing interview stay accurate and keyboard accessible at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      if (mode === "PERSISTENT") await persistentPresentation(page);
      await page.goto("/interviews?interview=99999999-9999-4999-8999-999999999999");
      await expect(page.getByText(mode === "DEMO"
        ? "This interview is not available in this demo workspace. The workspace may have expired or the link may be incorrect."
        : "This interview is not available in this workspace. Check the link or choose another interview.")).toBeVisible();
      const more = page.getByRole("button", { name: width < 768 ? "More navigation" : "Open navigation", exact: true });
      await more.focus();
      await page.keyboard.press("Enter");
      const drawer = page.getByRole("dialog", { name: width < 768 ? "Workspace" : "Workspace navigation", exact: true });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText(width === 768 ? "Navigate your HireFlux workspace." : mode === "DEMO" ? "Demo tools, insights, and preferences." : "Account tools, insights, and preferences.")).toBeVisible();
      await expect(drawer.getByText(mode === "DEMO" ? "Demo workspace" : "Account workspace", { exact: true })).toBeVisible();
      if (mode === "PERSISTENT") {
        if (width < 768) await expect(drawer.getByText("Saved across sign-outs", { exact: true })).toBeVisible();
        await expect(drawer.getByText("Temporary workspace", { exact: true })).toHaveCount(0);
        await expect(drawer.getByText(longName, { exact: true })).toBeVisible();
        const clipped = await drawer.getByText(longName, { exact: true }).evaluate(el => ({ overflow: getComputedStyle(el).textOverflow, client: el.clientWidth, scroll: el.scrollWidth }));
        expect(clipped.overflow).toBe("ellipsis");
        expect(clipped.scroll).toBeGreaterThan(clipped.client);
      }
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
      expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
      await drawer.screenshot({ path: info.outputPath(`${mode.toLowerCase()}-more-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(more).toBeFocused();
    });
  }
}

test("public entry title describes the whole tracker at narrow and desktop widths", async ({ page }) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page).toHaveTitle("Job application tracker · HireFlux");
  }
});
