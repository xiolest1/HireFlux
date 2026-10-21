import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useWorkspaceSession } from "./workspaceSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, LoadingState } from "../components/ui/Feedback";
import { ApiError } from "../api/client";

import { safeWorkspaceReturnPath } from "./workspaceReturnPath";

export function WorkspaceSessionGuard() {
  const { state, controller } = useWorkspaceSession();
  const location = useLocation();
  if (state.status === "account-management") return <Navigate to="/account" replace />;
  if (state.status === "ready" || state.status === "switching") return <Outlet />;
  if (["initializing", "activating", "bootstrapping", "authenticating", "callback", "restoring", "signing-out"].includes(state.status)) return <LoadingState label={state.status === "signing-out" ? "Signing out…" : "Preparing your workspace…"} />;
  if (state.status === "error") return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-12">
      <h1 className="text-2xl font-bold" tabIndex={-1} ref={(node) => { node?.focus(); }}>Workspace could not be prepared</h1>
      <ErrorPanel error={state.error} />
      {state.error instanceof ApiError && ["WORKSPACE_DELETING", "WORKSPACE_DELETED", "WORKSPACE_BOOTSTRAP_CONFLICT"].includes(state.error.code) ? <p>This workspace cannot be opened. Contact the operator for lifecycle review. Your data will not be reinitialized.</p> :
        state.operation === "account-bootstrap" ? <Button onClick={() => void controller.retryAccountBootstrap().catch(() => {})}>Retry workspace preparation</Button> :
        state.operation === "account" ? <Button onClick={() => void controller.beginSignIn().catch(() => {})}>Sign in again</Button> :
        state.operation !== "configuration" && state.operation !== "logout" ? <><p>Existing server data is preserved.</p><Button onClick={() => void controller.activate().catch(() => {})}>Try again</Button></> : null}
      {state.error instanceof ApiError && ["WORKSPACE_DELETING", "WORKSPACE_DELETED"].includes(state.error.code) ? <Link className="inline-flex min-h-11 items-center underline" to="/account">Review account deletion</Link> : null}
      <Button variant="secondary" onClick={() => controller.leave({ discard: true })}>Leave workspace</Button>
    </main>
  );
  return <Navigate to="/" replace state={{ from: safeWorkspaceReturnPath(`${location.pathname}${location.search}`), reason: state.status === "expired" ? state.reason : "required" }} />;
}
