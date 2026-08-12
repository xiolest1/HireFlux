import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("uses dark mode by default", () => {
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeVisible();
  });

  it("switches themes and persists the visitor's choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(window.localStorage.getItem("hireflux-color-theme")).toBe("light");
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeVisible();
  });

  it("restores a saved light theme", () => {
    window.localStorage.setItem("hireflux-color-theme", "light");

    render(<ThemeToggle />);

    expect(document.documentElement).not.toHaveClass("dark");
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeVisible();
  });
});
