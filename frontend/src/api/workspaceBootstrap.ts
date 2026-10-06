// Durable initialization is separate from ordinary dashboard/analytics access.
import { z } from "zod";
import { apiRequest } from "./client";
import { settingsSchema, userSchema } from "./schemas";
import type { SessionScope } from "../auth/sessionGeneration";

export const workspaceBootstrapSchema = z.object({
  state: z.literal("ACTIVE"),
  identity_kind: z.enum(["LOCAL", "PERSISTENT"]),
  bootstrap_version: z.literal(1),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  profile: userSchema.extend({ user_id: z.string().uuid() }),
  settings: settingsSchema.extend({
    time_zone: z.string().refine((zone) => {
      if (/^[+-]/.test(zone)) return false;
      try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return true; } catch { return false; }
    }),
  }),
}).refine((value) => Date.parse(value.updated_at) >= Date.parse(value.created_at));

export type WorkspaceBootstrap = z.infer<typeof workspaceBootstrapSchema>;

export function bootstrapWorkspace(scope: SessionScope): Promise<WorkspaceBootstrap> {
  return apiRequest("/api/v1/me/bootstrap", workspaceBootstrapSchema, {
    method: "POST", json: {}, scope,
  });
}
