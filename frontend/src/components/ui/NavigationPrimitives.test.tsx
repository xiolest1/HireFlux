import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Drawer } from "./Drawer";
import { Tabs } from "./Tabs";

function TabsHarness() {
  const [value, setValue] = useState("overview");
  return (
    <Tabs
      ariaLabel="Application sections"
      value={value}
      onValueChange={setValue}
      items={[
        { value: "overview", label: "Overview" },
        { value: "notes", label: "Notes" },
        { value: "activity", label: "Activity" },
      ]}
    />
  );
}

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open filters
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Filters">
        <button type="button">Apply filters</button>
      </Drawer>
    </>
  );
}

describe("navigation primitives", () => {
  it("moves and selects tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TabsHarness />
      </MemoryRouter>,
    );

    const overview = screen.getByRole("tab", { name: "Overview" });
    await user.click(overview);
    await user.keyboard("{ArrowRight}");

    const notes = screen.getByRole("tab", { name: "Notes" });
    expect(notes).toHaveFocus();
    expect(notes).toHaveAttribute("aria-selected", "true");
  });

  it("contains drawer focus, closes on Escape, and restores the trigger", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);

    const trigger = screen.getByRole("button", { name: "Open filters" });
    await user.click(trigger);

    const drawer = screen.getByRole("dialog", { name: "Filters" });
    const close = screen.getByRole("button", { name: "Close panel" });
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Apply filters" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(drawer).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
