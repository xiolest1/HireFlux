import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useWorkspaceSession } from "../auth/workspaceSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, LoadingState } from "../components/ui/Feedback";
import { AccountDeletionEntry, RecentExportEntry } from "../features/accounts/AccountManagementControls";

export function AccountManagementPage() {
  const { state, controller } = useWorkspaceSession();
  const navigate = useNavigate();
  const [localError, setLocalError] = useState<unknown>();
  const lifecycle = state.status === "error" && state.error instanceof ApiError && ["WORKSPACE_DELETING", "WORKSPACE_DELETED"].includes(state.error.code);
  const management = state.status === "account-management" ? state : undefined;
  const deletion = management?.deletion;
  const needsReview = deletion?.provider_finalization === "REVIEW_REQUIRED";
  const complete = deletion?.provider_finalization === "COMPLETE";
  const resume = lifecycle || (deletion && !needsReview && !complete);
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-12 text-ink">
    <h1 className="text-2xl font-bold" tabIndex={-1} ref={(node) => node?.focus()}>Account management</h1>
    <p>Account actions stay separate from your normal workspace.</p>
    {["initializing", "restoring", "callback", "authenticating", "signing-out"].includes(state.status) ? <LoadingState label="Preparing secure account access…" /> : null}
    {management && !deletion ? <>
      <p>Sign-in returned. The server will independently verify your account and recent authentication before this action.</p>
      {management.intent.operation === "export" ? <>
        <p>The JSON archive is a bounded copy of current records, not a backup or recovery guarantee.</p>
        <Button disabled={management.busy || management.consumed} onClick={() => void controller.performSensitiveExport().catch(() => {})}>{management.busy ? "Preparing export…" : "Download JSON export"}</Button>
        {management.completed ? <p role="status">Export downloaded to your device.</p> : null}
        <Button variant="secondary" disabled={management.busy} onClick={() => void controller.retryAccountBootstrap().then((ready) => { if (ready.scope.isCurrent()) navigate("/settings"); }).catch(() => {})}>Return to workspace</Button>
      </> : <>
        <p>This final action irreversibly erases live HireFlux workspace data, then removes the Cognito identity. Historical backups/logs and infrastructure retention are separate.</p>
        <Button disabled={management.busy || management.consumed} onClick={() => void controller.performAccountDeletion().catch(() => {})}>{management.busy ? "Erasing account…" : "Confirm irreversible account deletion"}</Button>
      </>}
    </> : null}
    {deletion ? <section aria-label="Deletion progress" className="space-y-3 rounded-xl border border-line p-4" role="status">
      {complete ? <p>Live HireFlux records were erased and Cognito identity removal was confirmed. Local access is cleared.</p>
        : needsReview ? <p>Live HireFlux records were erased. Identity removal could not be confirmed; local access is cleared. Ask the owner/operator to reconcile provider metadata. Do not repeat deletion blindly.</p>
          : deletion.state === "ACTIVE" ? <p>Workspace erasure has not started. A new, explicitly confirmed and freshly verified request is required to begin deletion.</p>
          : deletion.state === "DELETING" ? <p>Workspace erasure is in progress. Normal reads and writes are blocked. An explicit, freshly verified continuation can process the remaining bounded work.</p>
            : deletion.retryable_failure ? <p>Live HireFlux records were erased. The provider explicitly rejected identity removal. Resolve the provider issue before requesting another verified attempt.</p>
              : <p>Live HireFlux records were erased. Identity removal is not complete. A new, freshly verified continuation is required; do not assume the identity is gone.</p>}
      <p className="text-sm text-ink-muted">This does not promise immediate removal from historical backups, logs or every retained AWS system.</p>
    </section> : null}
    {management?.error || localError || (state.status === "error" && state.error) ? <ErrorPanel error={management?.error ?? localError ?? (state.status === "error" ? state.error : undefined)} /> : null}
    {resume && controller.authenticationConfiguration?.account_management_enabled ? <AccountDeletionEntry label="Verify identity to continue deletion" /> : null}
    {management?.consumed && management.error ? <p>Unknown outcomes are not replayed. Verify the same account again before any new attempt; completed deletion may require operator review if sign-in is no longer possible.</p> : null}
    {management?.consumed && management.error && management.intent.operation === "delete" ? <Button disabled={management.busy} variant="secondary" onClick={() => void controller.reviewAccountDeletion().catch(() => {})}>Check deletion status</Button> : null}
    {management?.consumed && management.error && management.intent.operation === "export" ? <RecentExportEntry /> : null}
    {complete || needsReview ? <Button variant="secondary" onClick={() => { try { controller.finishProviderLogout(); } catch { setLocalError(new ApiError("PROVIDER_LOGOUT_UNCONFIRMED", "Local access is cleared. The managed-login cookie may remain; try provider sign-out again when connected.")); } }}>Finish provider sign-out</Button> : null}
    {!management && !lifecycle && state.status !== "initializing" ? <p>No sensitive action is ready. Open Settings from your admitted workspace to begin a new verified action.</p> : null}
    {!complete && !needsReview ? <Button variant="secondary" disabled={management?.busy} onClick={() => void controller.signOut({ discard: true }).catch(() => {})}>Sign out locally and at provider</Button> : null}
    <Link className="inline-flex min-h-11 items-center underline" to="/" onClick={() => controller.leave({ discard: true })}>Leave account management</Link>
  </main>;
}
