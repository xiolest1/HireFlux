import { apiRequest } from "./client";
import { demoSessionSchema, type DemoSession } from "./schemas";
import type { SessionScope } from "../auth/sessionGeneration";

export function createDemoOperationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDemoSession(idempotencyKey: string, scope?: SessionScope): Promise<DemoSession> {
  return apiRequest("/api/v1/demo-sessions", demoSessionSchema, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    publicRequest: true,
    scope,
  });
}
