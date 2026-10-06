import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useWorkspaceSession } from "./workspaceSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, LoadingState } from "../components/ui/Feedback";

import { safeWorkspaceReturnPath } from "./workspaceReturnPath";

export function WorkspaceSessionGuard() {
  const { state, controller } = useWorkspaceSession();
  const location = useLocation();
  if (state.status === "ready" || state.status === "switching") return <Outlet />;
  if (["initializing", "activating", "bootstrapping"].includes(state.status)) return <LoadingState label="Preparing your workspace…" />;
  if (state.status === "error") return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-12">
      <h1 className="text-2xl font-bold" tabIndex={-1} ref={(node) => { node?.focus(); }}>Workspace could not be prepared</h1>
      <ErrorPanel error={state.error} />
      {state.operation !== "configuration" ? <><p>For a workspace conflict, check the local backend configuration before retrying. Existing server data is preserved.</p><Button onClick={() => void controller.activate().catch(() => {})}>Try again</Button></> : null}
      <Button variant="secondary" onClick={() => controller.leave({ discard: true })}>Leave workspace</Button>
    </main>
  );
  return <Navigate to="/" replace state={{ from: safeWorkspaceReturnPath(`${location.pathname}${location.search}`), reason: state.status === "expired" ? state.reason : "required" }} />;
}
