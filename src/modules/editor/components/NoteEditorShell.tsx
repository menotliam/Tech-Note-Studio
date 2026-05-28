import {
  Download,
  MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import {
  deleteNoteAction,
  updateNoteAction
} from "@/modules/notes/note.actions";
import type { NoteDetail } from "@/modules/notes/note.types";
import { notificationCopy } from "@/modules/notifications/notification-copy";
import { NotificationSubmitButton } from "@/modules/notifications/components/NotificationSubmitButton";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import { NetworkStatusIndicator } from "@/modules/offline-sync/components/NetworkStatusIndicator";
import type { UserPreferences } from "@/modules/preferences/preferences.types";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { OutlinePanel } from "@/modules/workspace-shell/components/OutlinePanel";
import { EditorHeaderMenu } from "@/modules/workspace-shell/components/EditorHeaderMenu";
import type { OutlineItem } from "@/modules/workspace-shell/workspace-shell.types";
import { countApproximateEditorLines, getNoteTagNames } from "@/modules/workspace-shell/workspace-shell.utils";
import { CloseNoteTabButton } from "./CloseNoteTabButton";
import { NoteSaveStatus } from "./NoteSaveStatus";
import { OfflineTitleInput } from "./OfflineTitleInput";
import { RichNoteEditor } from "./RichNoteEditor";

export function NoteEditorShell({
  note,
  folders,
  tags,
  preferences,
  workspace,
  outlineItems
}: {
  note: NoteDetail;
  folders: FolderSummary[];
  tags: TagSummary[];
  preferences: UserPreferences;
  workspace: WorkspaceSummary;
  outlineItems: OutlineItem[];
  splitPane?: boolean;
}) {
  const editorWidthClass = "max-w-none";
  const editorTextClass =
    preferences.editor.fontSize === "small"
      ? "text-sm"
      : preferences.editor.fontSize === "large"
        ? "text-lg"
        : "text-base";
  const folder = note.folderId ? folders.find((candidate) => candidate.id === note.folderId) : null;
  const folderName = folder?.name ?? "Unfiled";
  const tagNames = getNoteTagNames(note, tags);
  const lineCount = countApproximateEditorLines({ id: note.id, title: note.title, contentJson: note.contentJson });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="relative z-50 flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              {workspace.name}
            </Link>
            <span>/</span>
            {folder ? (
              <Link href={`/?folder=${folder.id}`} className="truncate hover:text-foreground">
                {folderName}
              </Link>
            ) : (
              <span className="truncate">{folderName}</span>
            )}
            <span>/</span>
            <span className="truncate text-foreground">{note.title}</span>
            {note.isArchived ? (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                Archived
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NetworkStatusIndicator />
          <NoteSaveStatus
            noteId={note.id}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
          />
          <button
            type="submit"
            form={`note-editor-form-${note.id}`}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
          >
            Save
          </button>
          <EditorHeaderMenu
            ariaLabel="Download note"
            summary={
              <span className="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">
              <Download size={14} />
              Download
              </span>
            }
          >
            <div className="absolute right-0 z-[60] mt-1 w-36 rounded-md border border-border bg-panel-strong p-1 shadow-xl">
              <a className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted" href={`/api/export?noteId=${note.id}&format=pdf`}>
                PDF
              </a>
              <a className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted" href={`/api/export?noteId=${note.id}&format=docx`}>
                DOCX
              </a>
            </div>
          </EditorHeaderMenu>
          <EditorHeaderMenu
            ariaLabel="Note actions"
            summary={
              <span className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border hover:bg-muted">
              <MoreHorizontal size={16} />
              </span>
            }
          >
            <div className="absolute right-0 z-[60] mt-1 w-44 rounded-md border border-border bg-panel-strong p-1 shadow-xl">
              <CloseNoteTabButton noteId={note.id} />
              <span className="block cursor-not-allowed rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60">
                Split to the side
              </span>
              <form action={deleteNoteAction}>
                <input type="hidden" name="noteId" value={note.id} />
                <NotificationSubmitButton
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-red-400 hover:bg-muted"
                  intent={notificationCopy.lifecycleMovedToTrash(note.title)}
                >
                  Delete
                </NotificationSubmitButton>
              </form>
            </div>
          </EditorHeaderMenu>
        </div>
      </header>

      <article className={`mx-auto flex w-full ${editorWidthClass} min-h-0 flex-1 flex-col overflow-hidden px-0`}>
        <form
          id={`note-editor-form-${note.id}`}
          action={updateNoteAction}
          className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background ${editorTextClass}`}
        >
          <input type="hidden" name="noteId" value={note.id} />
          <div
            data-outline-drag-bounds
            className="pointer-events-none absolute inset-x-0 bottom-10 top-0 z-40 overflow-hidden"
          >
            <div className="pointer-events-auto absolute right-8 top-4 w-56">
              <OutlinePanel items={outlineItems} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" data-editor-scroll-container>
            <div className="relative min-h-full">
              <RichNoteEditor
                key={`${note.id}:${note.updatedAt}`}
                noteId={note.id}
                workspaceId={note.workspaceId}
                title={note.title}
                updatedAt={note.updatedAt}
                initialContent={note.contentJson}
                preferences={preferences.editor}
                titleControl={
                  <OfflineTitleInput
                    noteId={note.id}
                    workspaceId={note.workspaceId}
                    initialTitle={note.title}
                    initialContent={note.contentJson}
                    initialContentText={note.contentText}
                    updatedAt={note.updatedAt}
                  />
                }
              />
            </div>
          </div>
          <div className="sticky bottom-0 flex min-h-8 items-center justify-between gap-3 border-y border-border bg-background px-4 py-1.5 text-xs text-muted-foreground">
            <span>{folderName}</span>
            <span className="truncate">{tagNames.length > 0 ? tagNames.join(", ") : "No tags"}</span>
            <span>{lineCount} lines</span>
            <NoteSaveStatus noteId={note.id} />
          </div>
        </form>
      </article>
    </div>
  );
}
