import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const phase5d = process.env.HIREFLUX_AUTH_FIXTURE_PHASE === "5D";
const SITE = `http://127.0.0.1:${phase5d ? "4176" : "4175"}`;
const API = "http://localhost:8000";
const PROVIDER = "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com";
const ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_BROWSERTEST";
const CLIENT = "fakepublicbrowserclient";
const SUBJECT = "Browser-Opaque-Subject";
const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../.tools/${phase5d ? "phase5d" : "phase5c"}-auth-browser`);
const key = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const now = "2026-10-20T00:00:00Z";
const profile = { user_id: SUBJECT, name: "Browser Tester", email: "browser.tester@example.com",
  role: "STANDARD_USER", created_at: now, last_login_at: null };
const settings = { time_zone: "UTC", default_follow_up_days: 7, default_application_view: "ACTIVE",
  default_dashboard_range: "30d", theme: "SYSTEM", created_at: now, updated_at: now, version: 1 };
const bootstrap = { state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1,
  created_at: now, updated_at: now, profile, settings };

function token(claims: Record<string, unknown>): string {
  const encoded = [Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "browser-test-key" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url")].join(".");
  return `${encoded}.${sign("RSA-SHA256", Buffer.from(encoded), key).toString("base64url")}`;
}

async function fakeNetwork(context: BrowserContext, options: { badNonce?: boolean; revokeFailure?: boolean; selfRegistration?: boolean; accountManagement?: boolean; differentReauth?: boolean; finalizationReview?: boolean } = {}) {
  const counts = { authorize: 0, code: 0, refresh: 0, revoke: 0, logout: 0, bootstrap: 0, demo: 0, pkceValidated: 0, deletion: 0, export: 0 };
  const unexpected: string[] = [];
  let flow: { challenge: string; nonce: string; state: string; used: boolean } | undefined;
  let callback = "";
  let credentialsInConsole = false;
  const captureConsole = (page: Page) => page.on("console", (message) => {
    credentialsInConsole ||= /fictional-once-code|fictional-refresh-family|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(message.text());
  });
  context.pages().forEach(captureConsole);
  context.on("page", captureConsole);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = url.origin;
    const headers = { "access-control-allow-origin": SITE, "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization, Accept, X-Request-ID", "cache-control": "no-store" };
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (origin === SITE) return route.continue();
    if (origin !== API && origin !== PROVIDER) {
      unexpected.push(origin + url.pathname);
      return route.abort("blockedbyclient");
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (origin === API) {
      if (url.pathname === "/api/v1/auth/config") return json({ version: 1, environment: "test", capabilities: ["demo", "cognito"],
        account_data_policy: "local_development", account_management_enabled: options.accountManagement ?? false,
        cognito: { issuer: ISSUER, client_id: CLIENT, domain: PROVIDER, scopes: ["openid", "email", "profile"], self_registration_enabled: options.selfRegistration ?? true } });
      if (url.pathname === "/api/v1/me/bootstrap") {
        counts.bootstrap++;
        if (!request.headers().authorization?.startsWith("Bearer ")) return json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Mock account session required", request_id: "browser-fixture" } }, 401);
        return json(bootstrap);
      }
      if (url.pathname === "/api/v1/me" && request.method() === "DELETE") {
        counts.deletion++;
        if (request.postDataJSON()?.confirmation !== "DELETE_MY_ACCOUNT") unexpected.push("invalid-confirmation");
        return json({ state: "DELETED", deletion_started_at: now, deletion_completed_at: now,
          retryable_failure: false, provider_finalization: options.finalizationReview ? "REVIEW_REQUIRED" : "COMPLETE",
          ...(options.finalizationReview ? {} : { provider_finalized_at: now }) }, options.finalizationReview ? 202 : 200);
      }
      if (url.pathname === "/api/v1/me/export") {
        counts.export++;
        return json({ export_version: 1, exported_at: now, profile, settings, applications: [], activities: [], notes: [], interviews: [], counts: { applications: 0, activities: 0, notes: 0, interviews: 0 } });
      }
      if (url.pathname === "/api/v1/me") return json(profile);
      if (url.pathname === "/api/v1/settings") return json(settings);
      if (url.pathname === "/api/v1/demo-sessions") counts.demo++;
      unexpected.push("mock-api:" + request.method() + " " + url.pathname);
      return json({ error: { code: "MOCK_ROUTE_UNAVAILABLE", message: "Unexpected bounded fixture request", request_id: "browser-fixture" } }, 503);
    }
    if (url.pathname === "/oauth2/authorize") {
      counts.authorize++;
      if (url.searchParams.get("redirect_uri") !== SITE + "/auth/callback" || url.searchParams.get("response_type") !== "code" ||
          url.searchParams.get("code_challenge_method") !== "S256" || url.searchParams.get("client_id") !== CLIENT || !url.searchParams.get("nonce")) {
        unexpected.push("invalid-mock-authorization-request");
        return route.fulfill({ status: 400, body: "Invalid fictional authorization request" });
      }
      flow = { challenge: url.searchParams.get("code_challenge") ?? "", nonce: url.searchParams.get("nonce") ?? "", state: url.searchParams.get("state") ?? "", used: false };
      callback = `${SITE}/auth/callback?code=fictional-once-code&state=${encodeURIComponent(flow.state)}`;
      return route.fulfill({ contentType: "text/html", headers, body: `<!doctype html><html><head><title>Fictional managed sign-in</title></head><body><main><h1>Fictional managed sign-in</h1><p>Offline provider fixture only. Cognito owns account creation and password recovery.</p><a href="#signup">Create account</a><a href="${callback.replaceAll("&", "&amp;")}">Complete fictional sign-in</a></main></body></html>` });
    }
    if (url.pathname === "/oauth2/token") {
      const body = new URLSearchParams(request.postData() ?? "");
      if (body.get("grant_type") === "refresh_token") {
        counts.refresh++;
        return json({ error: "invalid_grant" }, 400);
      }
      counts.code++;
      if (!flow || flow.used || body.get("client_secret") !== null || body.get("client_id") !== CLIENT ||
          body.get("redirect_uri") !== SITE + "/auth/callback" || body.get("code") !== "fictional-once-code" ||
          createHash("sha256").update(body.get("code_verifier") ?? "").digest("base64url") !== flow.challenge) {
        unexpected.push("invalid-mock-token-request");
        return json({ error: "invalid_grant" }, 400);
      }
      counts.pkceValidated++;
      flow.used = true;
      const issued = Math.floor(Date.now() / 1000);
      const currentSubject = options.differentReauth && counts.code > 1 ? "Other-Browser-Subject" : SUBJECT;
      return json({ access_token: token({ iss: ISSUER, client_id: CLIENT, sub: currentSubject, username: currentSubject,
        token_use: "access", scope: "openid email profile", iat: issued, auth_time: issued, exp: issued + 3600 }),
        id_token: token({ iss: ISSUER, aud: CLIENT, sub: currentSubject, token_use: "id", iat: issued, auth_time: issued, exp: issued + 3600,
          nonce: options.badNonce ? "different-test-nonce" : flow.nonce }),
        token_type: "Bearer", refresh_token: "fictional-refresh-family", scope: "openid email profile", expires_in: 3600 });
    }
    if (url.pathname === "/oauth2/revoke") {
      counts.revoke++;
      const body = new URLSearchParams(request.postData() ?? "");
      if (body.get("token") !== "fictional-refresh-family" || body.get("token_type_hint") !== "refresh_token") unexpected.push("invalid-mock-revocation");
      return route.fulfill({ status: options.revokeFailure ? 503 : 200, headers, body: "" });
    }
    if (url.pathname === "/logout") {
      counts.logout++;
      if (url.searchParams.get("client_id") !== CLIENT || url.searchParams.get("logout_uri") !== SITE + "/auth/signed-out") unexpected.push("invalid-mock-logout-url");
      return route.fulfill({ status: 302, headers: { ...headers, location: SITE + "/auth/signed-out" } });
    }
    unexpected.push("mock-provider:" + url.pathname);
    return route.abort("blockedbyclient");
  });
  return { counts, unexpected, callback: () => callback, safeConsole: () => !credentialsInConsole };
}

async function signInToSettings(page: Page, entry = "Sign In") {
  await page.goto("/settings");
  const button = page.getByRole("button", { name: entry, exact: true });
  await expect(button).toBeVisible();
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Fictional managed sign-in" })).toBeVisible();
  await page.getByRole("link", { name: "Complete fictional sign-in" }).click();
}

test("account entry, real PKCE callback, reload restoration and provider sign-out stay bounded", async ({ page, context }, info) => {
  const network = await fakeNetwork(context, { revokeFailure: info.project.name === "mobile" });
  await signInToSettings(page, info.project.name === "desktop" ? "Create Account" : "Sign In");
  await expect(page).toHaveURL(SITE + "/settings");
  await expect(page.getByRole("heading", { name: "Settings & profile" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Browser Tester");
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "Reset demo", exact: true })).toHaveCount(0);
  await expect(page.getByText("Account deletion is currently unavailable.", { exact: false })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => Boolean(sessionStorage.getItem("hireflux.cognito.user.v1")))).toBe(true);
  await expect.poll(async () => page.evaluate(() => Object.keys(localStorage).some((key) => /token|user\.v1|transaction/.test(key)))).toBe(false);
  await mkdir(path.join(fixtures, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(fixtures, `screenshots/persistent-settings-${info.project.name}.png`), fullPage: true, animations: "disabled" });
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Browser Tester");
  expect(network.counts.code).toBe(1);
  expect(network.counts.pkceValidated).toBe(1);
  expect(network.counts.bootstrap).toBe(2);
  const signOut = page.getByRole("button", { name: "Sign Out", exact: true });
  if (await signOut.count() === 0) await page.getByRole("button", { name: "More navigation", exact: true }).click();
  await signOut.first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(SITE + "/auth/signed-out");
  await expect(page.getByRole("heading", { name: "Signed out", exact: true })).toBeVisible();
  expect(network.counts.revoke).toBe(1);
  expect(network.counts.logout).toBe(1);
  if (info.project.name === "mobile") await expect(page.getByText("Refresh-token revocation could not be confirmed.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("hireflux.cognito.user.v1"))).toBeNull();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(fixtures, `screenshots/signed-out-${info.project.name}.png`), fullPage: true, animations: "disabled" });
  await page.goto(network.callback());
  await expect(page).toHaveURL(SITE + "/auth/callback");
  await expect(page.getByRole("button", { name: "Start sign-in again", exact: true })).toBeVisible();
  expect(network.counts.code).toBe(1);
  expect(network.counts.demo).toBe(0);
  expect(network.unexpected).toEqual([]);
  expect(network.safeConsole()).toBe(true);
  await info.attach("bounded-mock-request-counts", { body: JSON.stringify(network.counts), contentType: "application/json" });
});

test("a wrong nonce denies admission without demo fallback or stored credentials", async ({ page, context }) => {
  const network = await fakeNetwork(context, { badNonce: true });
  await signInToSettings(page);
  await expect(page).toHaveURL(SITE + "/auth/callback");
  await expect(page.getByRole("button", { name: "Start sign-in again", exact: true })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("hireflux.cognito.user.v1"))).toBeNull();
  expect(network.counts.code).toBe(1);
  expect(network.counts.bootstrap).toBe(0);
  expect(network.counts.demo).toBe(0);
  expect(network.unexpected).toEqual([]);
  expect(network.safeConsole()).toBe(true);
});

test("another tab logout epoch removes existing private UI without provider traffic", async ({ page, context }) => {
  const network = await fakeNetwork(context);
  await signInToSettings(page);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Browser Tester");
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(() => localStorage.setItem("hireflux.cognito.logout-epoch.v1", crypto.randomUUID()));
  await expect(page).toHaveURL(SITE + "/");
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("hireflux.cognito.user.v1"))).toBeNull();
  expect(network.counts.code).toBe(1);
  expect(network.counts.demo).toBe(0);
  expect(network.unexpected).toEqual([]);
  await other.close();
});

test("a cloned tab cannot restore or rotate another tab's refresh family", async ({ page, context }) => {
  const network = await fakeNetwork(context);
  await signInToSettings(page);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Browser Tester");
  const [cloned] = await Promise.all([
    context.waitForEvent("page"),
    page.evaluate(() => { window.open("/settings", "_blank"); }),
  ]);
  await expect(cloned.getByRole("heading", { name: "Workspace could not be prepared" })).toBeVisible();
  await expect(cloned.getByText("This account session is open in another tab.", { exact: false })).toBeVisible();
  await expect(cloned.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Browser Tester");
  expect(network.counts.code).toBe(1);
  expect(network.counts.refresh).toBe(0);
  expect(network.counts.bootstrap).toBe(1);
  expect(network.unexpected).toEqual([]);
  await cloned.close();
});

test("closed staging registration and confirmed reauthentication keep deletion restricted and honest", async ({ page, context }, info) => {
  const review = info.project.name === "mobile";
  const network = await fakeNetwork(context, { selfRegistration: false, accountManagement: true, finalizationReview: review });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toHaveCount(0);
  await expect(page.getByText("Account registration is closed.", { exact: false })).toBeVisible();
  await signInToSettings(page);
  const entry = page.getByRole("button", { name: "Delete account", exact: true });
  await entry.click();
  const confirmation = page.getByLabel("Type DELETE_MY_ACCOUNT", { exact: true });
  await expect(confirmation).toBeFocused();
  await confirmation.fill("wrong");
  await expect(page.getByRole("button", { name: "Verify identity to continue", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(entry).toBeFocused();
  await entry.click();
  await confirmation.fill("DELETE_MY_ACCOUNT");
  await page.getByRole("button", { name: "Verify identity to continue", exact: true }).click();
  await page.getByRole("link", { name: "Complete fictional sign-in", exact: true }).click();
  await expect(page).toHaveURL(SITE + "/account");
  await expect(page.getByRole("heading", { name: "Account management", exact: true })).toBeVisible();
  expect(network.counts.code).toBe(2);
  expect(network.counts.bootstrap).toBe(1);
  expect(network.counts.deletion).toBe(0);
  await page.getByRole("button", { name: "Confirm irreversible account deletion", exact: true }).click();
  if (review) await expect(page.getByText("Identity removal could not be confirmed", { exact: false })).toBeVisible();
  else await expect(page.getByText("Cognito identity removal was confirmed", { exact: false })).toBeVisible();
  expect(network.counts.deletion).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("hireflux.cognito.user.v1"))).toBeNull();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await mkdir(path.join(fixtures, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(fixtures, `screenshots/account-deletion-${info.project.name}.png`), fullPage: true });
  await page.getByRole("button", { name: "Finish provider sign-out", exact: true }).click();
  await expect(page).toHaveURL(SITE + "/auth/signed-out");
  await expect(page.getByText(review ? "provider removal requires owner/operator reconciliation" : "confirmed live HireFlux erasure and Cognito identity removal", { exact: false })).toBeVisible();
  expect(network.counts.demo).toBe(0);
  expect(network.unexpected).toEqual([]);
  expect(network.safeConsole()).toBe(true);
});

test("sensitive reauthentication with another account never deletes either account", async ({ page, context }) => {
  const network = await fakeNetwork(context, { selfRegistration: false, accountManagement: true, differentReauth: true });
  await signInToSettings(page);
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  await page.getByLabel("Type DELETE_MY_ACCOUNT", { exact: true }).fill("DELETE_MY_ACCOUNT");
  await page.getByRole("button", { name: "Verify identity to continue", exact: true }).click();
  await page.getByRole("link", { name: "Complete fictional sign-in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start sign-in again", exact: true })).toBeVisible();
  await expect(page).toHaveURL(SITE + "/auth/callback");
  expect(network.counts.code).toBe(2);
  expect(network.counts.deletion).toBe(0);
  expect(network.counts.bootstrap).toBe(1);
  expect(network.counts.demo).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("hireflux.cognito.user.v1"))).toBeNull();
  expect(network.unexpected).toEqual([]);
});

test("full JSON export needs a fresh same-account transaction and one explicit download", async ({ page, context }) => {
  const network = await fakeNetwork(context, { selfRegistration: false, accountManagement: true });
  await signInToSettings(page);
  await page.getByRole("button", { name: "Verify identity for JSON export", exact: true }).click();
  await page.getByRole("link", { name: "Complete fictional sign-in", exact: true }).click();
  await expect(page).toHaveURL(SITE + "/account");
  expect(network.counts.export).toBe(0);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download JSON export", exact: true }).click()]);
  expect(download.suggestedFilename()).toBe("hireflux-workspace-export.json");
  await expect(page.getByText("Export downloaded to your device.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON export", exact: true })).toBeDisabled();
  expect(network.counts.export).toBe(1);
  expect(network.counts.code).toBe(2);
  expect(network.counts.deletion).toBe(0);
  expect(network.counts.bootstrap).toBe(1);
  expect(network.unexpected).toEqual([]);
});
