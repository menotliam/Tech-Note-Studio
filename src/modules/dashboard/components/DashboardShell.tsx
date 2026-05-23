import Link from "next/link";
import { Archive, FilePlus2, Folder, Pin, Search, Tags } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";
import { NoteEditorShell } from "@/modules/editor/components/NoteEditorShell";
import { MultiNoteExportForm } from "@/modules/export/components/MultiNoteExportForm";
import { createBlankNoteAction } from "@/modules/notes/note.actions";
import type { NoteDetail, NoteSummary } from "@/modules/notes/note.types";
import { formatNoteTimestamp } from "@/modules/notes/note.utils";
import { RecentNotesCache } from "@/modules/offline-sync/components/RecentNotesCache";
import { SyncQueueProcessor } from "@/modules/offline-sync/components/SyncQueueProcessor";
import { createFolderAction, createTagAction } from "@/modules/organization/organization.actions";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import { createNoteFromTemplateAction } from "@/modules/templates/template.actions";
import type { TemplateSummary } from "@/modules/templates/template.types";

export function DashboardShell({
  userEmail,
  notes,
  templates,
  folders,
  tags,
  selectedNote,
  searchQuery = "",
  activeFolderId,
  activeTagId
}: {
  userEmail: string;
  notes: NoteSummary[];
  templates: TemplateSummary[];
  folders: FolderSummary[];
  tags: TagSummary[];
  selectedNote?: NoteDetail;
  searchQuery?: string;
  activeFolderId?: string;
  activeTagId?: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <RecentNotesCache notes={notes} />
      <SyncQueueProcessor />
      <div className="grid min-h-screen grid-cols-[280px_1fr]">
        <aside className="border-r border-border bg-surface p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">TechNote Studio</h1>
              <p className="max-w-48 truncate text-sm text-muted-foreground">{userEmail}</p>
            </div>
            <form action={createBlankNoteAction}>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
                aria-label="Create note"
              >
                <FilePlus2 size={18} />
              </button>
            </form>
          </div>

          <form action={logoutAction} className="mb-4">
            <button className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Log out
            </button>
          </form>

          <form action={createNoteFromTemplateAction} className="mb-4 rounded-md border border-border bg-background p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New from template
              <select
                name="templateId"
                className="mt-2 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm normal-case tracking-normal text-foreground"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose template
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              Create
            </button>
          </form>

          <form className="mb-4 flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <Search size={16} className="text-muted-foreground" />
            <input
              name="q"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search notes"
              defaultValue={searchQuery}
            />
          </form>

          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Folder size={14} />
                Folders
              </div>
              <form action={createFolderAction} className="mb-2 flex gap-2">
                <input
                  name="name"
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none"
                  placeholder="New folder"
                  maxLength={120}
                  required
                />
                <button className="h-9 rounded-md border border-border px-2 text-sm hover:bg-muted">
                  Add
                </button>
              </form>
              <div className="space-y-1 text-sm">
                <FilterLink href="/" label="All notes" active={!activeFolderId && !activeTagId} />
                {folders.map((folder) => (
                  <FilterLink
                    key={folder.id}
                    href={`/?folder=${folder.id}`}
                    label={folder.name}
                    active={activeFolderId === folder.id}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Tags size={14} />
                Tags
              </div>
              <form action={createTagAction} className="mb-2 grid grid-cols-[1fr_64px_auto] gap-2">
                <input
                  name="name"
                  className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm outline-none"
                  placeholder="New tag"
                  maxLength={60}
                  required
                />
                <input
                  name="color"
                  className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm outline-none"
                  placeholder="#0f766e"
                  maxLength={30}
                />
                <button className="h-9 rounded-md border border-border px-2 text-sm hover:bg-muted">
                  Add
                </button>
              </form>
              <div className="space-y-1 text-sm">
                {tags.map((tag) => (
                  <FilterLink
                    key={tag.id}
                    href={`/?tag=${tag.id}`}
                    label={tag.name}
                    active={activeTagId === tag.id}
                    color={tag.color}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="mt-8">
            <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent notes
            </h2>
            {notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className={
                      "block w-full rounded-md border bg-background p-3 text-left transition hover:border-primary " +
                      (selectedNote?.id === note.id ? "border-primary" : "border-border")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{note.title}</span>
                      {note.isPinned ? <Pin size={14} className="text-primary" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {note.contentText || formatNoteTimestamp(note.updatedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                No notes yet. Create your first technical note.
              </div>
            )}
          </div>

          {notes.length > 0 ? <MultiNoteExportForm notes={notes} /> : null}
        </aside>

        <section className="min-w-0">
          {selectedNote ? (
            <NoteEditorShell note={selectedNote} folders={folders} tags={tags} />
          ) : (
            <div className="flex min-h-screen items-center justify-center px-8">
              <div className="max-w-md text-center">
                <h2 className="text-2xl font-semibold">Select or create a note</h2>
                <p className="mt-3 leading-7 text-muted-foreground">
                  Start with a blank note. The next steps will add templates, richer editor blocks,
                  and paste detection inside the editor.
                </p>
                <form action={createBlankNoteAction} className="mt-6">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    aria-label="Create note"
                  >
                    <FilePlus2 size={17} />
                    New Note
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterLink({
  href,
  label,
  active = false,
  color
}: {
  href: string;
  label: string;
  active?: boolean;
  color?: string | null;
}) {
  return (
    <Link
      href={href}
      className={
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition " +
        (active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {color ? (
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      ) : null}
      {label}
    </Link>
  );
}
