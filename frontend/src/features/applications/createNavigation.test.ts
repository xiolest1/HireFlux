import { describe, expect, it } from "vitest";
import {
  applicationCreateRouteState,
  readApplicationCreatedRouteState,
  readApplicationCreateRouteState,
} from "./createNavigation";

describe("application creation route state", () => {
  it("preserves a safe originating query string", () => {
    const state = applicationCreateRouteState(
      "applications",
      "/applications",
      "?view=active&layout=list&status=INTERVIEW",
    );

    expect(readApplicationCreateRouteState(state)).toEqual(state);
  });

  it("rejects malformed and lookalike return locations", () => {
    expect(
      readApplicationCreateRouteState({
        origin: "applications",
        returnTo: "/applications-evil?view=all",
      }),
    ).toBeNull();
    expect(
      readApplicationCreateRouteState({
        origin: "dashboard",
        returnTo: "/applications",
      }),
    ).toBeNull();
    expect(readApplicationCreateRouteState(null)).toBeNull();
  });

  it("accepts only complete post-creation summaries", () => {
    const state = {
      notice: "Added.",
      createdApplicationId: "11111111-1111-4111-8111-111111111111",
      createdCompanyName: "Acme",
      createdJobTitle: "Engineer",
    };

    expect(readApplicationCreatedRouteState(state)).toEqual(state);
    expect(
      readApplicationCreatedRouteState({ ...state, createdJobTitle: undefined }),
    ).toBeNull();
  });
});
