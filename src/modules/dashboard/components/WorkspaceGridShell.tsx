"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { NoteDetail, NoteSummary } from "@/modules/notes/note.types";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import type { UserPreferences } from "@/modules/preferences/preferences.types";
import type { TemplateSummary } from "@/modules/templates/template.types";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { ActivityBar } from "@/modules/workspace-shell/components/ActivityBar";
import { ExplorerPanel } from "@/modules/workspace-shell/components/ExplorerPanel";
import type { WorkspaceActivity } from "@/modules/workspace-shell/workspace-shell.types";
import { readLocalLayoutPreferences, writeLocalLayoutPreference } from "@/modules/layout/layout-local-storage";
import { clampPanelWidth, panelWidthLimits } from "@/modules/layout/panel-sizing";

const DEFAULT_EXPLORER_WIDTH: number = panelWidthLimits.explorerWidth.defaultValue;

export function WorkspaceGridShell({
  preferences,
  workspace,
  userEmail,
  initialActivity,
  notes,
  templates,
  folders,
  tags,
  selectedNote,
  searchQuery,
  activeFolderId,
  activeTagId,
  workspaceView,
  children
}: {
  preferences: UserPreferences;
  workspace: WorkspaceSummary;
  userEmail: string;
  initialActivity: WorkspaceActivity;
  notes: NoteSummary[];
  templates: TemplateSummary[];
  folders: FolderSummary[];
  tags: TagSummary[];
  selectedNote?: NoteDetail;
  searchQuery: string;
  activeFolderId?: string;
  activeTagId?: string;
  workspaceView: "active" | "archive" | "trash";
  children: ReactNode;
}) {
  const [explorerWidth, setExplorerWidth] = useState<number>(DEFAULT_EXPLORER_WIDTH);
  const [isResizingExplorer, setIsResizingExplorer] = useState(false);

  useEffect(() => {
    const layoutPreferences = readLocalLayoutPreferences();

    if (typeof layoutPreferences.explorerWidth === "number") {
      setExplorerWidth(layoutPreferences.explorerWidth);
    }
  }, []);

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = explorerWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clampPanelWidth("explorerWidth", startWidth + moveEvent.clientX - startX);
      setExplorerWidth(nextWidth);
      writeLocalLayoutPreference("explorerWidth", nextWidth);
    }

    function stopResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizingExplorer(false);
    }

    setIsResizingExplorer(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
  }

  function resetExplorerWidth() {
    setExplorerWidth(DEFAULT_EXPLORER_WIDTH);
    writeLocalLayoutPreference("explorerWidth", DEFAULT_EXPLORER_WIDTH);
  }

  return (
    <div
      data-ide-shell="true"
      data-sidebar-collapsed={String(preferences.dashboard.sidebarCollapsed)}
      data-active-activity={initialActivity}
      data-focus-mode={String(preferences.dashboard.focusModeEnabled)}
      data-explorer-resizing={String(isResizingExplorer)}
      className="relative grid h-screen min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[56px_var(--explorer-width)_minmax(0,1fr)]"
      style={{ "--explorer-width": `${explorerWidth}px` } as CSSProperties}
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
        workspaceView={workspaceView}
      />
      <button
        type="button"
        data-explorer-resize-handle
        className={
          "absolute bottom-0 top-0 z-40 hidden w-2 cursor-col-resize border-x transition lg:block " +
          (isResizingExplorer
            ? "border-primary/45 bg-primary/15"
            : "border-transparent hover:border-primary/35 hover:bg-primary/10")
        }
        style={{ left: `calc(56px + ${explorerWidth}px - 4px)` }}
        aria-label="Resize explorer"
        title="Drag to resize, double click to reset"
        onPointerDown={startResize}
        onDoubleClick={resetExplorerWidth}
      />
      {children}
    </div>
  );
}
