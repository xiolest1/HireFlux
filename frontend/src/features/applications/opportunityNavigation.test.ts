import { describe, expect, it } from "vitest";
import { makeApplication } from "../../test/fixtures";
import type { OpportunityWorkspaceItem } from "../../api/schemas";
import {
  applicationsRouteState,
  applicationsRouteStateWithoutIntent,
  readApplicationsRouteState,
} from "./opportunityNavigation";
import {
  flatOpportunitySupportingText,
  opportunityActionText,
  opportunitySupportingText,
} from "./opportunityPresentation";

function opportunity(
  overrides: Partial<OpportunityWorkspaceItem["classification"]> = {},
): OpportunityWorkspaceItem {
  return {
    application: makeApplication(),
    classification: {
      group: "needs_action",
      reason_code: "CANDIDATE_ACTION_UPCOMING",
      relevant_date: "2026-08-29",
      relevant_at: null,
      action_type: "OPEN_OPPORTUNITY",
      interview_id: null,
      next_interview: null,
      ...overrides,
    },
  };
}

describe("Applications opportunity navigation", () => {
  it("accepts only local Applications origins and known one-shot intents", () => {
    const valid = applicationsRouteState(
      "/applications",
      "?view=ACTIVE&q=platform",
      "RUN_PRIMARY_ACTION",
    );
    expect(readApplicationsRouteState(valid)).toEqual(valid.applicationsOrigin);
    expect(
      readApplicationsRouteState({
        applicationsOrigin: { returnTo: "https://example.com/applications" },
      }),
    ).toBeNull();
    expect(
      readApplicationsRouteState({
        applicationsOrigin: { returnTo: "/applications-unsafe" },
      }),
    ).toBeNull();
    expect(
      readApplicationsRouteState({
        applicationsOrigin: { returnTo: "/applications", intent: "REPLAY" },
      }),
    ).toBeNull();
  });

  it("removes a consumed intent while preserving the exact return URL", () => {
    expect(
      applicationsRouteStateWithoutIntent({
        returnTo: "/applications?view=ACTIVE&source=REFERRAL",
        intent: "RUN_PRIMARY_ACTION",
      }),
    ).toEqual({
      applicationsOrigin: {
        returnTo: "/applications?view=ACTIVE&source=REFERRAL",
      },
    });
  });
});

describe("opportunity presentation", () => {
  it("uses reason-specific candidate action labels and attention timing", () => {
    expect(opportunityActionText(opportunity())).toBe("Review next action");
    expect(opportunitySupportingText(opportunity(), "UTC")).toBe(
      "Planned for Aug 29, 2026",
    );
    expect(
      opportunityActionText(
        opportunity({
          reason_code: "CANDIDATE_ACTION_UNSCHEDULED",
          relevant_date: null,
        }),
      ),
    ).toBe("Plan next action");
  });

  it("applies the flat supporting-context precedence", () => {
    expect(
      flatOpportunitySupportingText(
        makeApplication({
          next_step_responsibility: "CANDIDATE",
          next_step_note: "Send portfolio",
          follow_up_date: "2026-08-30",
        }),
      ),
    ).toBe("Send portfolio");
    expect(
      flatOpportunitySupportingText(
        makeApplication({
          next_step_responsibility: "EMPLOYER",
          follow_up_date: "2026-08-30",
        }),
      ),
    ).toBe("Check back · Aug 30, 2026");
    expect(
      flatOpportunitySupportingText(
        makeApplication({ status: "DRAFT", applied_date: null }),
      ),
    ).toBe("Draft");
  });
});
