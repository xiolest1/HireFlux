import { describe, expect, it } from "vitest";
import type { OpportunityWorkspace } from "../../api/schemas";
import type { Dashboard } from "../../api/workspace";
import { testDashboard } from "../../test/fixtures";
import { buildHomeDecisionModel, homeActionMeaning, homeActionPreviewReason } from "./homeDecisionModel";

const id = "11111111-1111-4111-8111-111111111111";
const base = { application_id: id, company_name: "A long organization name that must wrap naturally", job_title: "Senior Infrastructure Reliability Engineer, Developer Productivity & Internal Platforms" };
const overdue: Dashboard["actions"][number] = { ...base, kind: "FOLLOW_UP_OVERDUE", due_date: "2026-08-11", priority: "HIGH", label: "Send recorded follow-up" };
const interview: Dashboard["actions"][number] = { ...base, kind: "INTERVIEW_SOON", due_at: "2026-08-14T01:00:00Z", priority: "HIGH", label: "Prepare for interview" };
const undated: Dashboard["actions"][number] = { ...base, kind: "CANDIDATE_ACTION_UNDATED", priority: "MEDIUM", label: "Review draft note" };
const stale: Dashboard["actions"][number] = { ...base, kind: "STALE_APPLICATION", priority: "LOW", label: "Review after 14 days in stage" };
const group = { total_count: 0, items: [], next_cursor: null };
const workspace = (needsAction = 0, waiting = 0): OpportunityWorkspace => ({
  generated_at: "2026-08-12T13:00:00Z",
  groups: {
    needs_action: { ...group, total_count: needsAction },
    moving_forward: group,
    waiting: { ...group, total_count: waiting },
  },
});
const model = (dashboard: Dashboard | undefined, extras: {
  pending?: boolean;
  error?: boolean;
  workspace?: OpportunityWorkspace;
  workspacePending?: boolean;
  workspaceError?: boolean;
} = {}) => buildHomeDecisionModel({
  dashboard,
  dashboardPending: extras.pending ?? false,
  dashboardError: extras.error ?? false,
  workspace: extras.workspace,
  workspacePending: extras.workspacePending ?? false,
  workspaceError: extras.workspaceError ?? false,
});

describe("Home decision evidence and state matrix", () => {
  it("A: retains interview and overdue obligation as peers", () => {
    const result = model({ ...testDashboard, actions: [overdue, interview] });
    expect(result.state).toBe("actions");
    expect(result.groups.flatMap((group) => group.actions)).toEqual([overdue, interview]);
    expect(result.focalGroup).toBeNull();
    expect(result.title).toContain("Several");
  });
  it("keeps a recorded commitment beside useful undated work without assigning a deadline", () => {
    const result = model({ ...testDashboard, actions: [overdue, undated] });
    expect(result.groups.flatMap((group) => group.actions)).toEqual([overdue, undated]);
    expect(result.focalGroup).toBe("overdue");
    expect(homeActionMeaning(undated).limitation).toContain("No deadline");
  });
  it("B: active records without urgency are not an unqualified all-clear", () => {
    const result = model(testDashboard, { workspace: workspace() });
    expect(result.state).toBe("no-known-action");
    expect(result.explanation).toContain("unrecorded obligations");
  });
  it("C/H: high-volume peer commitments retain count and preview", () => {
    const actions = Array.from({ length: 8 }, (_, index) => ({ ...overdue, application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}` }));
    const result = model({ ...testDashboard, actions });
    expect(result.groups[0].actions).toHaveLength(8);
    expect(result.groups[0].preview).toHaveLength(1);
    expect(result.groups[0].hiddenCount).toBe(7);
    expect(result.focalGroup).toBeNull();
    expect(result.title).toContain("Several");
  });
  it("keeps a representative of every surfaced condition class in the initial view", () => {
    const today: Dashboard["actions"][number] = { ...overdue, kind: "FOLLOW_UP_TODAY" };
    const upcoming: Dashboard["actions"][number] = { ...interview, kind: "INTERVIEW_UPCOMING", priority: "LOW" };
    const result = model({ ...testDashboard, actions: [overdue, today, interview, upcoming, undated, stale] });
    expect(result.groups.map((group) => group.key)).toEqual(["overdue", "today", "interviews", "undated", "review"]);
    expect(result.groups.flatMap((group) => group.actions).map((action) => action.kind)).toEqual([
      "FOLLOW_UP_OVERDUE", "FOLLOW_UP_TODAY", "INTERVIEW_SOON", "INTERVIEW_UPCOMING", "CANDIDATE_ACTION_UNDATED", "STALE_APPLICATION",
    ]);
  });
  it("D: employer waiting is distinct from candidate inaction", () => {
    const result = model(testDashboard, { workspace: workspace(0, 4) });
    expect(result.state).toBe("waiting");
    expect(result.explanation).toContain("Check each record's ownership");
  });
  it("E/G: no records offers a recording path without invented urgency", () => {
    const result = model({ ...testDashboard, summary: { ...testDashboard.summary, total_tracked: 0, active_pursuits: 0 } });
    expect(result.state).toBe("no-records");
  });
  it("F/J/K: incomplete ownership evidence is partial, not caught up", () => {
    expect(model(testDashboard, { workspacePending: true }).state).toBe("partial");
    expect(model(testDashboard, { workspaceError: true }).state).toBe("partial");
    expect(model(testDashboard, { workspace: workspace(2, 0) }).state).toBe("partial");
  });
  it("I: loading and Dashboard failure never become no-action", () => {
    expect(model(undefined, { pending: true }).state).toBe("loading");
    expect(model(undefined, { error: true }).state).toBe("failure");
    expect(model(testDashboard, { error: true, workspace: workspace() }).state).toBe("partial");
  });
  it("separates recorded dates from undated candidate and heuristic cues", () => {
    expect(homeActionMeaning(overdue).condition).toBe("Recorded follow-up overdue");
    expect(homeActionMeaning({ ...overdue, responsibility: "EMPLOYER" }).owner).toContain("Employer-owned");
    expect(homeActionMeaning(overdue).owner).toContain("not recorded");
    expect(homeActionMeaning(undated).limitation).toContain("No deadline");
    expect(homeActionMeaning(stale).limitation).toContain("not a missed deadline");
    expect(homeActionPreviewReason(stale)).toContain("not a missed deadline");
  });
  it("focal treatment requires a unique time-sensitive recorded commitment", () => {
    expect(model({ ...testDashboard, actions: [overdue, stale] }).focalGroup).toBe("overdue");
    expect(model({ ...testDashboard, actions: [interview, undated] }).focalGroup).toBe("interviews");
    expect(model({ ...testDashboard, actions: [{ ...interview, kind: "INTERVIEW_UPCOMING" }] }).focalGroup).toBeNull();
    expect(model({ ...testDashboard, actions: [overdue, interview, stale] }).focalGroup).toBeNull();
    expect(model({ ...testDashboard, actions: [overdue] }, { error: true }).focalGroup).toBeNull();
  });
  it("shows all three peer commitments, then condenses a larger set by class", () => {
    const peers = [overdue, { ...overdue, application_id: "22222222-2222-4222-8222-222222222222" }, { ...overdue, application_id: "33333333-3333-4333-8333-333333333333" }];
    expect(model({ ...testDashboard, actions: peers }).groups[0].preview).toHaveLength(3);
    expect(model({ ...testDashboard, actions: [...peers, interview] }).groups[0].preview).toHaveLength(1);
  });
});
