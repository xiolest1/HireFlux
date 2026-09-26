import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { testDashboard } from "../../test/fixtures";
import { HomeDecisionSection } from "./HomeDecisionSection";
import { buildHomeDecisionModel, type HomeAction } from "./homeDecisionModel";

const followUp: HomeAction = { kind: "FOLLOW_UP_OVERDUE", application_id: "11111111-1111-4111-8111-111111111111", company_name: "Northstar", job_title: "Platform Engineer", due_date: "2026-08-12", priority: "HIGH", label: "Send the saved check-back", responsibility: "CANDIDATE" };
const interview: HomeAction = { kind: "INTERVIEW_SOON", application_id: "22222222-2222-4222-8222-222222222222", company_name: "Cedar", job_title: "Designer", due_at: "2026-08-14T01:00:00Z", priority: "HIGH", label: "Prepare for the conversation" };
const review: HomeAction = { kind: "STALE_APPLICATION", application_id: "33333333-3333-4333-8333-333333333333", company_name: "Beacon", job_title: "Analyst", priority: "LOW", label: "Review after 14 days in stage" };

function renderDecision(actions: HomeAction[], dashboardError = false) {
  const decision = buildHomeDecisionModel({ dashboard: { ...testDashboard, actions }, dashboardPending: false, dashboardError, workspacePending: false, workspaceError: false });
  const onComplete = vi.fn();
  render(<MemoryRouter><HomeDecisionSection decision={decision} headingRef={null} timeZone="America/Los_Angeles" refreshing={false} mutationError={null} onRetry={vi.fn()} resolvingActionId={null} rescheduling={null} followUpDate="" reschedulePending={false} onComplete={onComplete} onBeginReschedule={vi.fn()} onDateChange={vi.fn()} onCancelReschedule={vi.fn()} onSaveDate={vi.fn()} /></MemoryRouter>);
  return { user: userEvent.setup(), onComplete, section: screen.getByRole("region", { name: "What can I work on now?" }) };
}

describe("open Home decision composition", () => {
  it("uses one open authority, equal peer surfaces and subordinate review provenance", () => {
    const { section } = renderDecision([followUp, interview, review]);
    expect(section).not.toHaveClass("bg-surface-raised");
    expect(section.querySelectorAll('[data-home-commitment]')).toHaveLength(2);
    expect(within(section).getAllByRole("button", { name: /Details/ })[0]).toHaveClass("hf-home-quiet-link");
    expect(section.querySelector('[data-focal="true"]')).toBeNull();
    expect(within(section).getByText("Limited Home result")).toBeVisible();
    const suggestion = within(section).getByRole("heading", { name: "Suggested review · Time in stage" }).closest("div")!;
    expect(suggestion).not.toHaveClass("bg-surface-raised");
    expect(within(suggestion).getByText(/No recorded deadline/)).toBeVisible();
    expect(within(section).queryByRole("button", { name: "Complete follow-up" })).not.toBeInTheDocument();
  });

  it("keeps saved calendar dates unchanged and uses the workspace zone for interview date plaques", () => {
    const { section } = renderDecision([followUp, interview]);
    const cards = section.querySelectorAll('[data-home-commitment]');
    expect(cards[0].querySelector('[aria-hidden="true"]')).toHaveTextContent("Aug12");
    expect(cards[1].querySelector('[aria-hidden="true"]')).toHaveTextContent("Aug13");
    expect(within(section).getAllByText(/Aug 13, 2026, 6:00 PM/)[0]).toBeVisible();
    expect(within(section).getByRole("link", { name: "Interviews for Designer · Cedar" })).toHaveAttribute("href", `/applications/${interview.application_id}?section=interviews`);
    expect(within(section).getByText("Destination: application Interviews")).toBeVisible();
  });

  it("gives a unique dated commitment focal treatment without turning a heuristic into a commitment", () => {
    const { section } = renderDecision([interview, review]);
    expect(section.querySelectorAll('[data-focal="true"]')).toHaveLength(1);
    expect(section.querySelectorAll('[data-home-commitment]')).toHaveLength(1);
  });

  it("shows all three peer commitments with unique independently operable disclosures", async () => {
    const actions = [followUp, { ...followUp, application_id: "44444444-4444-4444-8444-444444444444", company_name: "Atlas" }, interview];
    const { section, user, onComplete } = renderDecision(actions);
    expect(section.querySelectorAll('[data-home-commitment]')).toHaveLength(3);
    const disclosures = within(section).getAllByRole("button", { name: /Details.*Recorded overdue/ });
    expect(disclosures[0].getAttribute("aria-controls")).not.toBe(disclosures[1].getAttribute("aria-controls"));
    await user.click(disclosures[1]);
    await user.click(within(section).getByRole("button", { name: "Complete follow-up" }));
    expect(onComplete).toHaveBeenCalledWith(actions[1]);
    expect(disclosures[1]).toHaveAttribute("aria-expanded", "true");
  });

  it("makes high-volume returned work retrievable without an exhaustive-search claim", async () => {
    const actions = Array.from({ length: 8 }, (_, index) => ({ ...followUp, application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`, company_name: `Company ${index + 1}` }));
    const { section, user } = renderDecision(actions);
    expect(section.querySelectorAll('[data-home-commitment]')).toHaveLength(1);
    const disclosure = within(section).getByRole("button", { name: /See all 8 returned items/ });
    await user.click(disclosure);
    expect(within(section).getByRole("link", { name: /Platform Engineer · Company 8/ })).toBeVisible();
    await user.click(within(section).getByText("About these results"));
    expect(within(section).getByText(/100 due follow-ups and five upcoming interviews/)).toBeVisible();
  });

  it("retains known commitments and their reason when the latest operational evidence fails", () => {
    const { section } = renderDecision([followUp], true);
    expect(within(section).getByText("Evidence is incomplete; this is not an all-clear.")).toBeVisible();
    expect(within(section).getAllByText("Send the saved check-back")[0]).toBeVisible();
    expect(section.querySelector('[data-focal="true"]')).toBeNull();
  });

  it("does not put undated work on a dated surface", () => {
    const undated: HomeAction = { kind: "CANDIDATE_ACTION_UNDATED", application_id: followUp.application_id, company_name: "Northstar", job_title: "Engineer", priority: "MEDIUM", label: "Prepare portfolio examples", responsibility: "CANDIDATE" };
    const { section } = renderDecision([undated]);
    expect(section.querySelector('[data-home-commitment]')).toBeNull();
    expect(within(section).getByRole("heading", { name: "No saved date" })).toBeVisible();
    expect(within(section).getByText(/Candidate-owned; no recorded deadline/)).toBeVisible();
  });
});
