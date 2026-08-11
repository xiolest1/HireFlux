import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getDemoSession, saveDemoSession } from "../auth/sessionStore";
import { apiRequest } from "./client";
import { API_ORIGIN, server } from "../test/server";

describe("apiRequest", () => {
  it("maps the API error envelope to ApiError", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/test-error`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VERSION_CONFLICT",
              message: "This application changed in another request.",
              request_id: "request-123",
            },
          },
          { status: 409 },
        ),
      ),
    );

    await expect(
      apiRequest("/api/v1/test-error", z.object({ ok: z.boolean() })),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
      requestId: "request-123",
    });
  });

  it("rejects a successful response that violates its schema", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/v1/test-invalid`, () =>
        HttpResponse.json({ ok: "not-a-boolean" }),
      ),
    );

    await expect(
      apiRequest("/api/v1/test-invalid", z.object({ ok: z.boolean() })),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it("clears an expired session after the API rejects it", async () => {
    saveDemoSession({
      access_token: "expired.demo.session.token.value.123456",
      token_type: "Bearer",
      expires_at: "2099-08-12T12:00:00Z",
    });
    server.use(
      http.get(`${API_ORIGIN}/api/v1/expired`, () =>
        HttpResponse.json(
          {
            error: {
              code: "DEMO_SESSION_EXPIRED",
              message: "Your demo workspace has expired.",
              request_id: "request-expired",
            },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(
      apiRequest("/api/v1/expired", z.object({ ok: z.boolean() })),
    ).rejects.toMatchObject({ code: "DEMO_SESSION_EXPIRED", status: 401 });
    expect(getDemoSession()).toBeNull();
  });
});
