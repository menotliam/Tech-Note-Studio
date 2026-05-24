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
import { ActivityBar } from "@/modules/workspace-shell/components/ActivityBar";
import { EditorTabStrip } from "@/modules/workspace-shell/components/EditorTabStrip";
import { ExplorerPanel } from "@/modules/workspace-shell/components/ExplorerPanel";
import type { WorkspaceActivity } from "@/modules/workspace-shell/workspace-shell.types";
import { extractOutlineItems } from "@/modules/workspace-shell/workspace-shell.utils";

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
  activeTagId
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
      <RecentNotesCache notes={notes} />
      <SyncQueueProcessor />
      <div
        data-ide-shell="true"
        data-sidebar-collapsed={String(preferences.dashboard.sidebarCollapsed)}
        data-active-activity={initialActivity}
        data-focus-mode={String(preferences.dashboard.focusModeEnabled)}
        className="grid h-screen min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[56px_300px_minmax(0,1fr)]"
      >
        <ActivityBar
          preferences={preferences}
          workspace={workspace}
          userEmail={userEmail}
          initialActivity={initialActivity}
        />
        <ExplorerPanel
          notes={notes}
          templates={templates}
          folders={folders}
          tags={tags}
          selectedNote={selectedNote}
          searchQuery={searchQuery}
          activeFolderId={activeFolderId}
          activeTagId={activeTagId}
          workspace={workspace}
        />

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
              <div className="max-w-md text-center">
                <div className="mx-auto mb-5 h-12 w-12 rounded-md border border-border bg-[image:var(--accent-gradient)]" />
                <h2 className="text-2xl font-semibold">Select or create a note</h2>
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
