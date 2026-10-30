import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("shared danger-button interaction", () => {
  it("retains keyboard activation and the native disabled/pending boundary", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const { rerender } = render(<Button variant="danger" onClick={action}>Archive opportunity</Button>);
    const button = screen.getByRole("button", { name: "Archive opportunity" });
    expect(button).toHaveClass("text-danger-contrast", "focus-visible:outline-3", "focus-visible:outline-focus");
    expect(button).not.toHaveClass("text-white");
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledTimes(1);

    rerender(<Button variant="danger" disabled onClick={action}>Archiving…</Button>);
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled:bg-surface-muted", "disabled:text-ink-disabled", "disabled:border-line-subtle");
    await user.click(button);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
