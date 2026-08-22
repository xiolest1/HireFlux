import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import {
  ErrorPanel,
} from "../../components/ui/Feedback";
import { useToast } from "../../components/ui/toastContext";
import { ResourcePanelSkeleton } from "../applications/ApplicationSkeletons";
import { formatTimestamp } from "../applications/format";
import { updateRecruiterGuide } from "../workspace/queries";
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
  const notes = notesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const createMutation = useCreateNote(applicationId);
  const updateMutation = useUpdateNote(applicationId);
  const deleteMutation = useDeleteNote(applicationId);
  const { showToast } = useToast();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!composerOpen) return;
    const timer = window.setTimeout(() => composerRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [composerOpen]);

  useEffect(() => {
    const targetId = editingId
      ? `edit-note-${editingId}`
      : confirmDeleteId
        ? `confirm-delete-note-${confirmDeleteId}`
        : null;
    if (!targetId) return;
    const timer = window.setTimeout(() => document.getElementById(targetId)?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteId, editingId]);

  function closeComposer(restoreFocus = true) {
    setComposerOpen(false);
    setContent("");
    createMutation.reset();
    if (restoreFocus) {
      window.setTimeout(() => addButtonRef.current?.focus(), 0);
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    try {
      await createMutation.mutateAsync(content.trim());
      showToast("Note added.", { title: "Notes updated", tone: "success" });
      updateRecruiterGuide("engagement");
      closeComposer();
    } catch {
      return;
    }
  }

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-6"
      aria-labelledby="notes-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Private workspace
          </p>
          <h2 id="notes-title" className="mt-1 text-lg font-bold text-ink">
            Notes
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Keep preparation details and reminders with this application.
          </p>
        </div>
        {!composerOpen ? (
          <Button
            ref={addButtonRef}
            className="shrink-0 gap-2"
            onClick={() => {
              setComposerOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add note
          </Button>
        ) : null}
      </div>

      {composerOpen ? (
        <form
          className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft p-4"
          onSubmit={addNote}
        >
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="new-note" className="font-semibold text-ink">
              New note
            </label>
            <button
              type="button"
              aria-label="Close note composer"
              className="inline-flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface hover:text-ink"
              onClick={() => closeComposer()}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <textarea
            ref={composerRef}
            id="new-note"
            rows={4}
            maxLength={5000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Capture a question, talking point, or reminder…"
            className="mt-3 min-h-28 w-full resize-y rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink-muted"
          />
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => closeComposer()}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : "Save note"}
            </Button>
          </div>
        </form>
      ) : null}

      {createMutation.error || updateMutation.error || deleteMutation.error ? (
        <div className="mt-4">
          <ErrorPanel
            compact
            title="Note could not be updated"
            error={createMutation.error ?? updateMutation.error ?? deleteMutation.error}
          />
        </div>
      ) : null}
      {notesQuery.isPending ? (
        <div className="mt-5">
          <ResourcePanelSkeleton label="Loading notes…" />
        </div>
      ) : null}
      {notesQuery.isError ? (
        <div className="mt-5">
          <ErrorPanel
            compact
            error={notesQuery.error}
            onRetry={() => void notesQuery.refetch()}
          />
        </div>
      ) : null}
      {notesQuery.isSuccess && notes.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface-muted px-5 py-8 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-violet-soft text-violet">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-3 font-semibold text-ink">No notes yet</p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
            Add context you will want before the next conversation.
          </p>
        </div>
      ) : null}
      {notes.length ? (
        <ul className="mt-5 space-y-3">
          {notes.map((note) => (
            <li key={note.note_id} className="rounded-2xl border border-line bg-surface-raised p-4">
              {editingId === note.note_id ? (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!editContent.trim()) return;
                    try {
                      await updateMutation.mutateAsync({
                        noteId: note.note_id,
                        version: note.version,
                        content: editContent.trim(),
                      });
                      setEditingId(null);
                      showToast("Note updated.", {
                        title: "Notes updated",
                        tone: "success",
                      });
                    } catch {
                      return;
                    }
                  }}
                >
                  <label htmlFor={`edit-note-${note.note_id}`} className="sr-only">
                    Edit note
                  </label>
                  <textarea
                    id={`edit-note-${note.note_id}`}
                    rows={3}
                    maxLength={5000}
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    className="w-full resize-y rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm leading-6 text-ink"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!editContent.trim() || updateMutation.isPending}
                    >
                      Save note
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">
                    {note.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-xs text-ink-muted">
                      Updated {formatTimestamp(note.updated_at, timeZone)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
                        onClick={() => {
                          setEditingId(note.note_id);
                          setEditContent(note.content);
                          setConfirmDeleteId(null);
                        }}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                        Edit
                      </button>
                      {confirmDeleteId === note.note_id ? (
                        <div
                          role="group"
                          aria-label="Confirm note deletion"
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="self-center text-xs font-semibold text-danger">
                            Delete this note?
                          </span>
                          <button
                            id={`confirm-delete-note-${note.note_id}`}
                            type="button"
                            className="min-h-10 rounded-lg bg-danger px-3 text-sm font-semibold text-white"
                            disabled={deleteMutation.isPending}
                            onClick={async () => {
                              try {
                                await deleteMutation.mutateAsync({
                                  noteId: note.note_id,
                                  version: note.version,
                                });
                                setConfirmDeleteId(null);
                                showToast("Note deleted.", {
                                  title: "Notes updated",
                                  tone: "success",
                                });
                              } catch {
                                return;
                              }
                            }}
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            className="min-h-10 rounded-lg px-3 text-sm font-semibold text-ink-muted"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Keep note
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
                          onClick={() => {
                            setConfirmDeleteId(note.note_id);
                            setEditingId(null);
                          }}
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {notesQuery.hasNextPage ? (
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            disabled={notesQuery.isFetchingNextPage}
            onClick={() => void notesQuery.fetchNextPage()}
          >
            {notesQuery.isFetchingNextPage ? "Loading more…" : "Load more notes"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
