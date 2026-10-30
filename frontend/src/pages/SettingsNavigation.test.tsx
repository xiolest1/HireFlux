import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { AdapterWorkspace, SessionAdapter } from "../auth/sessionAdapters";
import { renderApp } from "../test/renderApp";
import { testSettings, testUser } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";

const warningTitle = "Leave without saving preferences?";

function homeLink() {
  return within(screen.getByRole("complementary", { name: "Workspace navigation" })).getByRole("link", { name: /^Home$/ });
}

function beforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  fireEvent(window, event);
  return event;
}

async function changeRange(user: ReturnType<typeof renderApp>["user"]) {
  await user.selectOptions(await screen.findByLabelText("Default dashboard range"), "90d");
}

function persistentAdapter(): SessionAdapter {
  const workspace: AdapterWorkspace = {
    lifetime: "durable", identityKind: "PERSISTENT", authorization: "Bearer synthetic-settings-test-only",
    bootstrap: {
      state: "ACTIVE", identity_kind: "PERSISTENT", bootstrap_version: 1,
      created_at: testSettings.created_at, updated_at: testSettings.updated_at,
      profile: testUser, settings: testSettings,
    },
  };
  return {
    id: "settings-navigation-account-fixture", lifetime: "durable",
    restore: () => workspace, activate: async () => workspace,
    persist() {}, clear() {}, valid: () => true,
  };
}

describe("Settings preference navigation protection", () => {
  it("allows clean navigation without a dialog or document-unload warning", async () => {
    const { user, router } = renderApp("/settings");
    await screen.findByLabelText("Default dashboard range");
    expect(beforeUnload().defaultPrevented).toBe(false);
    await user.click(homeLink());
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps a dirty draft with keyboard-safe recovery, then permits one explicit discard", async () => {
    const { user, router } = renderApp("/settings");
    await changeRange(user);
    const home = homeLink();
    await user.click(home);
    const dialog = await screen.findByRole("alertdialog", { name: warningTitle });
    expect(router.state.location.pathname).toBe("/settings");
    const keepEditing = within(dialog).getByRole("button", { name: "Keep editing" });
    const discard = within(dialog).getByRole("button", { name: "Discard changes" });
    await waitFor(() => expect(keepEditing).toHaveFocus());
    await user.tab();
    expect(discard).toHaveFocus();
    await user.tab();
    expect(keepEditing).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog", { name: warningTitle })).not.toBeInTheDocument();
    await waitFor(() => expect(home).toHaveFocus());
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
    await user.click(home);
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each(["Back", "Forward"] as const)("protects dirty drafts during browser %s navigation", async (direction) => {
    const { user, router } = renderApp(direction === "Back" ? "/dashboard" : "/settings");
    if (direction === "Back") {
      await screen.findByRole("heading", { name: /^Home$/ });
      await act(async () => { await router.navigate("/settings"); });
    } else {
      await screen.findByLabelText("Default dashboard range");
      await act(async () => { await router.navigate("/dashboard"); });
      await screen.findByRole("heading", { name: /^Home$/ });
      await act(async () => { await router.navigate(-1); });
    }
    await changeRange(user);
    act(() => { void router.navigate(direction === "Back" ? -1 : 1); });
    const dialog = await screen.findByRole("alertdialog", { name: warningTitle });
    expect(router.state.location.pathname).toBe("/settings");
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
    act(() => { void router.navigate(direction === "Back" ? -1 : 1); });
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });

  it("requests native unload protection only while preferences are modified", async () => {
    const { user } = renderApp("/settings");
    const range = await screen.findByLabelText("Default dashboard range");
    const original = (range as HTMLSelectElement).value;
    await user.selectOptions(range, "90d");
    expect(beforeUnload().defaultPrevented).toBe(true);
    await user.selectOptions(range, original);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("follows the existing form convention while a deliberate save is pending", async () => {
    let finish: (() => void) | undefined;
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, async () => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return HttpResponse.json({ ...testSettings, default_dashboard_range: "90d", version: 2 });
    }));
    const { user, router, controller } = renderApp("/settings");
    await changeRange(user);
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(finish).toBeDefined());
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
    expect(beforeUnload().defaultPrevented).toBe(false);
    expect(controller.hasUnsavedChanges).toBe(false);
    await user.click(homeLink());
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await act(async () => { finish?.(); });
    await waitFor(() => expect(controller.getSnapshot().queryClient.getQueryData(["settings"])).toMatchObject({ default_dashboard_range: "90d", version: 2 }));
  });

  it("removes dirty warnings after a successful save", async () => {
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json({
      ...testSettings, default_dashboard_range: "90d", version: 2,
    })));
    const { user, router, controller } = renderApp("/settings");
    await changeRange(user);
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByText("Preferences saved for this demo workspace.");
    expect(beforeUnload().defaultPrevented).toBe(false);
    expect(controller.hasUnsavedChanges).toBe(false);
    await user.click(homeLink());
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each([409, 503])("restores draft protection after a failed save (%s)", async (status) => {
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json({
      error: { code: status === 409 ? "CONFLICT" : "UNAVAILABLE", message: "Preferences could not be saved.", request_id: "settings-navigation-fixture" },
    }, { status })));
    const { user, controller } = renderApp("/settings");
    await changeRange(user);
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByRole("heading", { name: "Preferences could not be saved" });
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
    expect(beforeUnload().defaultPrevented).toBe(true);
    expect(controller.hasUnsavedChanges).toBe(true);
    await user.click(homeLink());
    await screen.findByRole("alertdialog", { name: warningTitle });
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
  });

  it("uses only the existing explicit sign-out confirmation and permits privacy cleanup", async () => {
    const { user, controller } = renderApp("/settings", { adapter: persistentAdapter() });
    await changeRange(user);
    await user.click(screen.getByRole("button", { name: /^Sign Out$/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave with unsaved changes?" });
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.queryByRole("alertdialog", { name: warningTitle })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Default dashboard range")).toHaveValue("90d");
    await user.click(screen.getByRole("button", { name: /^Sign Out$/ }));
    await user.click(screen.getByRole("button", { name: "Discard changes and leave" }));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Keep every opportunity");
    expect(controller.getSnapshot().status).toBe("anonymous");
    expect(controller.getSnapshot().queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(beforeUnload().defaultPrevented).toBe(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("never lets a pending navigation warning prevent forced session expiry", async () => {
    const { user, controller } = renderApp("/settings");
    await changeRange(user);
    await user.click(homeLink());
    await screen.findByRole("alertdialog", { name: warningTitle });
    act(() => controller.invalidate("expired"));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Keep every opportunity");
    expect(screen.queryByLabelText("Default dashboard range")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(controller.getSnapshot().queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });
});
