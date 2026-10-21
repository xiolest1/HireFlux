import { z } from "zod";
import { apiRequest } from "./client";
import { workspaceExportSchema } from "./schemas";
import type { SessionScope } from "../auth/sessionGeneration";

export const deletionStatusSchema = z.strictObject({
  state: z.enum(["ACTIVE", "DELETING", "DELETED"]),
  deletion_started_at: z.iso.datetime({ offset: true }).nullable(),
  deletion_completed_at: z.iso.datetime({ offset: true }).nullable(),
  retryable_failure: z.boolean(),
  provider_finalization: z.enum(["PENDING", "COMPLETE", "REVIEW_REQUIRED"]).optional(),
  provider_finalized_at: z.iso.datetime({ offset: true }).optional(),
}).superRefine((value, ctx) => {
  if ((value.provider_finalization && value.state !== "DELETED")
    || (value.state === "DELETED" && (!value.deletion_started_at || !value.deletion_completed_at))
    || ((value.provider_finalization === "COMPLETE") !== Boolean(value.provider_finalized_at))) {
    ctx.addIssue({ code: "custom", message: "Account deletion progress could not be verified." });
  }
});
export type AccountDeletionStatus = z.infer<typeof deletionStatusSchema>;
export function deleteAccount(scope: SessionScope) {
  return apiRequest("/api/v1/me", deletionStatusSchema, { scope, method: "DELETE", json: { confirmation: "DELETE_MY_ACCOUNT" } });
}
export function exportAccount(scope: SessionScope) { return apiRequest("/api/v1/me/export", workspaceExportSchema, { scope }); }
export function getAccountDeletionStatus(scope: SessionScope) { return apiRequest("/api/v1/me/deletion", deletionStatusSchema, { scope }); }
