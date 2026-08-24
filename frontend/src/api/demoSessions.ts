import { apiRequest } from "./client";
import { demoSessionSchema, type DemoSession } from "./schemas";

export function createDemoOperationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDemoSession(idempotencyKey: string): Promise<DemoSession> {
  return apiRequest("/api/v1/demo-sessions", demoSessionSchema, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
