export type WorkspaceLifetime = "temporary" | "durable";

export function workspaceCapabilities(lifetime: WorkspaceLifetime) {
  return {
    temporary: lifetime === "temporary",
    showExpiry: lifetime === "temporary",
    canReset: lifetime === "temporary",
    canExportWorkspace: lifetime === "durable",
    showAccountSimulation: lifetime === "temporary",
    canManageAccount: false,
    canSignOut: false,
  } as const;
}
