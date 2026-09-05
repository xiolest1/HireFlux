import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductBenefitsSection } from "./ProductBenefitsSection";
import { benefitSignals } from "./benefitsModel";
import { benefitStreamPixelsPerSecond } from "./useBenefitsStream";

function matchMedia(reducedMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProductBenefitsSection", () => {
  it("renders the seven compact benefit signals in semantic order", () => {
    matchMedia(true);
    const { container } = render(<ProductBenefitsSection />);

    const region = screen.getByRole("region", { name: "A clearer way through the search." });
    expect(within(region).getByText("Why HireFlux")).toBeVisible();

    const list = container.querySelector("ol");
    expect(list).not.toBeNull();
    const items = list ? within(list).getAllByRole("listitem") : [];
    const articles = within(region).getAllByRole("article");

    expect(items).toHaveLength(7);
    expect(articles).toHaveLength(7);

    benefitSignals.forEach((signal, index) => {
      expect(articles[index]).toHaveAttribute("data-benefit-signal", signal.id);
      expect(articles[index]).toHaveAttribute("data-benefit-width", signal.width);
      expect(articles[index].querySelector("[data-benefit-state]")).toHaveTextContent(signal.state);
      expect(within(articles[index]).getByRole("heading", { level: 3, name: signal.headline })).toBeVisible();
      expect(within(articles[index]).getByText(signal.support)).toBeVisible();
      expect(articles[index]).toHaveAccessibleName(signal.headline);
      expect(within(region).getAllByText(signal.headline)).toHaveLength(1);
      expect(within(region).getAllByText(signal.support)).toHaveLength(1);
    });
  });

  it("uses one real static list without carousel or product-dashboard behavior for reduced motion", () => {
    matchMedia(true);
    const { container } = render(<ProductBenefitsSection />);
    const region = screen.getByRole("region", { name: "A clearer way through the search." });

    expect(container.querySelectorAll("[data-benefits-track]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-benefit-signal]")).toHaveLength(7);
    expect(within(region).getByRole("region", { name: "Benefit signals" })).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("region", { name: "Benefit signals" })).toHaveAttribute("data-benefits-motion", "static");
    expect(within(region).getByRole("region", { name: "Benefit signals" })).not.toHaveClass("hf-benefits-edge-fade");
    expect(container.querySelector("[data-benefit-clone]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-benefit-visual]")).not.toBeInTheDocument();
    expect(within(region).queryByText("Illustrative product view")).not.toBeInTheDocument();
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    expect(container.querySelector('[role="carousel"]')).not.toBeInTheDocument();
    expect(container.querySelector('[role="tab"]')).not.toBeInTheDocument();
    expect(container.querySelector("[data-active-benefit]")).not.toBeInTheDocument();
  });

  it("keeps one semantic list while a hidden visual group supplies the ambient loop", () => {
    matchMedia(false);
    const { container } = render(<ProductBenefitsSection />);
    const viewport = screen.getByRole("region", { name: "Benefit signals" });

    expect(viewport).toHaveAttribute("data-benefits-motion", "ambient");
    expect(viewport).not.toHaveAttribute("tabindex");
    expect(viewport).toHaveClass("hf-benefits-edge-fade");
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("[data-benefit-signal]")).toHaveLength(7);
    expect(container.querySelectorAll("[data-benefit-clone]")).toHaveLength(7);
    expect(container.querySelector("[data-benefit-clone-group]")).toHaveAttribute("aria-hidden", "true");
    expect(within(viewport).getAllByRole("article")).toHaveLength(7);
    expect(container.querySelectorAll("[id^='benefit-signal-']")).toHaveLength(7);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    const controls = screen.getByRole("group", { name: "Benefit stream controls" });
    expect(within(controls).getAllByRole("button")).toHaveLength(3);
    expect(within(controls).getByRole("button", { name: "Previous benefit" })).toHaveAttribute(
      "aria-controls",
      "benefit-signals-viewport",
    );
    expect(within(controls).getByRole("button", { name: "Pause benefit stream" })).toBeEnabled();
    expect(within(controls).getByRole("button", { name: "Next benefit" })).toBeEnabled();
    expect(viewport.contains(controls)).toBe(false);
  });

  it("lets the user pause and explicitly resume ambient motion", () => {
    matchMedia(false);
    const { container } = render(<ProductBenefitsSection />);
    const track = container.querySelector("[data-benefits-track]");

    expect(track).toHaveAttribute("data-motion-state", "ambient");
    fireEvent.click(screen.getByRole("button", { name: "Pause benefit stream" }));
    expect(track).toHaveAttribute("data-motion-state", "paused");
    fireEvent.click(screen.getByRole("button", { name: "Play benefit stream" }));
    expect(track).toHaveAttribute("data-motion-state", "ambient");
  });

  it("derives exact translation and duration from the rendered real-group width", () => {
    matchMedia(false);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 126,
      height: 126,
      left: 0,
      right: 2240,
      top: 0,
      width: 2240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const { container } = render(<ProductBenefitsSection />);
    const track = container.querySelector<HTMLElement>("[data-benefits-track]");

    expect(track).toHaveAttribute("data-motion-ready", "true");
    expect(track).toHaveAttribute("data-loop-distance", "2240.000");
    expect(track).toHaveAttribute(
      "data-loop-duration",
      (2240 / benefitStreamPixelsPerSecond).toFixed(3),
    );
    expect(track?.style.getPropertyValue("--hf-benefits-loop-translation")).toBe("-2240px");
  });

  it("switches live motion-preference changes to a complete static fallback", () => {
    let reducedMotion = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return query === "(prefers-reduced-motion: reduce)" && reducedMotion;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        dispatchEvent: vi.fn(),
      })),
    );
    const { container } = render(<ProductBenefitsSection />);

    expect(container.querySelectorAll("[data-benefit-clone]")).toHaveLength(7);
    act(() => {
      reducedMotion = true;
      listeners.forEach((listener) => listener());
    });

    const viewport = screen.getByRole("region", { name: "Benefit signals" });
    expect(viewport).toHaveAttribute("data-benefits-motion", "static");
    expect(viewport).toHaveAttribute("tabindex", "0");
    expect(container.querySelectorAll("[data-benefit-signal]")).toHaveLength(7);
    expect(container.querySelector("[data-benefit-clone]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /benefit stream/i })).not.toBeInTheDocument();
    expect(container.querySelector("[data-benefits-track]")).not.toHaveAttribute("data-motion-ready");
  });

  it("coordinates passive visibility, document, and focus ownership and cleans up listeners", () => {
    matchMedia(false);
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const intersectionDisconnect = vi.fn();
    const intersectionObserve = vi.fn();
    const intersectionOptions: IntersectionObserverInit[] = [];
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        intersectionCallback = callback;
        intersectionOptions.push(options ?? {});
      }

      observe = intersectionObserve;
      unobserve = vi.fn();
      disconnect = intersectionDisconnect;
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "0px";
      thresholds = [0.5];
    }
    vi.stubGlobal(
      "IntersectionObserver",
      IntersectionObserverMock as unknown as typeof IntersectionObserver,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 126,
      height: 126,
      left: 0,
      right: 2240,
      top: 0,
      width: 2240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const removeListener = vi.spyOn(document, "removeEventListener");

    const { container, unmount } = render(<ProductBenefitsSection />);
    const track = container.querySelector("[data-benefits-track]");
    expect(intersectionOptions).toEqual([{ threshold: 0.5 }]);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: false, intersectionRatio: 0.49 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(track).toHaveAttribute("data-passively-blocked", "true");
    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true, intersectionRatio: 0.51 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(track).toHaveAttribute("data-passively-blocked", "false");

    const next = screen.getByRole("button", { name: "Next benefit" });
    fireEvent.focus(next);
    expect(track).toHaveAttribute("data-passively-blocked", "true");
    fireEvent.click(next);
    expect(track).toHaveAttribute("data-motion-state", "manual");
    fireEvent.click(screen.getByRole("button", { name: "Play benefit stream" }));
    expect(track).toHaveAttribute("data-motion-state", "ambient");
    expect(track).toHaveAttribute("data-passively-blocked", "false");

    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(track).toHaveAttribute("data-passively-blocked", "true");
    act(() => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(track).toHaveAttribute("data-passively-blocked", "false");

    unmount();
    expect(intersectionObserve).toHaveBeenCalledTimes(1);
    expect(intersectionDisconnect).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

});
