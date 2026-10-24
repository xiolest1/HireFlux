import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthConfiguration } from "../api/authConfiguration";
import { createQueryClient } from "../app/queryClient";
import { CognitoSessionAdapter } from "../auth/cognitoSessionAdapter";
import { WorkspaceSessionController } from "../auth/workspaceSessionController";
import { STAGING_COGNITO_ORIGIN } from "../securityHeaders";
import { renderApp } from "../test/renderApp";
import { getDemoSession } from "../auth/sessionStore";

const configuration: AuthConfiguration = {
  version: 1, environment: "test", capabilities: ["demo", "cognito"],
  account_data_policy: "local_development", account_management_enabled: true,
  cognito: { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY", client_id: "testonlypublicclient",
    domain: STAGING_COGNITO_ORIGIN, scopes: ["openid", "email", "profile"], self_registration_enabled: true },
};
afterEach(() => vi.unstubAllEnvs());

function landing(enabled = true, unavailable = false, readyDemo = false) {
  vi.stubEnv("VITE_WORKSPACE_MODE", "demo");
  const navigate = vi.fn();
  const controller = new WorkspaceSessionController(undefined, createQueryClient, {
    loadConfiguration: async () => {
      if (unavailable) throw new Error("Synthetic configuration failure");
      return { ...configuration, cognito: { ...configuration.cognito!, self_registration_enabled: enabled } };
    },
    navigateExternal: navigate,
    accountFactory: (config, failed, refreshing) => {
      const account = new CognitoSessionAdapter(config, failed, refreshing);
      vi.spyOn(account, "begin").mockImplementation(async (_scope, _return, _sensitive, entry) => config.domain + (entry === "signup" ? "/signup" : "/oauth2/authorize"));
      return account;
    },
  });
  return { ...renderApp("/", { withSession: readyDemo, controller }), navigate };
}

describe("integrated account and demo landing entry", () => {
  it("keeps demo primary, signup secondary and Sign In in the header", async () => {
    const { user, navigate } = landing();
    const signup = await screen.findByRole("button", { name: "Create Account" });
    const demo = screen.getAllByRole("button", { name: "Explore the Demo" })[0];
    expect(demo).toHaveClass("bg-accent");
    expect(signup).toHaveClass("bg-surface-raised");
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Sign In" })).toBeVisible();
    expect(screen.getByText(/Demo records do not transfer/)).toBeVisible();
    await user.click(signup);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(STAGING_COGNITO_ORIGIN + "/signup");
  });

  it("keeps header Sign In available when registration is closed", async () => {
    const { user, navigate } = landing(false);
    const button = await screen.findByRole("button", { name: "Sign In" });
    expect(screen.queryByRole("button", { name: "Create Account" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Explore the Demo" })[0]).toBeEnabled();
    button.focus(); expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(navigate).toHaveBeenCalledExactlyOnceWith(STAGING_COGNITO_ORIGIN + "/oauth2/authorize");
  });

  it("disables account entry on unverified configuration while keeping explicit demo and retry", async () => {
    landing(false, true);
    await waitFor(() => expect(screen.getByRole("region", { name: "Account configuration unavailable" })).toBeVisible());
    expect(screen.queryByRole("button", { name: "Create Account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign In" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Explore the Demo" })[0]).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retry account configuration" })).toBeEnabled();
  });

  it("keeps a ready demo clear and clears its cache before switching to signup", async () => {
    const { user, controller, navigate } = landing(true, false, true);
    expect((await screen.findAllByRole("button", { name: "Continue Demo" }))[0]).toBeVisible();
    const prior = controller.getSnapshot();
    prior.queryClient.setQueryData(["demo-only-fixture"], { fictional: true });
    expect(getDemoSession()).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(prior.scope.isCurrent()).toBe(false);
    expect(prior.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(getDemoSession()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(STAGING_COGNITO_ORIGIN + "/signup");
  });
});
