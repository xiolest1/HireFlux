import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollapsibleRegion } from "./Motion";
import { usePresence } from "./motionHooks";

function setReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function PresenceHarness() {
  const [open, setOpen] = useState(true);
  const presence = usePresence(open);
  return <><button onClick={() => setOpen(false)}>Close</button>{presence.mounted ? <div data-testid="surface" data-state={presence.state} /> : null}</>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("motion primitives", () => {
  it("keeps closed collapsible content inert and hidden from assistive technology", () => {
    render(<CollapsibleRegion open={false}><button>Closed action</button></CollapsibleRegion>);
    const region = screen.getByText("Closed action", { selector: "button" }).closest(".hf-collapsible");
    expect(region).toHaveAttribute("aria-hidden", "true");
    expect(region).toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: "Closed action" })).not.toBeInTheDocument();
  });

  it("retains an exiting surface briefly", () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    render(<PresenceHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByTestId("surface")).toHaveAttribute("data-state", "closed");
    act(() => vi.advanceTimersByTime(140));
    expect(screen.queryByTestId("surface")).not.toBeInTheDocument();
  });

  it("resolves exit presence immediately for reduced motion", () => {
    setReducedMotion(true);
    render(<PresenceHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("surface")).not.toBeInTheDocument();
  });
});
