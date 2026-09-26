import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { makeAnalytics, makeApplication, testDashboard } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { API_ORIGIN, server } from "../test/server";

describe("Home quiet context", () => {
  it("uses selected Analytics weeks and server totals, not Dashboard's different history", async () => {
    server.use(http.get(`${API_ORIGIN}/api/v1/analytics`, () => HttpResponse.json({ ...makeAnalytics(), submission_trend: [{ week_start: "2026-08-03", count: 7 }, { week_start: "2026-08-10", count: 6 }] })));
    const { user } = renderApp("/dashboard");
    const figure = await screen.findByRole("figure", { name: "Weekly submitted applications" });
    expect(within(figure).getByText("Week starting 2026-08-03: 7 submitted applications")).toBeInTheDocument();
    expect(within(figure).queryByText(/2026-07-20/)).not.toBeInTheDocument();
    expect(within(figure).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/\+3 submissions compared/)).toBeVisible();
    expect(screen.getByText("Recent applications are converting more effectively").closest('[aria-hidden="true"]')).toHaveAttribute("data-state", "closed");
    await user.click(screen.getByRole("button", { name: "Interpretation" }));
    expect(screen.getByText("Recent applications are converting more effectively")).toBeVisible();
    expect(screen.getByText("50% response · 25% interview")).toBeVisible();
    expect(screen.queryByText("1 follow-up is overdue")).not.toBeInTheDocument();
  });

  it("omits miniature history and period comparison for all-time reporting", async () => {
    server.use(http.get(`${API_ORIGIN}/api/v1/analytics`, ({ request }) => HttpResponse.json(makeAnalytics(new URL(request.url).searchParams.get("range") === "all" ? "all" : "30d"))));
    const { user } = renderApp("/dashboard");
    await screen.findByRole("figure", { name: "Weekly submitted applications" });
    await user.selectOptions(screen.getByLabelText("Reporting range"), "all");
    expect(await screen.findByText("submitted all time")).toBeVisible();
    expect(screen.queryByRole("figure", { name: "Weekly submitted applications" })).not.toBeInTheDocument();
    expect(screen.queryByText(/compared with the previous equal period/)).not.toBeInTheDocument();
  });

  it("labels record updates explicitly and retains successful facts if Analytics fails", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () => HttpResponse.json({ ...testDashboard, recent_applications: [makeApplication()] })),
      http.get(`${API_ORIGIN}/api/v1/analytics`, () => HttpResponse.json({ error: { code: "UNAVAILABLE", message: "Unavailable", request_id: "home" } }, { status: 503 })),
    );
    renderApp("/dashboard");
    const records = (await screen.findByRole("heading", { name: "Recently updated" })).closest("section")!;
    expect(within(records).getByText(/^Updated/)).toBeVisible();
    expect(await screen.findByText(/Search activity is unavailable/)).toBeVisible();
    expect(within(records).getByRole("link", { name: /Northstar Labs/ })).toBeVisible();
    expect(screen.queryByText(/Since you were last/)).not.toBeInTheDocument();
  });

  it("does not fabricate a trend for an empty period", async () => {
    server.use(http.get(`${API_ORIGIN}/api/v1/analytics`, () => HttpResponse.json({ ...makeAnalytics(), rates: { ...testDashboard.rates, submitted_count: 0 }, submission_trend: [] })));
    renderApp("/dashboard");
    expect(await screen.findByText("No submissions recorded in this period.")).toBeVisible();
    expect(screen.queryByRole("figure", { name: "Weekly submitted applications" })).not.toBeInTheDocument();
  });

  it("keeps a failed follow-up mutation connected to discoverable recorded work", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () => HttpResponse.json({ ...testDashboard, actions: [{ kind: "FOLLOW_UP_OVERDUE", application_id: makeApplication().application_id, company_name: "Northstar", job_title: "Engineer", due_date: "2026-08-11", priority: "HIGH", label: "Send saved check-back" }] })),
      http.post(`${API_ORIGIN}/api/v1/applications/:applicationId/follow-up/complete`, () => HttpResponse.json({ error: { code: "VERSION_CONFLICT", message: "The record changed. Try again.", request_id: "home" } }, { status: 409 })),
    );
    const { user } = renderApp("/dashboard");
    await user.click(await screen.findByRole("button", { name: /Details.*Recorded overdue/ }));
    await user.click(screen.getByRole("button", { name: "Complete follow-up" }));
    expect(await screen.findByRole("heading", { name: "Follow-up could not be updated" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Overdue follow-up" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Complete follow-up" })).toBeEnabled();
  });
});
