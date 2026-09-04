import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoTrustStrip } from "./DemoTrustStrip";

const expectedItems = [
  ["Isolated by design", "Every visitor receives a separate temporary workspace."],
  ["Ready to explore", "Follow one coherent workflow across applications, interviews, notes, and analytics."],
  ["Safe to experiment", "Edit, archive, restore, or reset without affecting anyone else."],
] as const;

describe("DemoTrustStrip", () => {
  it("preserves the three demo guarantees in document order", () => {
    render(<DemoTrustStrip />);

    const region = screen.getByRole("region", { name: "Demo guarantees" });
    const articles = within(region).getAllByRole("article");

    expect(articles).toHaveLength(3);
    expectedItems.forEach(([title, description], index) => {
      expect(within(articles[index]).getByRole("heading", { level: 2 })).toHaveTextContent(title);
      expect(within(articles[index]).getByText(description)).toBeVisible();
    });
  });

  it("keeps icons decorative and introduces no interaction or announcements", () => {
    const { container } = render(<DemoTrustStrip />);
    const region = screen.getByRole("region", { name: "Demo guarantees" });

    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });
});
