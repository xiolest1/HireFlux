import { useRef, useState } from "react";
import { useWorkspaceSession } from "../../auth/workspaceSessionContext";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { ErrorPanel } from "../../components/ui/Feedback";

export function RecentExportEntry() {
  const { controller } = useWorkspaceSession();
  const [error, setError] = useState<unknown>();
  return <div className="space-y-3">
    <p className="text-sm text-ink-muted">Full JSON export requires a fresh sign-in to the same account. CSV remains a limited application list.</p>
    <Button onClick={() => {
      if (controller.hasUnsavedChanges && !window.confirm("Discard unsaved changes and verify your identity for export?")) return;
      void controller.beginSensitiveOperation("export", "", { discard: true }).catch(setError);
    }}>Verify identity for JSON export</Button>
    {error ? <ErrorPanel compact error={error} /> : null}
  </div>;
}

export function AccountDeletionEntry({ label = "Delete account" }: { label?: string }) {
  const { controller } = useWorkspaceSession();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<unknown>();
  const input = useRef<HTMLInputElement>(null);
  return <>
    <Button variant="secondary" onClick={() => { setConfirmation(""); setError(undefined); setOpen(true); }}>{label}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Permanently delete this account" role="alertdialog" initialFocusRef={input}
      description="Live HireFlux records are erased first, followed by your Cognito identity. This is irreversible. Historical backups, logs and retained infrastructure may still hold data under their retention policies.">
      <div className="mt-5 space-y-4">
        <p className="text-sm">Staging job records must be fictional, but your registered identity information is real. Sign-out alone does not erase either.</p>
        <label className="block space-y-2 text-sm font-semibold" htmlFor="delete-account-confirmation"><span>Type DELETE_MY_ACCOUNT</span>
          <input id="delete-account-confirmation" ref={input} autoComplete="off" maxLength={32} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="hf-field w-full px-3" />
        </label>
        <p className="text-sm text-ink-muted">Next, sign in again as this same account. You will review one final confirmation before erasure starts.</p>
        {error ? <ErrorPanel compact error={error} /> : null}
        <div className="flex flex-wrap gap-3"><Button disabled={confirmation !== "DELETE_MY_ACCOUNT"} onClick={() => {
          if (controller.hasUnsavedChanges && !window.confirm("Discard unsaved changes and continue to account verification?")) return;
          void controller.beginSensitiveOperation("delete", confirmation, { discard: true }).catch(setError);
        }}>Verify identity to continue</Button><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button></div>
      </div>
    </Dialog>
  </>;
}
