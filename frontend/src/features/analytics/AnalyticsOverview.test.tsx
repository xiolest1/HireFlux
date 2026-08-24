import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Analytics } from "../../api/workspace";
import { AnalyticsOverview } from "./AnalyticsOverview";

const primaryInsight: Analytics["insights"][number] = {
  code: "BUILD_SAMPLE",
  category: "response",
  semantic_type: "observation",
  tone: "INFO",
  title: "Search Health is still building your picture",
  description: "Track more applications before judging rates.",
  evidence_summary: "2 submitted · trends begin at 5",
  evidence: "This view contains 2 submitted applications.",
  evidence_strength: "LIMITED",
  evidence_label: "Early signal",
  priority: 20,
  action: { kind: "ADD_APPLICATION", label: "Add application", parameters: {} },
};

const analytics = {
  insights: [primaryInsight],
  source_performance: [],
  summary: { active_pursuits: 2 },
  rates: {
    submitted_count: 2,
    response_count: 1,
    response_rate: 0.5,
    interview_count: 0,
    interview_rate: 0,
    offer_count: 0,
    offer_rate: 0,
    acceptance_count: 0,
    acceptance_rate: 0,
  },
  period_comparison: {
    available: false,
    current_start: null,
    current_end: null,
    previous_start: null,
    previous_end: null,
    current: null,
    previous: null,
    deltas: null,
  },
  follow_up_coverage: {
    active_count: 2,
    scheduled_count: 1,
    coverage_rate: 0.5,
    overdue_count: 0,
    due_today_count: 0,
    missing_count: 1,
  },
  submission_trend: [],
  average_days_to_first_response: null,
  no_response_count: 1,
  work_mode_breakdown: [],
} as unknown as Analytics;

describe("AnalyticsOverview", () => {
  it("shows one server-ranked insight without an unnecessary disclosure", () => {
    render(<MemoryRouter><AnalyticsOverview analytics={analytics} /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: primaryInsight.title })).toBeVisible();
    expect(screen.queryByRole("button", { name: /View all insights/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Suggested action: Add application" })).toHaveAttribute("href", "/applications/new");
  });

  it("uses a neutral no-insight state without inventing an action", () => {
    render(<MemoryRouter><AnalyticsOverview analytics={{ ...analytics, insights: [] }} /></MemoryRouter>);

    expect(screen.getByText("Keep tracking to build a clearer picture")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Suggested action/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View all insights/ })).not.toBeInTheDocument();
  });
});
