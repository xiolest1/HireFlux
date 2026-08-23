import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";

describe("AppLayout", () => {
  it("persists the desktop sidebar choice and announces the active route", async () => {
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(document.title).toBe("Home · HireFlux");
    expect(screen.getByText("Home page loaded")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("hireflux-sidebar-collapsed")).toBe("true");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });

  it("exposes secondary destinations in the mobile More sheet", async () => {
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();

    const trigger = screen.getByRole("button", { name: "More navigation" });
    await user.click(trigger);
    const sheet = screen.getByRole("dialog", { name: "Workspace" });
    expect(within(sheet).getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(within(sheet).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(sheet).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("opens the labeled tablet navigation drawer and restores focus", async () => {
    const { user } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(drawer).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(drawer).getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/analytics",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawer).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
