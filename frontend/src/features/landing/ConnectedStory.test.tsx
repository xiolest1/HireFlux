import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectedStoryA } from "./ConnectedStoryA";
import { ConnectedStoryC } from "./ConnectedStoryC";

const questions = [
  "How do I keep every opportunity in view?",
  "What should carry into the interview?",
  "How does that context help me prepare?",
  "What deserves attention next?",
];

describe.each([
  ["A", ConnectedStoryA],
  ["C", ConnectedStoryC],
] as const)("ConnectedStory%s", (_, Story) => {
  it("provides one complete native-flow semantic story without a motion lifecycle", () => {
    const { container } = render(<Story />);
    expect(container.querySelectorAll("[data-connected-chapter]")).toHaveLength(4);
    questions.forEach((question) => expect(screen.getByText(question)).toBeInTheDocument());
    expect(container.querySelectorAll("[data-connected-product-surface]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-connected-lineage]")).toHaveLength(3);
    expect(container.querySelector("[data-connected-j3]")).not.toBeInTheDocument();
    expect(container.querySelector(".pin-spacer")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
