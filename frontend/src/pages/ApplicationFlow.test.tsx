import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, server } from "../test/server";
import { makeApplication, makeActivity } from "../test/fixtures";
import { renderApp } from "../test/renderApp";

describe("application critical flow", () => {
  it("validates and creates an applied application without client-owned fields", async () => {
    let postedBody: Record<string, unknown> | null = null;
    let postCount = 0;
    server.use(
      http.post(`${API_ORIGIN}/api/v1/applications`, async ({ request }) => {
        postCount += 1;
        postedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeApplication({
            company_name: String(postedBody.company_name),
            job_title: String(postedBody.job_title),
            status: "APPLIED",
            applied_date: String(postedBody.applied_date),
          }),
          { status: 201 },
        );
      }),
      http.get(
        `${API_ORIGIN}/api/v1/applications/:applicationId/activity`,
        () => HttpResponse.json({ items: [makeActivity()] }),
      ),
    );

    const { user } = renderApp();
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeVisible();

    await user.click(screen.getByRole("link", { name: "New application" }));
    await user.click(screen.getByRole("button", { name: "Create application" }));

    expect(await screen.findByText("Company name is required.")).toBeVisible();
    expect(screen.getByText("Job title is required.")).toBeVisible();
    expect(postCount).toBe(0);

    await user.type(screen.getByLabelText(/Company name/), "Beacon Works");
    await user.type(screen.getByLabelText(/Job title/), "Product Engineer");
    await user.selectOptions(screen.getByLabelText("Starting status"), "APPLIED");
    await user.click(screen.getByRole("button", { name: "Create application" }));

    expect(
      await screen.findByText("Applied date is required for an applied application."),
    ).toBeVisible();
    expect(postCount).toBe(0);

    await user.type(screen.getByLabelText(/Applied date/), "2026-08-09");
    await user.click(screen.getByRole("button", { name: "Create application" }));

    expect(
      await screen.findByRole("heading", { name: "Product Engineer" }),
    ).toBeVisible();
    expect(screen.getByText("Application created.")).toBeVisible();
    expect(postCount).toBe(1);
    expect(postedBody).toMatchObject({
      company_name: "Beacon Works",
      job_title: "Product Engineer",
      status: "APPLIED",
      applied_date: "2026-08-09",
      follow_up_date: null,
      work_mode: null,
    });
    expect(postedBody).not.toHaveProperty("owner_user_id");
    expect(postedBody).not.toHaveProperty("version");
  });

  it("edits details with the current version and never sends status", async () => {
    const application = makeApplication({ version: 7 });
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/applications/:applicationId`, () =>
        HttpResponse.json(application),
      ),
      http.patch(
        `${API_ORIGIN}/api/v1/applications/:applicationId`,
        async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeApplication({
              company_name: String(patchBody.company_name),
              version: 8,
            }),
          );
        },
      ),
    );

    const { user } = renderApp(
      "/applications/11111111-1111-4111-8111-111111111111/edit",
    );
    const companyInput = await screen.findByLabelText(/Company name/);
    await user.clear(companyInput);
    await user.type(companyInput, "Updated Company");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Application details updated.")).toBeVisible();
    expect(screen.getByText("Updated Company")).toBeVisible();
    expect(patchBody).toMatchObject({
      company_name: "Updated Company",
      expected_version: 7,
    });
    expect(patchBody).not.toHaveProperty("status");
    expect(patchBody).not.toHaveProperty("owner_user_id");
  });
});
