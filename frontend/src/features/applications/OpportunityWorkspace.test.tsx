import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { OpportunityGroup, OpportunityWorkspaceItem } from "../../api/schemas";
import { makeApplication } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";
import { API_ORIGIN, server } from "../../test/server";

function items(count: number, group: OpportunityGroup): OpportunityWorkspaceItem[] {
  return Array.from({ length: count }, (_, index) => ({
    application: makeApplication({
      application_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      company_name: `Company ${index + 1}`,
      job_title: `Role ${index + 1}`,
    }),
    classification: {
      group,
      reason_code: group === "needs_action" ? "CANDIDATE_ACTION_UNSCHEDULED" : group === "waiting" ? "RECENTLY_APPLIED" : "PROCESS_PROGRESSING",
      relevant_date: null,
      relevant_at: null,
      action_type: "OPEN_OPPORTUNITY",
      interview_id: null,
      next_interview: null,
    },
  }));
}

function installGroup(count: number, group: OpportunityGroup = "needs_action") {
  const all = items(count, group);
  const requests: Array<string | null> = [];
  server.use(
    http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () => HttpResponse.json({
      generated_at: "2026-08-27T14:00:00Z",
      groups: {
        needs_action: { total_count: 0, items: [], next_cursor: null },
        moving_forward: { total_count: 0, items: [], next_cursor: null },
        waiting: { total_count: 0, items: [], next_cursor: null },
        [group]: { total_count: count, items: all.slice(0, 4), next_cursor: count > 4 ? "preview" : null },
      },
    })),
    http.get(`${API_ORIGIN}/api/v1/applications/workspace/groups/${group}`, ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get("cursor");
      requests.push(cursor);
      expect(url.searchParams.get("limit")).toBe("20");
      return HttpResponse.json({
        total_count: count,
        items: cursor ? all.slice(20) : all.slice(0, 20),
        next_cursor: !cursor && count > 20 ? "second-page" : null,
      });
    }),
    http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, ({ params }) => HttpResponse.json(
      all.find((item) => item.application.application_id === params.applicationId)?.application ?? makeApplication(),
    )),
  );
  return { all, requests };
}

describe("grouped opportunity disclosure", () => {
  it.each([0, 1, 3, 4, 5])("keeps the three-record preview and discloses a %i-record group", async (count) => {
    const { requests } = installGroup(count);
    const { user } = renderApp("/applications?view=ACTIVE");
    if (count === 0) {
      expect(await screen.findByRole("heading", { name: "No active applications" })).toBeVisible();
      expect(screen.queryByRole("button", { name: /^Show \d+ more/ })).not.toBeInTheDocument();
    } else {
      const group = await screen.findByRole("region", { name: "Needs your attention" });
      expect(within(group).getAllByRole("link", { name: /^Role \d+$/ })).toHaveLength(Math.min(3, count));
      expect(requests).toEqual([]);
      if (count <= 3) {
        expect(within(group).queryByRole("button", { name: /^Show \d+ more/ })).not.toBeInTheDocument();
      } else {
        const disclosure = within(group).getByRole("button", { name: `Show ${count - 3} more needs your attention` });
        expect(disclosure).toHaveAttribute("aria-expanded", "false");
        expect(document.getElementById(disclosure.getAttribute("aria-controls")!)).toBeInTheDocument();
        await user.click(disclosure);
        await waitFor(() => expect(within(group).getAllByRole("link", { name: /^Role \d+$/ })).toHaveLength(count));
        expect(requests).toEqual([null]);
        expect(disclosure).toHaveAttribute("aria-expanded", "true");
        disclosure.focus();
        await user.keyboard("{Enter}");
        expect(within(group).getAllByRole("link", { name: /^Role \d+$/ })).toHaveLength(3);
        expect(disclosure).toHaveAttribute("aria-expanded", "false");
      }
    }
    expect(requests).toHaveLength(count > 3 ? 1 : 0);
  });

  it.each([
    ["needs_action", "Needs your attention"],
    ["moving_forward", "Moving forward"],
    ["waiting", "Waiting"],
  ] as const)("makes the fourth %s record keyboard-accessible", async (groupKey, title) => {
    const { all, requests } = installGroup(4, groupKey);
    const { user, router } = renderApp("/applications?view=ACTIVE");
    const group = await screen.findByRole("region", { name: title });
    const disclosure = within(group).getByRole("button", { name: `Show 1 more ${title.toLowerCase()}` });
    disclosure.focus();
    await user.keyboard(" ");
    const fourth = await within(group).findByRole("link", { name: "Role 4" });
    expect(fourth).toHaveAttribute("href", `/applications/${all[3].application.application_id}`);
    fourth.focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.pathname).toBe(`/applications/${all[3].application.application_id}`);
    expect(requests).toEqual([null]);
  });

  it("loads later cursor pages only on demand and retains them across collapse", async () => {
    const { all, requests } = installGroup(21);
    const { user, router } = renderApp("/applications?view=ACTIVE");
    const group = await screen.findByRole("region", { name: "Needs your attention" });
    const disclosure = within(group).getByRole("button", { name: "Show 18 more needs your attention" });
    expect(requests).toEqual([]);
    await user.click(disclosure);
    await within(group).findByRole("link", { name: "Role 20" });
    expect(within(group).queryByRole("link", { name: "Role 21" })).not.toBeInTheDocument();
    expect(requests).toEqual([null]);
    await user.click(within(group).getByRole("button", { name: "Load more" }));
    await within(group).findByRole("link", { name: "Role 21" });
    expect(within(group).getAllByRole("link", { name: /^Role \d+$/ })).toHaveLength(21);
    expect(requests).toEqual([null, "second-page"]);
    expect(within(group).queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    await user.click(disclosure);
    expect(within(group).getAllByRole("link", { name: /^Role \d+$/ })).toHaveLength(3);
    await user.click(disclosure);
    await user.click(within(group).getByRole("link", { name: "Role 21" }));
    expect(router.state.location.pathname).toBe(`/applications/${all[20].application.application_id}`);
    expect(requests).toEqual([null, "second-page"]);
  });
});
