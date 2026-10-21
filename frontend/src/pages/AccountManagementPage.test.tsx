import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AccountDeletionStatus } from "../api/accountLifecycle";
import { AccountManagementPage } from "./AccountManagementPage";

let deletion: AccountDeletionStatus;
vi.mock("../auth/workspaceSessionContext", () => ({
  useWorkspaceSession: () => ({
    state: { status: "account-management", intent: { operation: "delete" }, consumed: true, deletion },
    controller: { authenticationConfiguration: { account_management_enabled: false } },
  }),
}));

describe("truthful account erasure progress", () => {
  it("does not claim erasure after an unknown request left the workspace ACTIVE", () => {
    deletion = { state: "ACTIVE", deletion_started_at: null, deletion_completed_at: null, retryable_failure: false };
    render(<MemoryRouter><AccountManagementPage /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("Workspace erasure has not started");
    expect(screen.queryByText(/Live HireFlux records were erased/)).not.toBeInTheDocument();
  });

  it.each([false, true])("distinguishes pending finalization from an explicit rejection: %s", (rejected) => {
    deletion = { state: "DELETED", deletion_started_at: "2026-10-20T00:00:00Z",
      deletion_completed_at: "2026-10-20T00:00:01Z", provider_finalization: "PENDING", retryable_failure: rejected };
    render(<MemoryRouter><AccountManagementPage /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent(rejected ? "provider explicitly rejected" : "Identity removal is not complete");
    if (!rejected) expect(screen.queryByText(/provider explicitly rejected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/identity removal was confirmed/)).not.toBeInTheDocument();
  });
});
