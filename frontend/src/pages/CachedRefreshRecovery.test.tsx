import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Application, OpportunityWorkspace } from "../api/schemas";
import { makeAnalytics, makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { API_ORIGIN, server } from "../test/server";

function unavailable() {
  return HttpResponse.json({ error: { code: "UNAVAILABLE", message: "Temporarily unavailable.", request_id: "refresh-test" } }, { status: 503 });
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

function workspace(application?: Application): OpportunityWorkspace {
  return {
    generated_at: "2026-08-27T14:00:00Z",
    groups: {
      needs_action: { total_count: 0, items: [], next_cursor: null },
      moving_forward: { total_count: 0, items: [], next_cursor: null },
      waiting: {
        total_count: application ? 1 : 0,
        items: application ? [{ application, classification: {
          group: "waiting", reason_code: "RECENTLY_APPLIED", relevant_date: null,
          relevant_at: null, action_type: "OPEN_OPPORTUNITY", interview_id: null, next_interview: null,
        } }] : [],
        next_cursor: null,
      },
    },
  };
}

describe("cached refresh recovery", () => {
  it("keeps initial Analytics loading and failure separate from a cached refresh warning", async () => {
    const first = gate();
    server.use(http.get(`${API_ORIGIN}/api/v1/analytics`, async () => {
      await first.promise;
      return unavailable();
    }));
    renderApp("/analytics");
    expect(await screen.findByRole("status", { name: "Calculating workspace analytics" })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Analytics refresh failed" })).not.toBeInTheDocument();
    await act(async () => first.release());
    expect(await screen.findByRole("heading", { name: "Analytics could not be loaded" })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Analytics refresh failed" })).not.toBeInTheDocument();
  });

  it("retains Analytics through a failed refetch and disables repeated manual retry until recovery", async () => {
    let requests = 0;
    const recovery = gate();
    server.use(http.get(`${API_ORIGIN}/api/v1/analytics`, async () => {
      requests += 1;
      if (requests === 2) return unavailable();
      if (requests === 3) await recovery.promise;
      const data = makeAnalytics("90d");
      data.insights[0].title = requests === 1 ? "Cached analytics insight" : "Recovered analytics insight";
      return HttpResponse.json(data);
    }));
    const { controller, user } = renderApp("/analytics");
    expect(await screen.findByText("Cached analytics insight")).toBeVisible();
    await act(async () => { await controller.getSnapshot().queryClient.invalidateQueries({ queryKey: ["analytics"] }); });
    const warning = await screen.findByRole("status", { name: "Analytics refresh failed" });
    expect(within(warning).getByText(/may not reflect the latest server state/)).toBeVisible();
    expect(screen.getByText("Cached analytics insight")).toBeVisible();
    expect(requests).toBe(2);
    await user.click(within(warning).getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(requests).toBe(3));
    expect(within(warning).getByRole("button", { name: "Retrying…" })).toBeDisabled();
    expect(screen.getByText("Cached analytics insight")).toBeVisible();
    await act(async () => recovery.release());
    expect(await screen.findByText("Recovered analytics insight")).toBeVisible();
    expect(screen.queryByRole("status", { name: "Analytics refresh failed" })).not.toBeInTheDocument();
    expect(requests).toBe(3);
  });

  it.each([true, false])("retains flat Applications cached content (populated=%s) and recovers explicitly", async (populated) => {
    let requests = 0;
    server.use(http.get(`${API_ORIGIN}/api/v1/applications`, () => {
      requests += 1;
      if (requests === 2) return unavailable();
      return HttpResponse.json({ items: requests === 1 && !populated ? [] : [makeApplication({ job_title: requests === 1 ? "Cached role" : "Recovered role" })], next_cursor: null });
    }));
    const { controller, user } = renderApp("/applications?view=ALL");
    if (populated) await screen.findByRole("link", { name: "Cached role" });
    else await screen.findByRole("heading", { name: "No applications yet" });
    await act(async () => { await controller.getSnapshot().queryClient.invalidateQueries({ queryKey: ["applications", "list"] }); });
    const warning = await screen.findByRole("status", { name: "Applications refresh failed" });
    if (populated) expect(screen.getByRole("link", { name: "Cached role" })).toBeVisible();
    else expect(screen.getByRole("heading", { name: "No applications yet" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Applications could not be loaded" })).not.toBeInTheDocument();
    expect(requests).toBe(2);
    await user.click(within(warning).getByRole("button", { name: "Retry refresh" }));
    expect(await screen.findByRole("link", { name: "Recovered role" })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Applications refresh failed" })).not.toBeInTheDocument();
    expect(requests).toBe(3);
  });

  it.each([true, false])("retains grouped Applications cached content (populated=%s) after a failed refetch", async (populated) => {
    let requests = 0;
    server.use(http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () => {
      requests += 1;
      if (requests === 2) return unavailable();
      return HttpResponse.json(workspace(requests === 1 && !populated ? undefined : makeApplication({ job_title: requests === 1 ? "Cached grouped role" : "Recovered grouped role" })));
    }));
    const { controller, user } = renderApp("/applications");
    if (populated) await screen.findByRole("link", { name: "Cached grouped role" });
    else await screen.findByRole("heading", { name: "No active applications" });
    await act(async () => { await controller.getSnapshot().queryClient.invalidateQueries({ queryKey: ["applications", "workspace"] }); });
    const warning = await screen.findByRole("status", { name: "Opportunity workspace refresh failed" });
    if (populated) expect(screen.getByRole("link", { name: "Cached grouped role" })).toBeVisible();
    else expect(screen.getByRole("heading", { name: "No active applications" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Opportunity workspace could not be loaded" })).not.toBeInTheDocument();
    await user.click(within(warning).getByRole("button", { name: "Retry refresh" }));
    expect(await screen.findByRole("link", { name: "Recovered grouped role" })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Opportunity workspace refresh failed" })).not.toBeInTheDocument();
    expect(requests).toBe(3);
  });

  it("keeps a next-page failure separate and retains existing rows during pagination retry", async () => {
    let nextRequests = 0;
    server.use(http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
      if (!new URL(request.url).searchParams.has("cursor")) return HttpResponse.json({ items: [makeApplication({ job_title: "First page role" })], next_cursor: "second-page" });
      nextRequests += 1;
      if (nextRequests === 1) return unavailable();
      return HttpResponse.json({ items: [makeApplication({ application_id: "22222222-2222-4222-8222-222222222222", job_title: "Second page role" })], next_cursor: null });
    }));
    const { user } = renderApp("/applications?view=ALL");
    await screen.findByRole("link", { name: "First page role" });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    const heading = await screen.findByRole("heading", { name: "More applications could not be loaded" });
    expect(screen.getByRole("link", { name: "First page role" })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Applications refresh failed" })).not.toBeInTheDocument();
    await user.click(within(heading.closest('[role="alert"]')!).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Second page role" })).toBeVisible();
    expect(screen.getByRole("link", { name: "First page role" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "More applications could not be loaded" })).not.toBeInTheDocument();
    expect(nextRequests).toBe(2);
  });

  it("clears cached private content and its refresh warning on session invalidation", async () => {
    let fail = false;
    server.use(http.get(`${API_ORIGIN}/api/v1/applications`, () => fail ? unavailable() : HttpResponse.json({ items: [makeApplication({ job_title: "Private cached role" })], next_cursor: null })));
    const { controller } = renderApp("/applications?view=ALL");
    await screen.findByRole("link", { name: "Private cached role" });
    const oldClient = controller.getSnapshot().queryClient;
    fail = true;
    await act(async () => { await oldClient.invalidateQueries({ queryKey: ["applications", "list"] }); });
    await screen.findByRole("status", { name: "Applications refresh failed" });
    act(() => controller.invalidate());
    await screen.findByRole("heading", { name: "Keep every opportunity connected to what comes next." });
    expect(screen.queryByText("Private cached role")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Applications refresh failed" })).not.toBeInTheDocument();
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
    expect(controller.getSnapshot().queryClient).not.toBe(oldClient);
  });
});
