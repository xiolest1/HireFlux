import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { testUser } from "./fixtures";

export const API_ORIGIN = "http://localhost:8000";

export const server = setupServer(
  http.get(`${API_ORIGIN}/api/v1/me`, () => HttpResponse.json(testUser)),
  http.get(`${API_ORIGIN}/api/v1/applications`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/activity`, () =>
    HttpResponse.json({ items: [] }),
  ),
);
