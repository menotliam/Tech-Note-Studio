import {
  Archive,
  Check,
  Code2,
  Download,
  MoreHorizontal,
  Pin,
  RotateCcw,
  Trash2,
  WrapText
} from "lucide-react";
import {
  archiveNoteAction,
  deleteNoteAction,
  togglePinNoteAction,
  updateNoteAction
} from "@/modules/notes/note.actions";
import type { NoteDetail } from "@/modules/notes/note.types";
import { detectTechnicalSnippet } from "@/modules/detection/detection.service";

const sqlSample = "SELECT id, email, created_at\nFROM users\nWHERE is_active = true\nORDER BY created_at DESC;";
const detection = detectTechnicalSnippet(sqlSample);

export function NoteEditorShell({ note }: { note: NoteDetail }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Personal Workspace</p>
          <h2 className="truncate text-lg font-semibold">{note.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Check size={15} className="text-primary" />
            Synced
          </span>
          <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
            Auto-detect
          </label>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            aria-label="Export note"
          >
            <Download size={16} />
            Export
          </button>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
            aria-label="More actions"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </header>

      <article className="mx-auto w-full max-w-4xl flex-1 px-8 py-10">
        <form action={updateNoteAction} className="space-y-5">
          <input type="hidden" name="noteId" value={note.id} />
          <input
            name="title"
            className="w-full bg-transparent text-4xl font-bold outline-none"
            defaultValue={note.title}
            aria-label="Note title"
          />

          <label className="block">
            <span className="sr-only">Note body</span>
            <textarea
              name="body"
              className="min-h-64 w-full resize-y rounded-md border border-border bg-surface p-4 leading-7 outline-none focus:border-primary"
              defaultValue={note.contentText}
              placeholder="Write your technical note..."
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Save
            </button>
            <span className="text-sm text-muted-foreground">
              Basic save stores structured editor JSON and searchable plain text.
            </span>
          </div>
        </form>

        <section className="mt-8 rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <Code2 size={16} className="text-primary" />
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                defaultValue={detection.language ?? "sql"}
                aria-label="Code language"
              >
                <option value="sql">SQL</option>
                <option value="json">JSON</option>
                <option value="bash">Bash</option>
                <option value="typescript">TypeScript</option>
                <option value="plaintext">Plain text</option>
              </select>
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {Math.round(detection.confidence * 100)}% confidence demo
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Toggle line numbers">
                <RotateCcw size={15} />
              </button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Toggle word wrap">
                <WrapText size={15} />
              </button>
              <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Copy
              </button>
            </div>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-6">
            <code>{sqlSample}</code>
          </pre>
        </section>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
          <form action={togglePinNoteAction}>
            <input type="hidden" name="noteId" value={note.id} />
            <input type="hidden" name="isPinned" value={String(note.isPinned)} />
            <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              <Pin size={15} />
              {note.isPinned ? "Unpin" : "Pin"}
            </button>
          </form>
          <form action={archiveNoteAction}>
            <input type="hidden" name="noteId" value={note.id} />
            <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              <Archive size={15} />
              Archive
            </button>
          </form>
          <form action={deleteNoteAction}>
            <input type="hidden" name="noteId" value={note.id} />
            <button className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              <Trash2 size={15} />
              Delete
            </button>
          </form>
        </div>
      </article>
    </div>
  );
}
