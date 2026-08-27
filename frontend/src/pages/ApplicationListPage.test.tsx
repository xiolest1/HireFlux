import { delay, http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication, testSettings } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

function workspaceResponse(application = makeApplication()) {
  return {
    generated_at: "2026-08-27T14:00:00Z",
    groups: {
      needs_action: { total_count: 0, items: [], next_cursor: null },
      moving_forward: { total_count: 0, items: [], next_cursor: null },
      waiting: {
        total_count: 1,
        items: [
          {
            application,
            classification: {
              group: "waiting",
              reason_code: "RECENTLY_APPLIED",
              relevant_date: null,
              relevant_at: null,
              action_type: "OPEN_OPPORTUNITY",
              interview_id: null,
              next_interview: null,
            },
          },
        ],
        next_cursor: null,
      },
    },
  };
}

function emptyWorkspaceResponse() {
  const response = workspaceResponse();
  response.groups.waiting = { total_count: 0, items: [], next_cursor: null };
  return response;
}

describe("ApplicationListPage", () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () =>
        HttpResponse.json(workspaceResponse()),
      ),
    );
  });
  it("preserves the Search Health follow-up deep link in requests and filter controls", async () => {
    let requestedFollowUp: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedFollowUp = new URL(request.url).searchParams.get("follow_up");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { user } = renderApp("/applications?view=ACTIVE&follow_up=NEEDS_ATTENTION");
    expect(
      await screen.findByRole(
        "button",
        { name: "Remove Follow-up: Needs attention filter" },
        { timeout: 3_000 },
      ),
    ).toBeVisible();
    await waitFor(() => expect(requestedFollowUp).toBe("NEEDS_ATTENTION"));

    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(screen.getByLabelText("Follow-up planning")).toHaveValue("NEEDS_ATTENTION");
  });

  it("uses grouped Active mode without the former standalone attention shortcut", async () => {
    renderApp("/applications?view=ACTIVE");
    expect(await screen.findByRole("heading", { name: "Needs your attention" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Waiting" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Needs attention" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
  });

  it("keeps active filter chips compact and exposes the overflow accessibly", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [makeApplication()], next_cursor: null }),
      ),
    );

    const { user, router } = renderApp(
      "/applications?view=ACTIVE&q=engineer&status=APPLIED&source=REFERRAL&work_mode=REMOTE&stage_age=15-30&follow_up=NEEDS_ATTENTION",
    );
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Filters, 5 active" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Search: engineer filter" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Status: Applied filter" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Source: Referral filter" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove Work mode: Remote filter" })).not.toBeInTheDocument();

    const moreFilters = screen.getByRole("button", { name: "+3 more filters" });
    expect(moreFilters).toHaveAttribute("aria-expanded", "false");
    expect(moreFilters).toHaveAttribute("aria-controls", "additional-application-filters");
    await user.click(moreFilters);
    expect(screen.getByRole("button", { name: "Show fewer filters" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Remove Work mode: Remote filter" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Stage age: 15–30 days filter" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Follow-up: Needs attention filter" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(router.state.location.search).toBe("?view=ACTIVE"));
  });

  it("updates sort independently and organizes the staged drawer sections", async () => {
    let requestedSort: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedSort = new URL(request.url).searchParams.get("sort");
        return HttpResponse.json({ items: [makeApplication()], next_cursor: null });
      }),
    );

    const { user, router } = renderApp("/applications?view=ACTIVE");
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(screen.queryByLabelText("Sort applications")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Sort by"), "updated_asc");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => {
      expect(requestedSort).toBe("updated_asc");
      expect(router.state.location.search).toContain("sort=updated_asc");
    });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Context" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Attention" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Order results" })).toBeVisible();
    expect(screen.getByLabelText("Sort by")).toHaveValue("updated_asc");
  });

  it("clears Active-only staged filters when a non-active status is selected", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [makeApplication()], next_cursor: null }),
      ),
    );
    const { user } = renderApp("/applications?view=ACTIVE");
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const stageAge = screen.getByLabelText("Time in current stage");
    const followUp = screen.getByLabelText("Follow-up planning");
    await user.selectOptions(stageAge, "15-30");
    await user.selectOptions(followUp, "NEEDS_ATTENTION");
    await user.selectOptions(screen.getByLabelText("Status"), "REJECTED");

    expect(stageAge).toHaveValue("");
    expect(followUp).toHaveValue("");
    expect(stageAge).toBeDisabled();
    expect(followUp).toBeDisabled();
    expect(screen.getByText(/available only for the Active view/i)).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Status"), "APPLIED");
    expect(stageAge).toBeEnabled();
    expect(followUp).toBeEnabled();
  });

  it("uses an accessible grouped skeleton for the initial load", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, async () => {
        await delay(300);
        return HttpResponse.json(workspaceResponse());
      }),
    );

    renderApp();

    expect(
      await screen.findByRole("status", { name: "Loading applications…" }),
    ).toBeVisible();
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
  });

  it("uses the role as the single collection navigation link without Manage", async () => {
    const application = makeApplication();
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [application], next_cursor: null }),
      ),
    );

    renderApp();

    const roleLink = await screen.findByRole("link", { name: "Frontend Engineer" });
    expect(roleLink).toHaveAttribute(
      "href",
      `/applications/${application.application_id}`,
    );
    expect(screen.queryByText("Manage")).not.toBeInTheDocument();
  });

  it("does not promote generic update timestamps in grouped rows", async () => {
    const application = makeApplication({ updated_at: "2026-08-14T01:00:00Z" });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () =>
        HttpResponse.json(workspaceResponse(application)),
      ),
      http.get(`${API_ORIGIN}/api/v1/settings`, () =>
        HttpResponse.json({ ...testSettings, time_zone: "America/Los_Angeles" }),
      ),
    );

    renderApp();

    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(screen.queryByText(/Updated Aug 13/)).not.toBeInTheDocument();
  });

  it("binds requests to the selected status, including Archived", async () => {
    let requestedStatus: string | null = null;
    let requestedView: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () =>
        HttpResponse.json(emptyWorkspaceResponse()),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        const search = new URL(request.url).searchParams;
        requestedStatus = search.get("status");
        requestedView = search.get("view");
        return HttpResponse.json({
          items:
            requestedStatus === "ARCHIVED" || requestedStatus === "REJECTED"
              ? [
                  makeApplication({
                    status: requestedStatus,
                    allowed_transitions:
                      requestedStatus === "ARCHIVED" ? ["APPLIED"] : ["ARCHIVED"],
                  }),
                ]
              : [],
          next_cursor: null,
        });
      }),
    );

    const { user } = renderApp();
    expect(await screen.findByText("No active applications")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Status"), "ARCHIVED");
    expect(requestedStatus).toBeNull();
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedStatus).toBe("ARCHIVED");
    expect(requestedView).toBe("ARCHIVED");

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.selectOptions(screen.getByLabelText("Status"), "REJECTED");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(requestedStatus).toBe("REJECTED");
      expect(requestedView).toBe("ALL");
    });
  });

  it("preserves an exact stage-age drill-down and exposes a removable filter", async () => {
    let requestedStageAge: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedStageAge = new URL(request.url).searchParams.get("stage_age");
        return HttpResponse.json({ items: [makeApplication()], next_cursor: null });
      }),
    );

    const { user, router } = renderApp(
      "/applications?view=ACTIVE&stage_age=15-30",
    );
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedStageAge).toBe("15-30");
    expect(
      screen.getByRole("button", { name: "Remove Stage age: 15–30 days filter" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Remove Stage age: 15–30 days filter" }),
    );
    await waitFor(() => expect(router.state.location.search).not.toContain("stage_age"));
  });

  it("adds a stage-age filter from the application filter drawer", async () => {
    let requestedStageAge: string | null = null;
    let requestedView: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () =>
        HttpResponse.json(emptyWorkspaceResponse()),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        const search = new URL(request.url).searchParams;
        requestedStageAge = search.get("stage_age");
        requestedView = search.get("view");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { user } = renderApp("/applications?view=ACTIVE");
    expect(await screen.findByText("No active applications")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Time in current stage"), "31+");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(requestedStageAge).toBe("31+");
      expect(requestedView).toBe("ACTIVE");
    });
  });

  it("removes stage-age from a non-active shared URL before requesting data", async () => {
    let requestedStageAge: string | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedStageAge = new URL(request.url).searchParams.get("stage_age");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );

    const { router } = renderApp("/applications?view=ALL&stage_age=15-30");

    expect(await screen.findByText("No applications yet")).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe("?view=ALL"));
    expect(requestedStageAge).toBeNull();
  });

  it("asks the server for the whole selected view without filtering the page locally", async () => {
    let requestedView: string | null = null;
    const archived = makeApplication({
      status: "ARCHIVED",
      allowed_transitions: ["APPLIED"],
    });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/workspace`, () =>
        HttpResponse.json(emptyWorkspaceResponse()),
      ),
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        requestedView = new URL(request.url).searchParams.get("view");
        return HttpResponse.json({
          items: requestedView === "ALL" ? [archived] : [],
          next_cursor: null,
        });
      }),
    );

    const { user } = renderApp();
    expect(await screen.findByText("No active applications")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    expect(requestedView).toBe("ALL");
  });

  it("deduplicates an application repeated across cursor pages", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (!cursor) {
          return HttpResponse.json({
            items: [makeApplication({ job_title: "Original title" })],
            next_cursor: "next-page",
          });
        }
        return HttpResponse.json({
          items: [
            makeApplication({ job_title: "Updated title", version: 2 }),
            makeApplication({
              application_id: "33333333-3333-4333-8333-333333333333",
              company_name: "Second Company",
              job_title: "Second role",
            }),
          ],
          next_cursor: null,
        });
      }),
    );

    const { user } = renderApp("/applications?view=ALL");
    expect(await screen.findByRole("link", { name: "Original title" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("link", { name: "Updated title" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Second role" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Original title" })).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "2 applications loaded"),
    ).toBeVisible();
  });

  it("normalizes legacy layout URLs while preserving unrelated parameters", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications`, () =>
        HttpResponse.json({ items: [makeApplication()], next_cursor: null }),
      ),
    );

    const { router } = renderApp("/applications?view=ALL&layout=list&source=REFERRAL");
    expect(await screen.findByRole("link", { name: "Frontend Engineer" })).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe("?view=ALL&source=REFERRAL"));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "List view" })).not.toBeInTheDocument();
  });

  it("traps filter focus and restores it after Escape", async () => {
    const { user } = renderApp();
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();
    const trigger = screen.getByRole("button", { name: "Filters" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Application filters" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close panel" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Application filters" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
