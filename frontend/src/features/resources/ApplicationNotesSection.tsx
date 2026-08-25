import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/Feedback";
import { formatTimestamp } from "../applications/format";
import { NotesPanel } from "./NotesPanel";
import { useCreateNote, useNotePreview } from "./queries";

export function ApplicationNotesSection({
  applicationId,
  timeZone,
  composerRequest,
}: {
  applicationId: string;
  timeZone: string;
  composerRequest: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState("");
  const [showAll, setShowAll] = useState(false);
  const fullNotesId = useId();
  const preview = useNotePreview(applicationId, nearViewport);
  const createMutation = useCreateNote(applicationId);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || nearViewport) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNearViewport(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearViewport]);

  useEffect(() => {
    if (composerRequest === 0) return;
    setComposerOpen(true);
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }, [composerRequest]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    try {
      await createMutation.mutateAsync(content.trim());
      setContent("");
      setComposerOpen(false);
    } catch {
      // Keep the draft available so the user can retry without retyping it.
    }
  }

  return (
    <section ref={rootRef} id="notes" aria-labelledby="notes-heading" className="scroll-mt-24 border-t border-line pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Private workspace</p>
          <h2 id="notes-heading" tabIndex={-1} className="mt-1 text-xl font-bold text-ink">Notes</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {preview.data ? `${preview.data.total_count} ${preview.data.total_count === 1 ? "note" : "notes"}` : "Capture useful context as the opportunity develops."}
          </p>
        </div>
        <Button className="gap-2" onClick={() => {
          setComposerOpen(true);
          window.setTimeout(() => composerRef.current?.focus(), 0);
        }}>
          <Plus aria-hidden="true" className="size-4" /> Add note
        </Button>
      </div>

      {composerOpen ? (
        <form className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft p-4" onSubmit={submit}>
          <label htmlFor="quick-opportunity-note" className="font-semibold text-ink">New note</label>
          <textarea
            ref={composerRef}
            id="quick-opportunity-note"
            rows={4}
            maxLength={5000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink"
          />
          {createMutation.error ? <ErrorPanel compact error={createMutation.error} title="Note could not be saved" /> : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setComposerOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!content.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </form>
      ) : null}

      {preview.isError ? (
        <div className="mt-5"><ErrorPanel compact error={preview.error} title="Recent notes could not be loaded" onRetry={() => void preview.refetch()} /></div>
      ) : null}
      {preview.data?.items.length ? (
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {preview.data.items.map((note) => (
            <li key={note.note_id} className="rounded-2xl border border-line bg-surface-raised p-4">
              <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-ink">{note.content}</p>
              <p className="mt-3 text-xs text-ink-muted">Updated {formatTimestamp(note.updated_at, timeZone)}</p>
            </li>
          ))}
        </ol>
      ) : null}

      <Button
        variant="secondary"
        className="mt-5 gap-2"
        aria-expanded={showAll}
        aria-controls={fullNotesId}
        onClick={() => setShowAll((current) => !current)}
      >
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
        {showAll ? "Hide note manager" : "View all notes"}
      </Button>
      <div id={fullNotesId} className="mt-5">
        {showAll ? <NotesPanel applicationId={applicationId} timeZone={timeZone} /> : null}
      </div>
    </section>
  );
}
