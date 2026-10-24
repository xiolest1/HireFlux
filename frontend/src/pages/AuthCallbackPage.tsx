import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspaceSession } from "../auth/workspaceSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, LoadingState } from "../components/ui/Feedback";
import { ApiError } from "../api/client";

let captured: string | undefined;
/** Capture once across StrictMode mounts, then strip query before any async work. */
function captureCallbackUrl(): string {
  if (!captured) captured = window.location.href;
  window.history.replaceState(null, "", "/auth/callback");
  return captured;
}

export function AuthCallbackPage() {
  const { state, controller } = useWorkspaceSession();
  const navigate = useNavigate();
  const [url] = useState(captureCallbackUrl);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let active = true;
    void controller.completeOAuthCallback(url).then(({ ready, returnPath }) => {
      if (active && ready.scope.isCurrent()) navigate(returnPath, { replace: true });
    }).catch(() => {
      if (active) setError(new ApiError("OAUTH_CALLBACK_INCOMPLETE", "Sign-in could not be completed. Use the recovery options below. Saved workspace data is preserved."));
    }).finally(() => { captured = undefined; });
    return () => { active = false; };
  }, [controller, navigate, url]);
  const lifecycle = state.status === "error" && state.error instanceof ApiError && ["WORKSPACE_DELETING", "WORKSPACE_DELETED", "WORKSPACE_BOOTSTRAP_CONFLICT"].includes(state.error.code);
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-16">
    <h1 className="text-2xl font-bold" tabIndex={-1} ref={(node) => node?.focus()}>Completing account sign-in</h1>
    {error || state.status === "error" ? <>
      <ErrorPanel error={state.status === "error" ? state.error : error} />
      {lifecycle ? <><p>This workspace cannot be opened. Existing lifecycle protections remain active. Starting another sign-in will not recreate deleted data.</p><Link className="inline-flex min-h-11 items-center underline" to="/account">Review account deletion</Link></> : <>
        {state.status === "error" && state.operation === "account-bootstrap" ? <Button onClick={() => {
          setError(undefined);
          void controller.retryAccountBootstrap().then((ready) => { if (ready.scope.isCurrent()) navigate("/dashboard", { replace: true }); }).catch(() => setError(new ApiError("ACCOUNT_BOOTSTRAP_UNAVAILABLE", "Workspace preparation could not be completed. Saved data is preserved.")));
        }}>Retry workspace preparation</Button> : null}
        <p className="text-sm text-ink-muted">If you were creating an account, registration may already be complete. Start a fresh Sign In; your previous verification or sign-in response will not be replayed.</p>
        <Button variant="secondary" onClick={() => void controller.beginSignIn().catch(() => {})}>Start sign-in again</Button>
      </>}
    </> : <LoadingState label="Verifying your sign-in and preparing your workspace…" />}
    <Link to="/" onClick={() => controller.leave({ discard: true })} className="inline-flex min-h-11 items-center underline">Return to HireFlux</Link>
  </main>;
}
