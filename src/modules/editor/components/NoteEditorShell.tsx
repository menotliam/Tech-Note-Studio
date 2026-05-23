import {
  Archive,
  Download,
  MoreHorizontal,
  Pin,
  Trash2,
} from "lucide-react";
import {
  archiveNoteAction,
  deleteNoteAction,
  togglePinNoteAction,
  updateNoteAction
} from "@/modules/notes/note.actions";
import type { NoteDetail } from "@/modules/notes/note.types";
import {
  toggleTagOnNoteAction
} from "@/modules/organization/organization.actions";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import { NetworkStatusIndicator } from "@/modules/offline-sync/components/NetworkStatusIndicator";
import { FolderAssignmentForm } from "./FolderAssignmentForm";
import { OfflineTitleInput } from "./OfflineTitleInput";
import { RichNoteEditor } from "./RichNoteEditor";

export function NoteEditorShell({
  note,
  folders,
  tags
}: {
  note: NoteDetail;
  folders: FolderSummary[];
  tags: TagSummary[];
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Personal Workspace</p>
          <h2 className="truncate text-lg font-semibold">{note.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <NetworkStatusIndicator />
          <a
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            href={`/api/export?noteId=${note.id}&format=pdf`}
          >
            <Download size={16} />
            PDF
          </a>
          <a
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            href={`/api/export?noteId=${note.id}&format=docx`}
          >
            <Download size={16} />
            DOCX
          </a>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
            aria-label="More actions"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </header>

      <article className="mx-auto w-full max-w-4xl flex-1 px-8 py-10">
        <div className="mb-6 grid gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-[220px_1fr]">
          <FolderAssignmentForm noteId={note.id} folderId={note.folderId} folders={folders} />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = note.tagIds.includes(tag.id);

                  return (
                    <form key={tag.id} action={toggleTagOnNoteAction}>
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="tagId" value={tag.id} />
                      <button
                        className={
                          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition " +
                          (active
                            ? "border-primary bg-muted text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
                        }
                      >
                        {tag.color ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: tag.color }}
                            aria-hidden
                          />
                        ) : null}
                        {tag.name}
                      </button>
                    </form>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Create tags from the sidebar.</p>
            )}
          </div>
        </div>

        <form action={updateNoteAction} className="space-y-5">
          <input type="hidden" name="noteId" value={note.id} />
          <OfflineTitleInput
            noteId={note.id}
            workspaceId={note.workspaceId}
            initialTitle={note.title}
            initialContent={note.contentJson}
            initialContentText={note.contentText}
            updatedAt={note.updatedAt}
          />

          <RichNoteEditor
            key={`${note.id}:${note.updatedAt}`}
            noteId={note.id}
            workspaceId={note.workspaceId}
            title={note.title}
            updatedAt={note.updatedAt}
            initialContent={note.contentJson}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Save
            </button>
            <span className="text-sm text-muted-foreground">
              Saves structured editor JSON and searchable plain text.
            </span>
          </div>
        </form>

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
