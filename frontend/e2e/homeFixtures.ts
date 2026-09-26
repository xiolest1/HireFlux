import type { Page } from "@playwright/test";
import type { HomeAction } from "../src/features/workspace/homeDecisionModel";
import { makeApplication, testDashboard } from "../src/test/fixtures";

const overdue: HomeAction = { kind: "FOLLOW_UP_OVERDUE", application_id: "11111111-1111-4111-8111-111111111111", company_name: "Northstar Labs", job_title: "Senior Frontend Platform Engineer", due_date: "2026-08-12", priority: "HIGH", label: "Check back with the employer", responsibility: "EMPLOYER" };
const today: HomeAction = { kind: "FOLLOW_UP_TODAY", application_id: "33333333-3333-4333-8333-333333333333", company_name: "Beacon Studio", job_title: "Product Designer", due_date: "2026-08-13", priority: "MEDIUM", label: "Send the saved follow-up", responsibility: "CANDIDATE" };
const interview: HomeAction = { kind: "INTERVIEW_SOON", application_id: "22222222-2222-4222-8222-222222222222", company_name: "Cedar Analytics", job_title: "Product Design Systems Lead", due_at: "2026-08-14T13:00:00Z", priority: "HIGH", label: "Prepare for the scheduled interview" };
const review: HomeAction = { kind: "STALE_APPLICATION", application_id: "44444444-4444-4444-8444-444444444444", company_name: "Atlas Systems", job_title: "Platform Engineer", priority: "LOW", label: "Review after 14 days in stage" };
export const homeFixtureActions = {
  peers: [overdue, today, interview, review],
  focal: [interview, review],
  volume: [...Array.from({ length: 8 }, (_, index) => ({ ...overdue, application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`, company_name: `Research Partnership ${index + 1}` })), today, interview, review],
  undated: [{ kind: "CANDIDATE_ACTION_UNDATED", application_id: overdue.application_id, company_name: "Northstar Labs", job_title: "Senior Frontend Platform Engineer", priority: "MEDIUM", label: "Prepare the requested portfolio examples", responsibility: "CANDIDATE" }, review],
  waiting: [],
  partial: [],
} satisfies Record<string, HomeAction[]>;
export type HomeFixtureName = keyof typeof homeFixtureActions;

/** The same recorded facts drive before/after evidence; no live demo is mutated. */
export async function installHomeFixture(page: Page, name: HomeFixtureName) {
  await page.route("**/api/v1/dashboard?**", (route) => route.fulfill({ json: {
    ...testDashboard,
    actions: homeFixtureActions[name],
    recent_applications: [makeApplication(), makeApplication({ application_id: interview.application_id, company_name: interview.company_name, job_title: interview.job_title, status: "INTERVIEW" })],
  } }));
  if (name === "waiting" || name === "partial") {
    await page.route("**/api/v1/applications/workspace?**", (route) => name === "partial"
      ? route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Ownership evidence unavailable", request_id: "home-fixture" } } })
      : route.fulfill({ json: { generated_at: testDashboard.generated_at, groups: {
        needs_action: { total_count: 0, items: [], next_cursor: null },
        moving_forward: { total_count: 0, items: [], next_cursor: null },
        waiting: { total_count: 3, items: [], next_cursor: null },
      } } }));
  }
}
