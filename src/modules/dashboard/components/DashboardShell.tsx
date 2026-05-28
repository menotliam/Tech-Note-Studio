import { FilePlus2 } from "lucide-react";
import { NoteEditorShell } from "@/modules/editor/components/NoteEditorShell";
import { createBlankNoteAction } from "@/modules/notes/note.actions";
import type { NoteDetail, NoteSummary } from "@/modules/notes/note.types";
import { RecentNotesCache } from "@/modules/offline-sync/components/RecentNotesCache";
import { SyncQueueProcessor } from "@/modules/offline-sync/components/SyncQueueProcessor";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import { PreferenceThemeApplier } from "@/modules/preferences/components/PreferenceThemeApplier";
import type { UserPreferences } from "@/modules/preferences/preferences.types";
import { getPreferenceStyle } from "@/modules/preferences/preferences.ui";
import type { TemplateSummary } from "@/modules/templates/template.types";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { EditorTabStrip } from "@/modules/workspace-shell/components/EditorTabStrip";
import type { WorkspaceActivity } from "@/modules/workspace-shell/workspace-shell.types";
import { extractOutlineItems } from "@/modules/workspace-shell/workspace-shell.utils";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceGridShell } from "./WorkspaceGridShell";

export function DashboardShell({
  userEmail,
  notes,
  templates,
  folders,
  tags,
  preferences,
  workspace,
  selectedNote,
  splitNote,
  searchQuery = "",
  activeFolderId,
  activeTagId,
  workspaceView = "active"
}: {
  userEmail: string;
  notes: NoteSummary[];
  templates: TemplateSummary[];
  folders: FolderSummary[];
  tags: TagSummary[];
  preferences: UserPreferences;
  workspace: WorkspaceSummary;
  selectedNote?: NoteDetail;
  splitNote?: NoteDetail | null;
  searchQuery?: string;
  activeFolderId?: string;
  activeTagId?: string;
  workspaceView?: "active" | "archive" | "trash";
}) {
  const currentNoteForChrome = selectedNote
    ? { id: selectedNote.id, title: selectedNote.title, contentJson: selectedNote.contentJson }
    : null;
  const splitNoteForChrome = splitNote
    ? { id: splitNote.id, title: splitNote.title, contentJson: splitNote.contentJson }
    : null;
  const outlineItems = extractOutlineItems(currentNoteForChrome);
  const splitOutlineItems = extractOutlineItems(splitNoteForChrome);
  const initialActivity: WorkspaceActivity = searchQuery ? "search" : activeTagId ? "tags" : "explorer";

  return (
    <main
      className="h-screen overflow-hidden bg-background text-foreground"
      style={getPreferenceStyle(preferences)}
    >
      <PreferenceThemeApplier preferences={preferences} />
      {workspaceView === "active" ? <RecentNotesCache notes={notes} /> : null}
      <SyncQueueProcessor />
      <WorkspaceGridShell
        preferences={preferences}
        workspace={workspace}
        userEmail={userEmail}
        initialActivity={initialActivity}
        notes={notes}
        templates={templates}
        folders={folders}
        tags={tags}
        selectedNote={selectedNote}
        searchQuery={searchQuery}
        activeFolderId={activeFolderId}
        activeTagId={activeTagId}
        workspaceView={workspaceView}
      >
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background" data-editor-workbench>
          <EditorTabStrip currentNote={currentNoteForChrome} splitNote={splitNoteForChrome} />
          {selectedNote ? (
            <div
              className={
                "grid min-h-0 flex-1 overflow-hidden " +
                (splitNote ? "xl:grid-cols-2" : "grid-cols-1")
              }
            >
              <NoteEditorShell
                note={selectedNote}
                folders={folders}
                tags={tags}
                preferences={preferences}
                workspace={workspace}
                outlineItems={outlineItems}
              />
              {splitNote ? (
                <div className="min-h-0 border-l border-border">
                  <NoteEditorShell
                    note={splitNote}
                    folders={folders}
                    tags={tags}
                    preferences={preferences}
                    workspace={workspace}
                    outlineItems={splitOutlineItems}
                    splitPane
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-8">
              <div className="w-full max-w-md">
                <EmptyState
                  icon={<FilePlus2 size={28} />}
                  title={getEmptyEditorTitle(workspaceView)}
                  description={getEmptyEditorDescription(workspaceView)}
                  className="border-border bg-panel/70"
                />
                {workspaceView === "active" ? (
                  <form action={createBlankNoteAction} className="mt-4 flex justify-center">
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                      aria-label="Create note"
                    >
                      <FilePlus2 size={17} />
                      New Note
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </WorkspaceGridShell>
    </main>
  );
}

function getEmptyEditorTitle(workspaceView: "active" | "archive" | "trash") {
  if (workspaceView === "archive") {
    return "Archive";
  }

  if (workspaceView === "trash") {
    return "Trash";
  }

  return "Select or create a note";
}

function getEmptyEditorDescription(workspaceView: "active" | "archive" | "trash") {
  if (workspaceView === "archive") {
    return "Archived notes appear here when selected from the Explorer.";
  }

  if (workspaceView === "trash") {
    return "Trashed notes can be reviewed or restored from the Explorer.";
  }

  return "Pick a note from the Explorer or create a fresh technical note.";
}
