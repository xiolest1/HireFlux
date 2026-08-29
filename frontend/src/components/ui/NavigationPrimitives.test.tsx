import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Drawer } from "./Drawer";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";
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
  it("exposes semantic surface roles without forcing elevation", () => {
    render(
      <>
        <Surface aria-label="Standard group">Standard</Surface>
        <Surface aria-label="Interactive group" tone="interactive">Interactive</Surface>
        <Surface aria-label="Raised group" tone="raised">Raised</Surface>
      </>,
    );

    expect(screen.getByLabelText("Standard group")).toHaveClass("border-line", "bg-surface");
    expect(screen.getByLabelText("Standard group")).not.toHaveClass("border-line-subtle");
    expect(screen.getByLabelText("Standard group")).not.toHaveClass("shadow-panel");
    expect(screen.getByLabelText("Interactive group")).toHaveClass("bg-surface", "hover:bg-surface-hover");
    expect(screen.getByLabelText("Raised group")).toHaveClass("shadow-panel");
  });

  it("renders lifecycle status with a semantic text label", () => {
    render(<StatusBadge status="APPLIED" />);
    expect(screen.getByText("Applied")).toHaveClass(
      "border-info/40",
      "bg-info-soft",
      "text-info",
      "dark:border-info/25",
    );
  });

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
