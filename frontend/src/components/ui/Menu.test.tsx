import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Menu } from "./Menu";

describe("Menu", () => {
  it("focuses and navigates menu items, then restores focus on Escape", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(<MemoryRouter><Menu label="More actions" trigger={<span>More</span>} items={[
      { label: "First", onSelect: select },
      { label: "Second", onSelect: select },
      { label: "Last", href: "/last" },
    ]} /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Second" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Last" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
