import { describe, expect, it } from "vitest";
import {
  applicationFormDefaults,
  applicationFormSchema,
  preferredFollowUpDate,
} from "./formSchema";

const baseInput = {
  company_name: "  Northstar Labs  ",
  job_title: " Frontend Engineer ",
  status: "DRAFT" as const,
  applied_date: "",
  follow_up_date: "",
  job_url: "",
  location: "",
  work_mode: "" as const,
  source: "",
  source_detail: "",
  salary_text: "",
  description: "",
};

describe("applicationFormSchema", () => {
  it("trims required fields and normalizes blank optional fields to null", () => {
    const result = applicationFormSchema("create").parse(baseInput);

    expect(result).toMatchObject({
      company_name: "Northstar Labs",
      job_title: "Frontend Engineer",
      applied_date: null,
      follow_up_date: null,
      job_url: null,
      location: null,
      work_mode: null,
    });
  });

  it("requires an applied date when a new application starts as Applied", () => {
    const result = applicationFormSchema("create").safeParse({
      ...baseInput,
      status: "APPLIED",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["applied_date"] }),
        ]),
      );
    }
  });

  it("rejects an applied date after the workspace current date", () => {
    const result = applicationFormSchema("create", "2026-08-20").safeParse({
      ...baseInput,
      status: "APPLIED",
      applied_date: "2026-08-21",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["applied_date"],
            message: "Applied date cannot be in the future.",
          }),
        ]),
      );
    }
  });

  it("rejects non-http job URLs", () => {
    const result = applicationFormSchema("create").safeParse({
      ...baseInput,
      job_url: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });

  it("defaults a new follow-up using the workspace calendar and interval", () => {
    const preferences = {
      defaultFollowUpDays: 7,
      timeZone: "America/Los_Angeles",
      now: new Date("2026-08-13T02:30:00Z"),
    };

    expect(preferredFollowUpDate(preferences)).toBe("2026-08-19");
    expect(applicationFormDefaults(undefined, preferences).follow_up_date).toBe(
      "2026-08-19",
    );
  });
});
