import { describe, expect, it } from "vitest";
import { applicationFormSchema } from "./formSchema";

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

  it("rejects non-http job URLs", () => {
    const result = applicationFormSchema("create").safeParse({
      ...baseInput,
      job_url: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });
});
