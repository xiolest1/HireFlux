import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductBenefitsSection } from "./ProductBenefitsSection";
import { benefitSignals } from "./benefitsModel";

describe("ProductBenefitsSection", () => {
  it("renders the seven compact benefit signals in semantic order", () => {
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

  it("uses one real static list without carousel or product-dashboard behavior", () => {
    const { container } = render(<ProductBenefitsSection />);
    const region = screen.getByRole("region", { name: "A clearer way through the search." });

    expect(container.querySelectorAll("[data-benefits-track]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-benefit-signal]")).toHaveLength(7);
    expect(within(region).getByRole("region", { name: "Benefit signals" })).toHaveAttribute("tabindex", "0");
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
});
