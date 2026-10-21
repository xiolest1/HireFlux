import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useWorkspaceSession } from "../auth/workspaceSessionContext";
import { Button } from "../components/ui/Button";
import { ACCOUNT_DELETION_NOTICE } from "../auth/workspaceSessionController";

export function AuthSignedOutPage() {
  const { controller } = useWorkspaceSession();
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [deletionNotice] = useState(() => { try { return window.sessionStorage.getItem(ACCOUNT_DELETION_NOTICE); } catch { return null; } });
  useEffect(() => controller.acceptSignedOut(), [controller]);
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-16">
    <h1 className="text-2xl font-bold" tabIndex={-1} ref={(node) => node?.focus()}>Signed out</h1>
    <p>Local account access is cleared. Signing out does not delete your saved HireFlux applications.</p>
    {deletionNotice === "complete" ? <p role="status">Your preceding account action confirmed live HireFlux erasure and Cognito identity removal. Historical retention systems remain separate.</p> : null}
    {deletionNotice === "review" ? <p role="status">Your preceding account action confirmed live HireFlux erasure, but provider removal requires owner/operator reconciliation.</p> : null}
    {deletionNotice === "unknown" ? <p role="status">The preceding deletion request had an uncertain outcome. Do not assume success or repeat it blindly; review status through the same account or ask the owner/operator.</p> : null}
    {controller.providerLogoutUnconfirmed ? <p role="status">Refresh-token revocation could not be confirmed. Provider sign-out was requested; if it did not complete, the managed-login cookie may remain.</p> : null}
    {controller.providerLogoutUnconfirmed && controller.accountEntryAvailable ? <Button variant="secondary" onClick={() => {
      try { controller.finishProviderLogout(); } catch { setLogoutFailed(true); }
    }}>Retry provider sign-out</Button> : null}
    {logoutFailed ? <p role="alert">Provider sign-out could not be opened. Local access remains cleared; try again when your connection is available.</p> : null}
    {controller.accountEntryAvailable ? <Button onClick={() => void controller.beginSignIn().catch(() => {})}>Sign in again</Button> : null}
    <Link className="inline-flex min-h-11 items-center underline" to="/">Return to HireFlux</Link>
  </main>;
}
