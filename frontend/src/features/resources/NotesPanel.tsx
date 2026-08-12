import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorPanel, LoadingState, SuccessBanner } from "../../components/ui/Feedback";
import { formatTimestamp } from "../applications/format";
import {
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from "./queries";

export function NotesPanel({
  applicationId,
  timeZone,
}: {
  applicationId: string;
  timeZone: string;
}) {
  const notesQuery = useNotes(applicationId);
  const createMutation = useCreateNote(applicationId);
  const updateMutation = useUpdateNote(applicationId);
  const deleteMutation = useDeleteNote(applicationId);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    setNotice(null);
    try {
      await createMutation.mutateAsync(content.trim());
      setContent("");
      setNotice("Note added.");
    } catch {
      return;
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="notes-title">
      <div>
        <h2 id="notes-title" className="text-lg font-bold text-slate-950">Notes</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Keep preparation details and private reminders with this application.</p>
      </div>
      <form className="mt-5" onSubmit={addNote}>
        <label htmlFor="new-note" className="sr-only">New note</label>
        <textarea id="new-note" rows={3} maxLength={5000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Add a note about this opportunity…" className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 placeholder:text-slate-400" />
        <div className="mt-2 flex justify-end"><Button type="submit" disabled={!content.trim() || createMutation.isPending}>{createMutation.isPending ? "Adding…" : "Add note"}</Button></div>
      </form>
      {notice ? <div className="mt-4"><SuccessBanner>{notice}</SuccessBanner></div> : null}
      {createMutation.error || updateMutation.error || deleteMutation.error ? <div className="mt-4"><ErrorPanel compact title="Note could not be updated" error={createMutation.error ?? updateMutation.error ?? deleteMutation.error} /></div> : null}
      {notesQuery.isPending ? <div className="mt-5"><LoadingState label="Loading notes…" /></div> : null}
      {notesQuery.isError ? <div className="mt-5"><ErrorPanel compact error={notesQuery.error} onRetry={() => void notesQuery.refetch()} /></div> : null}
      {notesQuery.data?.items.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No notes yet.</p> : null}
      {notesQuery.data?.items.length ? (
        <ul className="mt-5 space-y-3">
          {notesQuery.data.items.map((note) => (
            <li key={note.note_id} className="rounded-xl border border-slate-200 p-4">
              {editingId === note.note_id ? (
                <form onSubmit={async (event) => { event.preventDefault(); if (!editContent.trim()) return; try { await updateMutation.mutateAsync({ noteId: note.note_id, version: note.version, content: editContent.trim() }); setEditingId(null); setNotice("Note updated."); } catch { return; } }}>
                  <label htmlFor={`edit-note-${note.note_id}`} className="sr-only">Edit note</label>
                  <textarea id={`edit-note-${note.note_id}`} rows={3} maxLength={5000} value={editContent} onChange={(event) => setEditContent(event.target.value)} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900" />
                  <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button><Button type="submit" disabled={!editContent.trim() || updateMutation.isPending}>Save note</Button></div>
                </form>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.content}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">Updated {formatTimestamp(note.updated_at, timeZone)}</p>
                    <div className="flex gap-2">
                      <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50" onClick={() => { setEditingId(note.note_id); setEditContent(note.content); setConfirmDeleteId(null); }}>Edit</button>
                      {confirmDeleteId === note.note_id ? <div role="group" aria-label="Confirm note deletion" className="flex flex-wrap items-center gap-2"><span className="self-center text-xs font-semibold text-rose-700">Delete this note?</span><button autoFocus type="button" className="min-h-10 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white" disabled={deleteMutation.isPending} onClick={async () => { try { await deleteMutation.mutateAsync({ noteId: note.note_id, version: note.version }); setConfirmDeleteId(null); setNotice("Note deleted."); } catch { return; } }}>Confirm delete</button><button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-700" onClick={() => setConfirmDeleteId(null)}>Keep note</button></div> : <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50" onClick={() => { setConfirmDeleteId(note.note_id); setEditingId(null); }}>Delete</button>}
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
