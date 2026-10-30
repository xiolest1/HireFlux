import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { AdapterWorkspace, SessionAdapter } from "../auth/sessionAdapters";
import { WorkspaceSessionController } from "../auth/workspaceSessionController";
import { renderApp } from "../test/renderApp";
import { testSettings, testUser } from "../test/fixtures";
import { API_ORIGIN, server } from "../test/server";

const modes = [
  { kind: "DEMO", description: "Demo tools, insights, and preferences.", label: "Demo workspace", exit: "Exit demo" },
  { kind: "PERSISTENT", description: "Account tools, insights, and preferences.", label: "Account workspace", exit: "Sign Out" },
  { kind: "LOCAL", description: "Local development tools, insights, and preferences.", label: "Local development workspace", exit: "Leave local workspace" },
] as const;

function modeOptions(kind: typeof modes[number]["kind"]) {
  if (kind === "DEMO") return {};
  const workspace: AdapterWorkspace = {
    lifetime: "durable", identityKind: kind,
    authorization: kind === "PERSISTENT" ? "Bearer synthetic-mode-fixture-only" : null,
    bootstrap: {
      state: "ACTIVE", identity_kind: kind, bootstrap_version: 1,
      created_at: testSettings.created_at, updated_at: testSettings.updated_at,
      profile: { ...testUser, name: "Alexandria Verylong Fictional Account Display Name" },
      settings: testSettings,
    },
  };
  const adapter: SessionAdapter = {
    id: `mode-copy-${kind}`, lifetime: "durable",
    restore: () => workspace, activate: async () => workspace,
    persist() {}, clear() {}, valid: () => true,
  };
  const controller = new WorkspaceSessionController(adapter);
  Object.defineProperty(controller, "authenticationConfiguration", { get: () => ({
    account_data_policy: kind === "PERSISTENT" ? "disposable_staging" : "local_development",
    account_management_enabled: false,
  }) });
  return { controller };
}

describe("workspace mode communication", () => {
  it.each(modes)("keeps $kind More navigation, lifetime and exit action consistent", async ({ kind, description, label, exit }) => {
    const { user } = renderApp("/dashboard", modeOptions(kind));
    await screen.findByRole("heading", { name: "Home" });
    const trigger = screen.getByRole("button", { name: "More navigation" });
    await user.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: "Workspace" });
    const menu = within(sheet);
    expect(sheet).toHaveAccessibleDescription(description);
    expect(menu.getByText(label)).toBeVisible();
    expect(menu.getByRole("button", { name: exit })).toBeVisible();
    expect(menu.queryByRole("button", { name: "Reset demo" }) !== null).toBe(kind === "DEMO");
    if (kind === "DEMO") {
      expect(menu.getByText(/^Expires in \d+ hr$/)).toBeVisible();
    } else {
      expect(menu.getByText(kind === "PERSISTENT" ? "Saved across sign-outs" : "Saved on the local backend")).toBeVisible();
      expect(menu.queryByText(/Temporary workspace|remaining|expires/i)).not.toBeInTheDocument();
      expect(menu.getByText("Alexandria Verylong Fictional Account Display Name")).toHaveClass("truncate");
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(sheet).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it.each(modes)("does not invent ownership or expiry explanations for a missing $kind interview", async ({ kind }) => {
    renderApp("/interviews?interview=00000000-0000-4000-8000-000000000099", modeOptions(kind));
    await screen.findByRole("heading", { name: "Interview not found" });
    if (kind === "DEMO") {
      expect(screen.getByText("This interview is not available in this demo workspace. The workspace may have expired or the link may be incorrect.")).toBeVisible();
    } else {
      expect(screen.getByText("This interview is not available in this workspace. Check the link or choose another interview.")).toBeVisible();
      expect(within(screen.getByRole("main")).queryByText(/demo|expired|another account/i)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/belongs to|owned by/i)).not.toBeInTheDocument();
  });

  it.each(modes)("confirms preference saves using truthful $kind workspace language", async ({ kind }) => {
    server.use(http.patch(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json({
      ...testSettings, default_dashboard_range: "90d", version: 2,
    })));
    const { user } = renderApp("/settings", modeOptions(kind));
    await user.selectOptions(await screen.findByLabelText("Default dashboard range"), "90d");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    const saved = kind === "DEMO" ? "Preferences saved for this demo workspace." : kind === "PERSISTENT" ? "Preferences saved for your account workspace." : "Preferences saved for this local workspace.";
    expect(await screen.findByText(saved)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled();
    const page = within(screen.getByRole("main"));
    expect(page.queryByText(/durable|server-owned/i)).not.toBeInTheDocument();
    if (kind === "PERSISTENT") {
      expect(page.getByText(/Amazon Cognito manages sign-in, email confirmation, and password recovery/)).toBeVisible();
      expect(page.getByText(/staging database is disposable and does not guarantee backup or recovery/)).toBeVisible();
      expect(page.queryByText(/24-hour|expires automatically/)).not.toBeInTheDocument();
    }
    if (kind === "LOCAL") {
      expect(page.getByText(/This is not a real account login/)).toBeVisible();
      expect(page.queryByText(/Amazon Cognito|Retained across sign-outs/)).not.toBeInTheDocument();
    }
  });

  it("uses a public-entry title that includes both account and demo visitors", async () => {
    renderApp("/", { withSession: false });
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(document.title).toBe("Job application tracker · HireFlux"));
  });
});
