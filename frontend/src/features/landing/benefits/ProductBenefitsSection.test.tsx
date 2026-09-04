import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductBenefitsSection } from "./ProductBenefitsSection";
import { productBenefits } from "./benefitsModel";

describe("ProductBenefitsSection", () => {
  it("renders the four candidate benefits in semantic order", () => {
    const { container } = render(<ProductBenefitsSection />);

    const region = screen.getByRole("region", { name: "More than tracking applications." });
    expect(within(region).getByText("Why HireFlux")).toBeVisible();

    const list = container.querySelector("ol");
    expect(list).not.toBeNull();
    const items = list ? within(list).getAllByRole("listitem") : [];
    const articles = within(region).getAllByRole("article");

    expect(items).toHaveLength(4);
    expect(articles).toHaveLength(4);

    productBenefits.forEach((benefit, index) => {
      expect(articles[index].querySelector("[data-benefit-category]")).toHaveTextContent(benefit.category);
      expect(within(articles[index]).getByRole("heading", { level: 3, name: benefit.headline })).toBeVisible();
      expect(within(articles[index]).getByText(benefit.body)).toBeVisible();
      expect(articles[index]).toHaveAccessibleName(benefit.headline);
    });
  });

  it("keeps illustrative product evidence decorative and introduces no rail behavior", () => {
    const { container } = render(<ProductBenefitsSection />);
    const region = screen.getByRole("region", { name: "More than tracking applications." });

    expect(container.querySelectorAll('[data-benefit-visual][aria-hidden="true"]')).toHaveLength(4);
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    expect(container.querySelector('[role="tab"]')).not.toBeInTheDocument();
    expect(container.querySelector("[data-active-benefit]")).not.toBeInTheDocument();
  });
});
