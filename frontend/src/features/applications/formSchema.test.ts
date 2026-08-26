import { describe, expect, it } from "vitest";
import {
  applicationCreateFormSchema,
  applicationFormSchema,
  currentDateInTimeZone,
  toCreateApplicationRequest,
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
  it("derives calendar defaults in the saved workspace time zone", () => {
    const instant = new Date("2026-08-21T02:00:00Z");

    expect(currentDateInTimeZone("America/New_York", instant)).toBe("2026-08-20");
    expect(currentDateInTimeZone("Asia/Tokyo", instant)).toBe("2026-08-21");
  });

  it("trims required fields and normalizes blank optional fields to null", () => {
    const result = applicationFormSchema().parse(baseInput);

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
    const result = applicationCreateFormSchema().safeParse({
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
    const result = applicationCreateFormSchema("2026-08-20").safeParse({
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
    const result = applicationCreateFormSchema().safeParse({
      ...baseInput,
      job_url: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });

  it("requires an applied date for Interviewing and omits it for Saved", () => {
    const missingDate = applicationCreateFormSchema().safeParse({
      ...baseInput,
      status: "INTERVIEW",
    });
    expect(missingDate.success).toBe(false);

    const saved = applicationCreateFormSchema().parse({
      ...baseInput,
      applied_date: "2026-08-20",
    });
    const request = toCreateApplicationRequest(saved);
    expect(request.applied_date).toBeNull();
    expect(request).not.toHaveProperty("follow_up_date");
    expect(request).not.toHaveProperty("role_family");
  });

  it("rejects lifecycle stages that are not valid creation choices", () => {
    expect(
      applicationCreateFormSchema().safeParse({
        ...baseInput,
        status: "OFFER",
        applied_date: "2026-08-20",
      }).success,
    ).toBe(false);
  });

});
