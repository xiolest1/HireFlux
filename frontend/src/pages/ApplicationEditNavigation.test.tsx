import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Application } from "../api/schemas";
import { makeApplication } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { API_ORIGIN, server } from "../test/server";

function installApplication(initial = makeApplication({ version: 7 })) {
  let application = initial;
  const writes: Record<string, unknown>[] = [];
  server.use(
    http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json(application)),
    http.get(`${API_ORIGIN}/api/v1/applications`, () => HttpResponse.json({ items: [application], next_cursor: null })),
    http.patch(`${API_ORIGIN}/api/v1/applications/:applicationId`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      writes.push(body);
      application = { ...application, company_name: String(body.company_name), version: 8 };
      return HttpResponse.json(application);
    }),
  );
  return { application, writes };
}

async function openEdit(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(await screen.findByRole("button", { name: "More opportunity actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Edit opportunity" }));
  await screen.findByLabelText(/Company name/);
}

describe("application editing collection continuity", () => {
  it.each([
    "/applications?view=ACTIVE&q=Acme&status=APPLIED",
    "/applications?view=ALL&sort=updated_asc",
    "/applications?view=ARCHIVED&sort=updated_desc",
  ])("returns a successful edit to the exact originating collection: %s", async (returnTo) => {
    const archived = returnTo.includes("ARCHIVED");
    const fixture = installApplication(makeApplication({
      version: 7,
      ...(archived ? { status: "ARCHIVED" } : {}),
    }));
    const { user, router } = renderApp(returnTo);
    await user.click(await screen.findByRole("link", { name: fixture.application.job_title }));
    await openEdit(user);
    expect(router.state.location.state).toEqual({ applicationsOrigin: { returnTo } });
    await user.clear(screen.getByLabelText(/Company name/));
    await user.type(screen.getByLabelText(/Company name/), "Updated Company");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Application details updated.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to applications" })).toHaveAttribute("href", returnTo);
    await waitFor(() => expect(router.state.location.state).toEqual({ applicationsOrigin: { returnTo } }));
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({ expected_version: 7, company_name: "Updated Company" });
    expect(fixture.writes[0]).not.toHaveProperty("status");
    expect(fixture.writes[0]).not.toHaveProperty("owner_user_id");
    await user.click(screen.getByRole("link", { name: "Back to applications" }));
    await waitFor(() => expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(returnTo));
  });

  it("preserves collection context through the existing dirty-form Back and explicit discard", async () => {
    const fixture = installApplication();
    const returnTo = "/applications?view=ALL&source=REFERRAL";
    const { user, router } = renderApp({
      pathname: `/applications/${fixture.application.application_id}`,
      state: { applicationsOrigin: { returnTo } },
    });
    await openEdit(user);
    await user.type(screen.getByLabelText(/Company name/), " draft");
    await user.click(screen.getByRole("link", { name: "Back to application" }));
    await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText(/Company name/)).toHaveValue(`${fixture.application.company_name} draft`);
    await user.click(screen.getByRole("link", { name: "Back to application" }));
    await user.click(screen.getByRole("button", { name: "Leave page" }));
    expect(await screen.findByRole("link", { name: "Back to applications" })).toHaveAttribute("href", returnTo);
    expect(router.state.location.state).toEqual({ applicationsOrigin: { returnTo } });
    expect(fixture.writes).toHaveLength(0);
  });

  it.each([
    undefined,
    { applicationsOrigin: { returnTo: "https://example.com/applications" } },
    { applicationsOrigin: { returnTo: "/applications/other" } },
    { applicationsOrigin: { returnTo: "/applications", intent: "UNKNOWN" } },
  ])("uses the safe fallback for direct or invalid Edit state %#", async (state) => {
    const fixture = installApplication();
    const { user } = renderApp({ pathname: `/applications/${fixture.application.application_id}/edit`, state });
    await user.click(await screen.findByRole("link", { name: "Back to application" }));
    expect(await screen.findByRole("link", { name: "Back to applications" })).toHaveAttribute("href", "/applications");
    expect(fixture.writes).toHaveLength(0);
  });

  it("does not replay a consumed primary-action intent after editing", async () => {
    const fixture = installApplication(makeApplication({
      next_step_responsibility: "CANDIDATE", next_step_note: "Send portfolio", follow_up_date: "2026-08-29",
      allowed_transitions: ["SCREENING", "REJECTED", "ARCHIVED"],
    }));
    const returnTo = "/applications?view=ACTIVE&source=REFERRAL";
    const { user, router } = renderApp({
      pathname: `/applications/${fixture.application.application_id}`,
      state: { applicationsOrigin: { returnTo, intent: "RUN_PRIMARY_ACTION" } },
    });
    await screen.findByRole("heading", { name: "Manage next step" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Manage next step" })).not.toBeInTheDocument());
    await openEdit(user);
    expect(router.state.location.state).toEqual({ applicationsOrigin: { returnTo } });
    await user.click(screen.getByRole("link", { name: "Back to application" }));
    await screen.findByRole("heading", { name: "One opportunity, unfolding over time" });
    expect(screen.queryByRole("heading", { name: "Manage next step" })).not.toBeInTheDocument();
    expect(router.state.location.state).toEqual({ applicationsOrigin: { returnTo } });
  });

  it("strips a direct Edit intent on the next-step Decide later exit", async () => {
    const fixture = installApplication();
    const returnTo = "/applications?view=ALL&sort=created_at";
    const { user, router } = renderApp({
      pathname: `/applications/${fixture.application.application_id}/edit`,
      state: { applicationsOrigin: { returnTo, intent: "RUN_PRIMARY_ACTION" } },
    });
    await user.click(await screen.findByRole("button", { name: "Decide later" }));
    expect(await screen.findByRole("link", { name: "Back to applications" })).toHaveAttribute("href", returnTo);
    expect(router.state.location.state).toEqual({ applicationsOrigin: { returnTo } });
    expect(screen.queryByRole("heading", { name: "Manage next step" })).not.toBeInTheDocument();
    expect(fixture.writes).toHaveLength(0);
  });

  it.each([409, 503])("retains the draft and origin after an edit failure (%s)", async (status) => {
    const fixture = installApplication();
    server.use(http.patch(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json({
      error: { code: status === 409 ? "CONFLICT" : "UNAVAILABLE", message: "Application could not be updated.", request_id: "edit-navigation-test" },
    }, { status })));
    const returnTo = "/applications?view=ALL&q=Acme";
    const { user, router } = renderApp({
      pathname: `/applications/${fixture.application.application_id}/edit`, state: { applicationsOrigin: { returnTo } },
    });
    await user.type(await screen.findByLabelText(/Company name/), " draft");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Application could not be updated.");
    expect(router.state.location.pathname).toContain("/edit");
    expect(screen.queryByText("Application details updated.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/)).toHaveValue(`${fixture.application.company_name} draft`);
    await user.click(screen.getByRole("link", { name: "Back to application" }));
    await user.click(await screen.findByRole("button", { name: "Leave page" }));
    expect(await screen.findByRole("link", { name: "Back to applications" })).toHaveAttribute("href", returnTo);
  });

  it("does not publish a stale edit response or navigate after identity invalidation", async () => {
    const fixture = installApplication();
    let finish: ((application: Application) => void) | undefined;
    server.use(http.patch(`${API_ORIGIN}/api/v1/applications/:applicationId`, async () => {
      const updated = await new Promise<Application>((resolve) => { finish = resolve; });
      return HttpResponse.json(updated);
    }));
    const { user, controller, router } = renderApp({
      pathname: `/applications/${fixture.application.application_id}/edit`,
      state: { applicationsOrigin: { returnTo: "/applications?view=ALL" } },
    });
    await user.type(await screen.findByLabelText(/Company name/), " draft");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(finish).toBeDefined());
    act(() => controller.invalidate("expired"));
    await act(async () => { finish?.({ ...fixture.application, version: 8 }); });
    await waitFor(() => expect(controller.getSnapshot().status).not.toBe("ready"));
    expect(router.state.location.pathname).not.toBe(`/applications/${fixture.application.application_id}`);
    expect(screen.queryByText("Application details updated.")).not.toBeInTheDocument();
    expect(controller.getSnapshot().queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("preserves a validated collection return on a missing Edit record", async () => {
    server.use(http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () => HttpResponse.json({
      error: { code: "NOT_FOUND", message: "Application not found.", request_id: "missing-edit-test" },
    }, { status: 404 })));
    renderApp({
      pathname: "/applications/11111111-1111-4111-8111-111111111111/edit",
      state: { applicationsOrigin: { returnTo: "/applications?view=ARCHIVED" } },
    });
    expect(await screen.findByRole("link", { name: "Back to applications" })).toHaveAttribute("href", "/applications?view=ARCHIVED");
  });
});
