import { fireEvent, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Application, Pipeline } from "../../api/schemas";
import { makeApplication, makePipeline } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";
import { API_ORIGIN, server } from "../../test/server";

function pipelineWithCard(application: Application): Pipeline {
  const pipeline = makePipeline();
  return {
    ...pipeline,
    lanes: pipeline.lanes.map((lane) => lane.status === application.status ? {
      ...lane,
      count: 1,
      cards: [{
        application,
        stage_age_days: application.status === "DRAFT" ? null : 4,
        follow_up_state: "UPCOMING",
      }],
    } : { ...lane, count: 0, cards: [] }),
  };
}

describe("Pipeline board", () => {
  it("uses the server-owned pipeline response and keeps reporting controls out of the workflow tab", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/analytics`, () => HttpResponse.error()),
      http.get(`${API_ORIGIN}/api/v1/pipeline`, () => HttpResponse.json(makePipeline())),
    );

    renderApp("/analytics?section=pipeline");

    expect(await screen.findByRole("heading", { name: "Manage your application pipeline" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Filters" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Date range")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archived Applications" })).toHaveAttribute(
      "href",
      "/applications?view=ARCHIVED",
    );
  });

  it("moves an application only after a keyboard-accessible confirmation", async () => {
    const application = makeApplication({
      version: 4,
      allowed_transitions: ["DRAFT", "SCREENING", "INTERVIEW", "ARCHIVED"],
    });
    let body: unknown;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/pipeline`, () => HttpResponse.json(pipelineWithCard(application))),
      http.post(`${API_ORIGIN}/api/v1/applications/${application.application_id}/status`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...application, status: "SCREENING", version: 5 });
      }),
    );

    const { user } = renderApp("/analytics?section=pipeline");
    expect((await screen.findAllByText(application.company_name))[0]).toBeVisible();
    const moveButton = screen.getAllByRole("button", { name: "Move…" })[0];
    moveButton.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Move application" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("New stage"), "SCREENING");
    expect(screen.getByText(/The change is saved only after you confirm and the server validates/)).toBeVisible();
    expect(screen.queryByRole("option", { name: "Archived" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move to Screening" }));
    expect(await screen.findByText("Status changed to Screening.")).toBeVisible();
    expect(body).toEqual({ status: "SCREENING", expected_version: 4 });
  });

  it("requires an applied date before a draft can enter the active workflow", async () => {
    const draft = makeApplication({
      status: "DRAFT",
      applied_date: null,
      submitted_at: null,
      stage_entered_at: null,
      allowed_transitions: ["APPLIED", "ARCHIVED"],
    });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/pipeline`, () => HttpResponse.json(pipelineWithCard(draft))),
    );

    const { user } = renderApp("/analytics?section=pipeline");
    await screen.findAllByText(draft.company_name);
    await user.click(screen.getAllByRole("button", { name: "Move…" })[0]);
    await user.selectOptions(screen.getByLabelText("New stage"), "APPLIED");
    expect(screen.getByLabelText(/Applied date/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Move to Applied" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Applied date/), {
      target: { value: "2026-08-24" },
    });
    expect(screen.getByRole("button", { name: "Move to Applied" })).toBeEnabled();
  });

  it("supports an explicit applied-to-draft correction without sending an applied date", async () => {
    const application = makeApplication({
      status: "APPLIED",
      version: 6,
      allowed_transitions: ["DRAFT", "SCREENING", "ARCHIVED"],
    });
    let body: unknown;
    server.use(
      http.get(`${API_ORIGIN}/api/v1/pipeline`, () => HttpResponse.json(pipelineWithCard(application))),
      http.post(`${API_ORIGIN}/api/v1/applications/${application.application_id}/status`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          ...application,
          status: "DRAFT",
          applied_date: null,
          version: 7,
          allowed_transitions: ["APPLIED", "ARCHIVED"],
        });
      }),
    );

    const { user } = renderApp("/analytics?section=pipeline");
    await screen.findAllByText(application.company_name);
    await user.click(screen.getAllByRole("button", { name: "Move…" })[0]);
    await user.selectOptions(screen.getByLabelText("New stage"), "DRAFT");
    expect(await screen.findByRole("dialog", { name: "Confirm correction" })).toBeVisible();
    expect(screen.getByText(/clears the applied date and returns the opportunity to Draft/i)).toBeVisible();
    expect(screen.queryByLabelText(/Applied date/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Correct to Draft" }));
    expect(await screen.findByText("Application corrected to Draft.")).toBeVisible();
    expect(body).toEqual({ status: "DRAFT", expected_version: 6 });
  });
});
