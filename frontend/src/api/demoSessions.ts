import { apiRequest } from "./client";
import { demoSessionSchema, type DemoSession } from "./schemas";

export function createDemoSession(): Promise<DemoSession> {
  return apiRequest("/api/v1/demo-sessions", demoSessionSchema, {
    method: "POST",
  });
}
