import { z } from "zod";
import { ApiError } from "../api/client";
import { COGNITO_SENSITIVE_INTENT_KEY, type CognitoSessionStore } from "./cognitoSessionStore";
import type { SessionScope } from "./sessionGeneration";

const intentSchema = z.strictObject({
  id: z.uuid(), operation: z.enum(["export", "delete"]), subject: z.string().min(1).max(128),
  issuer: z.string(), clientId: z.string(), originalGeneration: z.number().int().positive(),
  createdAt: z.number().int().positive(), epoch: z.string(), instanceId: z.string(),
  confirmed: z.boolean(),
});
export type SensitiveIntent = z.infer<typeof intentSchema>;
export type SensitiveOperation = SensitiveIntent["operation"];
export function invalidIntent(): ApiError { return new ApiError("SENSITIVE_INTENT_INVALID", "This account action expired or was canceled. Verify your identity again; no action was resumed."); }

export function storeSensitiveIntent(intent: SensitiveIntent, store: CognitoSessionStore, scope: SessionScope): void {
  const guard = store.capture(scope);
  store.assertCurrent(guard);
  if (intent.epoch !== guard.epoch || intent.instanceId !== guard.instanceId) throw invalidIntent();
  try { window.sessionStorage.setItem(COGNITO_SENSITIVE_INTENT_KEY, JSON.stringify(intent)); }
  catch { throw invalidIntent(); }
}

export function readSensitiveIntent(store: CognitoSessionStore, config: { issuer: string; client_id: string }): SensitiveIntent | undefined {
  let raw: string | null;
  try { raw = window.sessionStorage.getItem(COGNITO_SENSITIVE_INTENT_KEY); } catch { throw invalidIntent(); }
  if (!raw) return;
  try {
    if (raw.length > 2048) throw invalidIntent();
    const value = intentSchema.parse(JSON.parse(raw));
    if (value.issuer !== config.issuer || value.clientId !== config.client_id || value.epoch !== store.epoch
      || value.instanceId !== store.instanceId || value.createdAt > Date.now() || Date.now() - value.createdAt > 300_000
      || (value.operation === "delete" && !value.confirmed)) throw invalidIntent();
    return value;
  } catch { throw invalidIntent(); }
}

export function consumeSensitiveIntent(intent: SensitiveIntent, operation: SensitiveOperation, store: CognitoSessionStore,
  config: { issuer: string; client_id: string }, scope: SessionScope, subject: string | undefined): void {
  scope.assertCurrent();
  const value = readSensitiveIntent(store, config);
  if (!value || value.id !== intent.id || value.operation !== operation || value.subject !== subject) throw invalidIntent();
  try { window.sessionStorage.removeItem(COGNITO_SENSITIVE_INTENT_KEY); }
  catch { throw invalidIntent(); }
  scope.assertCurrent();
}
