import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { makeAnalytics, makePipeline, testDashboard, testSettings, testUser } from "./fixtures";

export const API_ORIGIN = "http://localhost:8000";

export const server = setupServer(
  http.get(`${API_ORIGIN}/api/v1/me`, () => HttpResponse.json(testUser)),
  http.get(`${API_ORIGIN}/api/v1/settings`, () => HttpResponse.json(testSettings)),
  http.get(`${API_ORIGIN}/api/v1/dashboard`, ({ request }) =>
    HttpResponse.json({
      ...testDashboard,
      range: new URL(request.url).searchParams.get("range") ?? "30d",
    }),
  ),
  http.get(`${API_ORIGIN}/api/v1/analytics`, ({ request }) => {
    const range = new URL(request.url).searchParams.get("range");
    return HttpResponse.json(makeAnalytics(range === "90d" || range === "all" ? range : "30d"));
  }),
  http.get(`${API_ORIGIN}/api/v1/pipeline`, () => HttpResponse.json(makePipeline())),
  http.get(`${API_ORIGIN}/api/v1/interviews`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${API_ORIGIN}/api/v1/applications`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.post(`${API_ORIGIN}/api/v1/applications/duplicate-candidates`, () =>
    HttpResponse.json({ candidates: [] }),
  ),
  http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/activity`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes/preview`, () =>
    HttpResponse.json({ items: [], total_count: 0 }),
  ),
  http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/notes`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${API_ORIGIN}/api/v1/applications/:applicationId/interviews`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
);
