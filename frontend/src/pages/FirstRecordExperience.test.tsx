import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Application } from "../api/schemas";
import type { SessionAdapter } from "../auth/sessionAdapters";
import { makeApplication, testDashboard } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { API_ORIGIN, server } from "../test/server";

function persistentAdapter(): SessionAdapter {
  const workspace = { lifetime: "durable" as const, identityKind: "PERSISTENT" as const, authorization: null };
  return { id: "cognito", lifetime: "durable", restore: () => workspace, activate: async () => workspace, persist() {}, clear() {}, valid: () => true };
}

function emptyDashboard() {
  return { ...testDashboard, summary: { total_tracked: 0, active_pursuits: 0, drafts: 0, accepted: 0, rejected: 0, withdrawn: 0, archived: 0 }, actions: [], recent_applications: [], upcoming_interviews: [] };
}

describe("first-record orientation and distinct empty states", () => {
  it.each(["DRAFT", "APPLIED"] as const)("adds a first %s record from empty Home and confirms only the server-completed save", async (status) => {
    let created: Application | null = null;
    let posted: Record<string, unknown> | null = null;
    let workspaceReads = 0;
    let release!: () => void;
    const responseGate = new Promise<void>((resolve) => { release = resolve; });
    const record = makeApplication({ status, applied_date: status === "APPLIED" ? "2026-08-01" : null });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/dashboard`, () => HttpResponse.json(created ? { ...emptyDashboard(), summary: { ...emptyDashboard().summary, total_tracked: 1, active_pursuits: status === "APPLIED" ? 1 : 0, drafts: status === "DRAFT" ? 1 : 0 }, recent_applications: [created] } : emptyDashboard())),
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () => {
        workspaceReads += 1;
        return HttpResponse.json({ generated_at: "2026-08-12T13:00:00Z", groups: Object.fromEntries(["needs_action", "moving_forward", "waiting"].map((key) => [key, { total_count: 0, items: [], next_cursor: null }])) });
      }),
      http.post(`${API_ORIGIN}/api/v1/applications`, async ({ request }) => {
        posted = await request.json() as Record<string, unknown>;
        await responseGate;
        created = record;
        return HttpResponse.json(record, { status: 201 });
      }),
    );
    const { user, router } = renderApp("/dashboard", { withSession: false, adapter: persistentAdapter() });
    const firstAction = await screen.findByRole("link", { name: "Add your first application" });
    expect(screen.getByText("Your workspace is ready")).toBeVisible();
    expect(screen.queryByText("Limited Home result")).not.toBeInTheDocument();
    expect(workspaceReads).toBe(0);
    firstAction.focus();
    await user.keyboard("{Enter}");
    await user.type(await screen.findByLabelText(/Company/), record.company_name);
    await user.type(screen.getByLabelText(/Role/), record.job_title);
    if (status === "APPLIED") {
      await user.click(screen.getByLabelText("Applied"));
      fireEvent.change(screen.getByLabelText(/Applied on/), { target: { value: "2026-08-01" } });
    }
    await user.click(screen.getByRole("button", { name: "Add application" }));
    await waitFor(() => expect(posted).toMatchObject({ status, applied_date: record.applied_date }));
    expect(screen.queryByText(`${record.job_title} at ${record.company_name} was added.`)).not.toBeInTheDocument();
    await act(async () => release());
    expect(await screen.findByText(`${record.job_title} at ${record.company_name} was added.`)).toBeVisible();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "View application" })).toHaveAttribute("href", `/applications/${record.application_id}`);
    expect(await screen.findByText("1 tracked", { exact: false })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add your first application" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your workspace is ready")).not.toBeInTheDocument();
  });

  it("gives an unfiltered empty All collection a create action that returns to the same sorted collection", async () => {
    const record = makeApplication({ status: "DRAFT", applied_date: null });
    let saved = false;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () => HttpResponse.json({ items: saved ? [record] : [], next_cursor: null })),
      http.post(`${API_ORIGIN}/api/v1/applications`, () => { saved = true; return HttpResponse.json(record, { status: 201 }); }),
    );
    const { user, router } = renderApp("/applications?view=ALL&sort=updated_asc");
    await user.click(await screen.findByRole("link", { name: "Add your first application" }));
    await user.type(await screen.findByLabelText(/Company/), record.company_name);
    await user.type(screen.getByLabelText(/Role/), record.job_title);
    await user.click(screen.getByRole("button", { name: "Add application" }));
    expect(await screen.findByText(`${record.job_title} at ${record.company_name} was added.`)).toBeVisible();
    expect(router.state.location.search).toBe("?view=ALL&sort=updated_asc");
    expect(await screen.findByRole("link", { name: record.job_title })).toBeVisible();
  });

  it.each(["/applications", "/applications?view=ACTIVE&sort=updated_asc"])("does not infer a new workspace from empty Active: %s", async (path) => {
    const archived = makeApplication({ status: "ARCHIVED", allowed_transitions: ["APPLIED"] });
    let listReads = 0;
    server.use(http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
      listReads += 1;
      return HttpResponse.json({ items: new URL(request.url).searchParams.get("view") === "ALL" ? [archived] : [], next_cursor: null });
    }));
    const { user } = renderApp(path);
    expect(await screen.findByRole("heading", { name: "No active applications" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add an application" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add your first application" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your workspace is ready")).not.toBeInTheDocument();
    expect(listReads).toBe(path === "/applications" ? 0 : 1);
    await user.click(screen.getByRole("button", { name: "View all applications" }));
    expect(await screen.findByRole("link", { name: archived.job_title })).toBeVisible();
  });

  it("keeps archived-empty distinct from genuinely zero applications", async () => {
    const { user, router } = renderApp("/applications?view=ARCHIVED");
    expect(await screen.findByRole("heading", { name: "No archived applications" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add your first application" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View all applications" }));
    expect(await screen.findByRole("heading", { name: "No applications yet" })).toBeVisible();
    expect(router.state.location.search).toBe("?view=ALL");
    expect(screen.getByRole("link", { name: "Add your first application" })).toBeVisible();
  });

  it("offers filter recovery instead of implying a first record when a search has no matches", async () => {
    const { user, router } = renderApp("/applications?view=ALL&q=unmatched");
    expect(await screen.findByRole("heading", { name: "No applications match these filters" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add your first application" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(router.state.location.search).toBe("?view=ALL"));
    expect(await screen.findByRole("link", { name: "Add your first application" })).toBeVisible();
  });
});
