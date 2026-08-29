import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "./Toast";
import { useToast } from "./toastContext";

function ToastHarness() {
  const { showToast } = useToast();
  return <div><button onClick={() => showToast("Saved successfully")}>Success</button><button onClick={() => showToast("Could not save", { tone: "danger" })}>Danger</button></div>;
}

afterEach(() => vi.useRealTimers());

describe("toast feedback", () => {
  it("pauses dismissal while hovered and gives danger feedback a longer default", () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const success = screen.getByRole("status");
    fireEvent.mouseEnter(success);
    act(() => vi.advanceTimersByTime(5000));
    expect(success).toBeInTheDocument();
    fireEvent.mouseLeave(success);
    act(() => vi.advanceTimersByTime(4620));
    expect(screen.queryByText("Saved successfully")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Danger" }));
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
  });
});
