export type WorkspaceLifetime = "temporary" | "durable";

export function workspaceCapabilities(lifetime: WorkspaceLifetime, identityKind?: "LOCAL" | "DEMO" | "PERSISTENT") {
  return {
    temporary: lifetime === "temporary",
    showExpiry: lifetime === "temporary",
    canReset: lifetime === "temporary",
    canExportWorkspace: lifetime === "durable",
    showAccountSimulation: lifetime === "temporary",
    canManageAccount: false,
    canSignOut: identityKind === "PERSISTENT",
  } as const;
}
