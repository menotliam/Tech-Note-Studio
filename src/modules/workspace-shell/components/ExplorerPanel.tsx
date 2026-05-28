"use client";

import Link from "next/link";
import type { DragEvent as ReactDragEvent, MouseEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  ChevronDown,
  ChevronsDownUp,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  PanelLeftClose,
  Pin,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { MultiNoteExportForm } from "@/modules/export/components/MultiNoteExportForm";
import { notificationCopy } from "@/modules/notifications/notification-copy";
import { notify } from "@/modules/notifications/notification.service";
import {
  archiveNoteAction,
  createBlankNoteAction,
  deleteAllTrashAction,
  deleteNoteAction,
  deleteNoteForeverAction,
  moveNoteToTrashAction,
  renameNoteAction,
  restoreArchivedNoteAction,
  restoreTrashedNoteAction,
  togglePinNoteAction
} from "@/modules/notes/note.actions";
import type { NoteDetail, NoteSummary } from "@/modules/notes/note.types";
import { formatNoteTimestamp } from "@/modules/notes/note.utils";
import {
  archiveFolderNotesAction,
  assignFolderToNoteByIdsAction,
  assignParentFolderByIdsAction,
  createFolderAction,
  createNoteInFolderAction,
  createTagAction,
  deleteFolderAction,
  deleteFolderForeverAction,
  deleteTagAction,
  renameFolderAction,
  renameTagAction,
  removeTagFromAllNotesAction,
  restoreArchivedFolderAction,
  restoreTrashedFolderAction,
  togglePinFolderAction,
  toggleTagOnNoteAction,
  updateTagColorAction
} from "@/modules/organization/organization.actions";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import { createNoteFromTemplateAction } from "@/modules/templates/template.actions";
import type { TemplateSummary } from "@/modules/templates/template.types";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { removeOpenNoteTab } from "../open-tabs.client";
import { buildFolderTree, getPrimaryTagColor, type FolderTreeNode } from "../workspace-shell.utils";

type ContextMenuState =
  | { type: "note"; note: NoteSummary; x: number; y: number }
  | { type: "folder"; folder: FolderTreeNode; x: number; y: number }
  | { type: "tag"; tag: TagSummary; x: number; y: number }
  | null;

type ConfirmActionState = {
  title: string;
  message: string;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Array<{ name: string; value: string }>;
  onConfirm?: () => void;
};

type ExplorerDragItem =
  | { type: "note"; id: string; label: string }
  | { type: "folder"; id: string; label: string };

type ExplorerDropTarget =
  | { type: "root"; id: "root"; valid: boolean }
  | { type: "folder"; id: string; label: string; valid: boolean }
  | null;

const tagColorPresets = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#64748b"
];

export function ExplorerPanel({
  notes,
  templates,
  folders,
  tags,
  selectedNote,
  searchQuery,
  activeFolderId,
  activeTagId,
  workspace,
  workspaceView = "active"
}: {
  notes: NoteSummary[];
  templates: TemplateSummary[];
  folders: FolderSummary[];
  tags: TagSummary[];
  selectedNote?: NoteDetail;
  searchQuery: string;
  activeFolderId?: string;
  activeTagId?: string;
  workspace: WorkspaceSummary;
  workspaceView?: "active" | "archive" | "trash";
}) {
  const tree = buildFolderTree(folders, notes);
  const visibleTree = workspaceView === "active" ? tree : filterEmptyFolders(tree);
  const searchResults = useMemo(() => searchNotes(notes, searchQuery), [notes, searchQuery]);
  const activeTag = activeTagId ? tags.find((tag) => tag.id === activeTagId) ?? null : null;
  const activeTagNotes = activeTagId ? notes.filter((note) => note.tagIds.includes(activeTagId)) : [];
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [tagPendingDelete, setTagPendingDelete] = useState<TagSummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);
  const [dragItem, setDragItem] = useState<ExplorerDragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<ExplorerDropTarget>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function closeOnPointerDown(event: PointerEvent) {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setContextMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }

    function closeOnActivityChange() {
      setContextMenu(null);
    }

    document.addEventListener("pointerdown", closeOnPointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("technote:activity-change", closeOnActivityChange);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("technote:activity-change", closeOnActivityChange);
    };
  }, [contextMenu]);

  function moveNoteToFolder(noteId: string, folderId: string | null) {
    startTransition(() => {
      void assignFolderToNoteByIdsAction(noteId, folderId);
    });
  }

  function moveFolderToParent(folderId: string, parentId: string | null) {
    startTransition(() => {
      void assignParentFolderByIdsAction(folderId, parentId);
    });
  }

  function hasExplorerDragPayload(event: ReactDragEvent) {
    return (
      event.dataTransfer.types.includes("application/x-technote-note") ||
      event.dataTransfer.types.includes("application/x-technote-folder")
    );
  }

  function markRootDropTarget(event: ReactDragEvent) {
    if (workspaceView !== "active") {
      return;
    }

    if (dragItem || hasExplorerDragPayload(event)) {
      event.preventDefault();
      if (dropTarget?.type !== "root" || !dropTarget.valid) {
        setDropTarget({ type: "root", id: "root", valid: true });
      }
    }
  }

  function clearDropTarget() {
    setDropTarget(null);
  }

  function clearDragState() {
    setDragItem(null);
    setDropTarget(null);
  }

  function moveDroppedNoteToRoot(event: ReactDragEvent) {
    if (workspaceView !== "active") {
      clearDropTarget();
      return;
    }

    const noteId = event.dataTransfer.getData("application/x-technote-note");
    const folderId = event.dataTransfer.getData("application/x-technote-folder");

    if (noteId || folderId) {
      event.preventDefault();
      event.stopPropagation();
      if (noteId) {
        moveNoteToFolder(noteId, null);
      }
      if (folderId) {
        moveFolderToParent(folderId, null);
      }
    }

    clearDragState();
  }

  function collapseAllFolders() {
    setCollapsedFolders(new Set(folders.map((folder) => folder.id)));
  }

  return (
    <aside
      className="border-r border-border bg-panel text-sm"
      data-explorer-panel
      data-dragging-explorer-item={dragItem ? "true" : "false"}
      onClick={() => setContextMenu(null)}
    >
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explorer</span>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Collapse explorer"
          title="Collapse explorer"
          onClick={() => document.querySelector("[data-ide-shell]")?.setAttribute("data-explorer-collapsed", "true")}
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="h-[calc(100vh-40px)] overflow-y-auto px-2 py-3">
        <section
          data-activity-panel="explorer"
          className="relative hidden min-h-full space-y-3"
          onDragOver={markRootDropTarget}
          onDrop={moveDroppedNoteToRoot}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              clearDropTarget();
            }
          }}
        >
          <div
            className={
              "flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide transition " +
              (dropTarget?.type === "root"
                ? "bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]"
                : "text-muted-foreground")
            }
            onDragOver={markRootDropTarget}
            onDrop={moveDroppedNoteToRoot}
          >
            <Folder size={14} />
            <span className="truncate">{workspace.name}</span>
            <div className="ml-auto flex items-center gap-1">
              {workspaceView === "active" ? (
                <>
                  <form action={createBlankNoteAction}>
                    <button
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Create note"
                      title="Create note"
                    >
                      <FilePlus2 size={15} />
                    </button>
                  </form>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Create folder"
                    title="Create folder"
                    onClick={() => setCreatingFolder(true)}
                  >
                    <FolderPlus size={15} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Collapse all folders"
                    title="Collapse all folders"
                    onClick={collapseAllFolders}
                  >
                    <ChevronsDownUp size={15} />
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <LifecycleNavigation
            activeView={workspaceView}
            hasTrashItems={workspaceView === "trash" && (notes.length > 0 || folders.length > 0)}
            requestConfirm={setConfirmAction}
          />

          {creatingFolder && workspaceView === "active" ? (
            <form
              action={createFolderAction}
              className="px-2"
              onSubmit={() => window.setTimeout(() => setCreatingFolder(false), 0)}
            >
              <input
                autoFocus
                name="name"
                className="h-8 w-full rounded-md border border-primary bg-background px-2 text-xs outline-none"
                placeholder="Folder name"
                maxLength={120}
                required
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setCreatingFolder(false);
                  }
                }}
              />
            </form>
          ) : null}

          <div
            className={
              "min-h-20 space-y-0.5 rounded-md transition " +
              (dropTarget?.type === "root" ? "bg-primary/5" : "")
            }
            onDragOver={markRootDropTarget}
            onDrop={moveDroppedNoteToRoot}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                clearDropTarget();
              }
            }}
          >
            {visibleTree.folders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                tags={tags}
                selectedNoteId={selectedNote?.id}
                activeFolderId={activeFolderId}
                workspaceView={workspaceView}
                collapsedFolders={collapsedFolders}
                setCollapsedFolders={setCollapsedFolders}
                moveNoteToFolder={moveNoteToFolder}
                moveFolderToParent={moveFolderToParent}
                dragItem={dragItem}
                dropTarget={dropTarget}
                setDragItem={setDragItem}
                setDropTarget={setDropTarget}
                clearDragState={clearDragState}
                openContextMenu={(event, targetFolder) => {
                  event.preventDefault();
                  setContextMenu({ type: "folder", folder: targetFolder, x: event.clientX, y: event.clientY });
                }}
                openNoteContextMenu={(event, note) => {
                  event.preventDefault();
                  setContextMenu({ type: "note", note, x: event.clientX, y: event.clientY });
                }}
              />
            ))}
            {visibleTree.unfiledNotes.map((note) => (
              <NoteNode
                key={note.id}
                note={note}
                tags={tags}
                active={selectedNote?.id === note.id}
                workspaceView={workspaceView}
                dragItem={dragItem}
                setDragItem={setDragItem}
                clearDragState={clearDragState}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ type: "note", note, x: event.clientX, y: event.clientY });
                }}
              />
            ))}
          </div>
          {dragItem ? <ExplorerDragGhost item={dragItem} dropTarget={dropTarget} /> : null}
        </section>

        <section data-activity-panel="search" className="hidden space-y-3">
          <PanelTitle icon={<Search size={14} />} title="Search" />
          <form className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm">
            <Search size={15} className="text-muted-foreground" />
            <input
              name="q"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search notes"
              defaultValue={searchQuery}
            />
          </form>
          <div className="space-y-1">
            {searchQuery ? (
              searchResults.length > 0 ? (
                searchResults.map((note) => (
                  <NoteNode
                    key={note.id}
                    note={note}
                    tags={tags}
                    active={selectedNote?.id === note.id}
                    workspaceView={workspaceView}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({ type: "note", note, x: event.clientX, y: event.clientY });
                    }}
                  />
                ))
              ) : (
                <p className="px-2 text-xs text-muted-foreground">No matching notes.</p>
              )
            ) : (
              <p className="px-2 text-xs text-muted-foreground">Type a query to search notes.</p>
            )}
          </div>
        </section>

        <section data-activity-panel="templates" className="hidden space-y-3">
          <PanelTitle icon={<FileText size={14} />} title="Templates" />
          <form action={createNoteFromTemplateAction} className="rounded-md border border-border bg-background p-3">
            <select
              name="templateId"
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
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
            <button className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              Create
            </button>
          </form>
        </section>

        <section data-activity-panel="tags" className="hidden space-y-3">
          <PanelTitle icon={<Tags size={14} />} title="Tags" />
          <form action={createTagAction} className="grid grid-cols-[1fr_auto] gap-2">
            <input
              name="name"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none"
              placeholder="New tag"
              maxLength={60}
              required
            />
            <button className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted">Add</button>
            <div className="col-span-2">
              <TagColorField />
            </div>
          </form>
          <div className="space-y-1">
            {tags.map((tag) => (
              <TagExplorerRow
                key={tag.id}
                tag={tag}
                active={activeTagId === tag.id}
                onRequestDelete={setTagPendingDelete}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ type: "tag", tag, x: event.clientX, y: event.clientY });
                }}
              />
            ))}
          </div>
          {activeTag ? (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeTag.color ?? "hsl(var(--muted-foreground))" }}
                />
                <span className="truncate">{activeTag.name}</span>
              </div>
              <div className="space-y-1">
                {activeTagNotes.length > 0 ? (
                  activeTagNotes.map((note) => (
                    <NoteNode
                      key={note.id}
                      note={note}
                      tags={tags}
                      active={selectedNote?.id === note.id}
                      workspaceView={workspaceView}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContextMenu({ type: "note", note, x: event.clientX, y: event.clientY });
                      }}
                    />
                  ))
                ) : (
                  <p className="px-2 text-xs text-muted-foreground">No notes use this tag.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="px-2 text-xs text-muted-foreground">Select a tag to see applied notes.</p>
          )}
        </section>

        <section data-activity-panel="export" className="hidden">
          <PanelTitle icon={<Upload size={14} />} title="Export Cart" />
          {notes.length > 0 ? <MultiNoteExportForm notes={notes} /> : null}
        </section>
      </div>

      {contextMenu ? (
        <ExplorerContextMenu
          menuRef={contextMenuRef}
          menu={contextMenu}
          tags={tags}
          activeNoteId={selectedNote?.id}
          workspaceView={workspaceView}
          requestConfirm={(nextConfirmAction) => {
            setConfirmAction(nextConfirmAction);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      {tagPendingDelete ? (
        <DeleteTagDialog tag={tagPendingDelete} onClose={() => setTagPendingDelete(null)} />
      ) : null}
      {confirmAction ? (
        <ConfirmActionDialog confirmAction={confirmAction} onClose={() => setConfirmAction(null)} />
      ) : null}
    </aside>
  );
}

function FolderNode({
  folder,
  tags,
  selectedNoteId,
  activeFolderId,
  workspaceView,
  collapsedFolders,
  setCollapsedFolders,
  moveNoteToFolder,
  moveFolderToParent,
  dragItem,
  dropTarget,
  setDragItem,
  setDropTarget,
  clearDragState,
  openContextMenu,
  openNoteContextMenu,
  depth = 0
}: {
  folder: FolderTreeNode;
  tags: TagSummary[];
  selectedNoteId?: string;
  activeFolderId?: string;
  workspaceView: "active" | "archive" | "trash";
  collapsedFolders: Set<string>;
  setCollapsedFolders: (value: Set<string>) => void;
  moveNoteToFolder: (noteId: string, folderId: string | null) => void;
  moveFolderToParent: (folderId: string, parentId: string | null) => void;
  dragItem: ExplorerDragItem | null;
  dropTarget: ExplorerDropTarget;
  setDragItem: (item: ExplorerDragItem | null) => void;
  setDropTarget: (target: ExplorerDropTarget) => void;
  clearDragState: () => void;
  openContextMenu: (event: MouseEvent, folder: FolderTreeNode) => void;
  openNoteContextMenu: (event: MouseEvent, note: NoteSummary) => void;
  depth?: number;
}) {
  const collapsed = collapsedFolders.has(folder.id);
  const activeDropTarget = dropTarget?.type === "folder" && dropTarget.id === folder.id;
  const invalidDropTarget = activeDropTarget && !dropTarget.valid;

  return (
    <div
      draggable={workspaceView === "active"}
      onDragStart={(event) => {
        if (workspaceView !== "active") {
          return;
        }
        event.stopPropagation();
        event.dataTransfer.setData("application/x-technote-folder", folder.id);
        event.dataTransfer.effectAllowed = "move";
        setDragItem({ type: "folder", id: folder.id, label: folder.name });
      }}
      onDragOver={(event) => {
        if (workspaceView !== "active") {
          return;
        }

        const noteId =
          dragItem?.type === "note" ? dragItem.id : event.dataTransfer.getData("application/x-technote-note");
        const movingFolderId =
          dragItem?.type === "folder" ? dragItem.id : event.dataTransfer.getData("application/x-technote-folder");

        if (!noteId && !movingFolderId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const nextDropTarget: ExplorerDropTarget = {
          type: "folder",
          id: folder.id,
          label: folder.name,
          valid: Boolean(noteId) || (Boolean(movingFolderId) && movingFolderId !== folder.id)
        };

        if (
          dropTarget?.type !== "folder" ||
          dropTarget.id !== nextDropTarget.id ||
          dropTarget.label !== nextDropTarget.label ||
          dropTarget.valid !== nextDropTarget.valid
        ) {
          setDropTarget(nextDropTarget);
        }
      }}
      onDrop={(event) => {
        if (workspaceView !== "active") {
          clearDragState();
          return;
        }
        const noteId = event.dataTransfer.getData("application/x-technote-note");
        const movingFolderId = event.dataTransfer.getData("application/x-technote-folder");
        if (noteId) {
          event.preventDefault();
          event.stopPropagation();
          moveNoteToFolder(noteId, folder.id);
        }
        if (movingFolderId && movingFolderId !== folder.id) {
          event.preventDefault();
          event.stopPropagation();
          moveFolderToParent(movingFolderId, folder.id);
        }
        clearDragState();
      }}
      onDragEnd={clearDragState}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && activeDropTarget) {
          setDropTarget(null);
        }
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        openContextMenu(event, folder);
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_24px] items-center">
        <ExplorerLink
          href={workspaceView === "active" ? `/?folder=${folder.id}` : undefined}
          label={folder.name}
          active={activeFolderId === folder.id}
          icon={<Folder size={14} />}
          detail={getFolderDetail(folder, workspaceView)}
          pinned={folder.isPinned}
          depth={depth}
          dropState={activeDropTarget ? (invalidDropTarget ? "invalid" : "valid") : undefined}
          dragging={dragItem?.type === "folder" && dragItem.id === folder.id}
        />
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand folder" : "Collapse folder"}
          onClick={() => {
            const next = new Set(collapsedFolders);
            if (collapsed) {
              next.delete(folder.id);
            } else {
              next.add(folder.id);
            }
            setCollapsedFolders(next);
          }}
        >
          <ChevronDown size={14} className={collapsed ? "-rotate-90 transition" : "transition"} />
        </button>
      </div>
      {!collapsed ? (
        <div>
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              tags={tags}
              selectedNoteId={selectedNoteId}
              activeFolderId={activeFolderId}
              workspaceView={workspaceView}
              collapsedFolders={collapsedFolders}
              setCollapsedFolders={setCollapsedFolders}
              moveNoteToFolder={moveNoteToFolder}
              moveFolderToParent={moveFolderToParent}
              dragItem={dragItem}
              dropTarget={dropTarget}
              setDragItem={setDragItem}
              setDropTarget={setDropTarget}
              clearDragState={clearDragState}
              openContextMenu={openContextMenu}
              openNoteContextMenu={openNoteContextMenu}
              depth={depth + 1}
            />
          ))}
          {folder.notes.map((note) => (
            <NoteNode
              key={note.id}
              note={note}
              tags={tags}
              active={selectedNoteId === note.id}
              workspaceView={workspaceView}
              depth={depth + 1}
              dragItem={dragItem}
              setDragItem={setDragItem}
              clearDragState={clearDragState}
              onContextMenu={(event) => openNoteContextMenu(event, note)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoteNode({
  note,
  tags,
  active,
  workspaceView,
  dragItem = null,
  setDragItem,
  clearDragState,
  onContextMenu,
  depth = 0
}: {
  note: NoteSummary;
  tags: TagSummary[];
  active: boolean;
  workspaceView: "active" | "archive" | "trash";
  dragItem?: ExplorerDragItem | null;
  setDragItem?: (item: ExplorerDragItem | null) => void;
  clearDragState?: () => void;
  onContextMenu: (event: MouseEvent) => void;
  depth?: number;
}) {
  return (
    <div
      draggable={workspaceView === "active"}
      onDragStart={(event) => {
        if (workspaceView !== "active") {
          return;
        }
        event.stopPropagation();
        event.dataTransfer.setData("application/x-technote-note", note.id);
        event.dataTransfer.effectAllowed = "move";
        setDragItem?.({ type: "note", id: note.id, label: note.title });
      }}
      onDragEnd={clearDragState}
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu(event);
      }}
    >
      <ExplorerLink
        href={workspaceView === "active" ? `/notes/${note.id}` : undefined}
        label={note.title}
        active={active}
        color={getPrimaryTagColor(note, tags)}
        icon={<FileText size={14} />}
        detail={getNoteDetail(note, workspaceView)}
        pinned={note.isPinned}
        depth={depth}
        dragging={dragItem?.type === "note" && dragItem.id === note.id}
      />
    </div>
  );
}

function ExplorerDragGhost({ item, dropTarget }: { item: ExplorerDragItem; dropTarget: ExplorerDropTarget }) {
  const targetLabel =
    dropTarget?.type === "root"
      ? "Move to workspace root"
      : dropTarget?.type === "folder" && dropTarget.valid
        ? `Move into ${dropTarget.label}`
        : dropTarget?.type === "folder"
          ? "Cannot drop here"
          : item.type === "note"
            ? "Choose a folder or workspace root"
            : "Choose a parent folder or workspace root";

  return (
    <div className="pointer-events-none sticky bottom-3 z-30 mx-2 rounded-md border border-border bg-panel-strong px-3 py-2 text-xs shadow-2xl shadow-black/30">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-2 w-2 rounded-full " +
            (dropTarget?.valid === false ? "bg-red-400" : dropTarget ? "bg-primary" : "bg-muted-foreground")
          }
        />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.label}</span>
      </div>
      <p className="mt-1 truncate text-muted-foreground">{targetLabel}</p>
    </div>
  );
}

function ExplorerContextMenu({
  menuRef,
  menu,
  tags,
  activeNoteId,
  workspaceView,
  requestConfirm,
  onClose
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  menu: NonNullable<ContextMenuState>;
  tags: TagSummary[];
  activeNoteId?: string;
  workspaceView: "active" | "archive" | "trash";
  requestConfirm: (confirmAction: ConfirmActionState) => void;
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const style = {
    left: menu.x,
    top: menu.y
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-56 rounded-md border border-border bg-panel-strong p-1 text-sm shadow-2xl"
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      {menu.type === "tag" ? (
        <TagContextMenu tag={menu.tag} requestConfirm={requestConfirm} onClose={onClose} />
      ) : menu.type === "note" ? (
        workspaceView === "archive" ? (
          <>
            <form
              action={restoreArchivedNoteAction}
              onSubmit={() => {
                notify(notificationCopy.lifecycleRestored(menu.note.title));
                onClose();
              }}
            >
              <input type="hidden" name="noteId" value={menu.note.id} />
              <MenuSubmit icon={<RotateCcw size={14} />}>Restore to workspace</MenuSubmit>
            </form>
            <form
              action={moveNoteToTrashAction}
              onSubmit={() => {
                notify(notificationCopy.lifecycleMovedToTrash(menu.note.title));
                closeNoteLocally(menu.note.id, onClose);
              }}
            >
              <input type="hidden" name="noteId" value={menu.note.id} />
              <MenuSubmit danger icon={<Trash2 size={14} />}>Move to Trash</MenuSubmit>
            </form>
          </>
        ) : workspaceView === "trash" ? (
          <>
            <form
              action={restoreTrashedNoteAction}
              onSubmit={() => {
                notify(notificationCopy.lifecycleRestored(menu.note.title));
                onClose();
              }}
            >
              <input type="hidden" name="noteId" value={menu.note.id} />
              <MenuSubmit icon={<RotateCcw size={14} />}>Restore</MenuSubmit>
            </form>
            <MenuSubmit
              type="button"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => {
                requestConfirm({
                  title: "Delete note forever",
                  message: "Delete this note forever? This cannot be undone.",
                  confirmLabel: "Delete forever",
                  action: deleteNoteForeverAction,
                  fields: [{ name: "noteId", value: menu.note.id }],
                  onConfirm: () => {
                    notify(notificationCopy.lifecycleDeletedForever(menu.note.title));
                    closeNoteLocally(menu.note.id, onClose);
                  }
                });
              }}
            >
              Delete forever
            </MenuSubmit>
          </>
        ) : (
          <>
          <MenuLink href={`/notes/${activeNoteId ?? menu.note.id}?split=${menu.note.id}`}>Split to the side</MenuLink>
          <div className="group relative">
            <MenuButton>Tags</MenuButton>
            <div className="absolute left-full top-0 hidden min-w-44 rounded-md border border-border bg-panel-strong p-1 shadow-xl group-hover:block">
              {tags.length > 0 ? (
                tags.map((tag) => {
                  const active = menu.note.tagIds.includes(tag.id);

                  return (
                    <form key={tag.id} action={toggleTagOnNoteAction} onSubmit={onClose}>
                      <input type="hidden" name="noteId" value={menu.note.id} />
                      <input type="hidden" name="tagId" value={tag.id} />
                      <MenuSubmit>
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: tag.color ?? "hsl(var(--muted-foreground))" }}
                        />
                        {active ? "Remove" : "Apply"} {tag.name}
                      </MenuSubmit>
                    </form>
                  );
                })
              ) : (
                <MenuButton disabled>No tags</MenuButton>
              )}
            </div>
          </div>
          <form action={togglePinNoteAction} onSubmit={onClose}>
            <input type="hidden" name="noteId" value={menu.note.id} />
            <input type="hidden" name="isPinned" value={String(menu.note.isPinned)} />
            <MenuSubmit icon={<Pin size={14} />}>{menu.note.isPinned ? "Unpin" : "Pin"}</MenuSubmit>
          </form>
          <form
            action={archiveNoteAction}
            onSubmit={() => {
              notify(notificationCopy.lifecycleArchived(menu.note.title));
              closeNoteLocally(menu.note.id, onClose);
            }}
          >
            <input type="hidden" name="noteId" value={menu.note.id} />
            <MenuSubmit icon={<Archive size={14} />}>Archive</MenuSubmit>
          </form>
          {renaming ? (
            <RenameForm
              action={renameNoteAction}
              idName="noteId"
              idValue={menu.note.id}
              fieldName="title"
              defaultName={menu.note.title}
              onSubmit={onClose}
            />
          ) : (
            <MenuButton onClick={() => setRenaming(true)}>Rename</MenuButton>
          )}
          <form
            action={deleteNoteAction}
            onSubmit={() => {
              notify(notificationCopy.lifecycleMovedToTrash(menu.note.title));
              closeNoteLocally(menu.note.id, onClose);
            }}
          >
            <input type="hidden" name="noteId" value={menu.note.id} />
            <MenuSubmit danger icon={<Trash2 size={14} />}>Delete</MenuSubmit>
          </form>
        </>
        )
      ) : (
        workspaceView === "archive" ? (
          <>
            <form
              action={restoreArchivedFolderAction}
              onSubmit={() => {
                notify(notificationCopy.lifecycleRestored(menu.folder.name));
                onClose();
              }}
            >
              <input type="hidden" name="folderId" value={menu.folder.id} />
              <MenuSubmit icon={<RotateCcw size={14} />}>Restore folder</MenuSubmit>
            </form>
            <form
              action={deleteFolderAction}
              onSubmit={() => {
                notify(notificationCopy.lifecycleMovedToTrash(menu.folder.name));
                onClose();
              }}
            >
              <input type="hidden" name="folderId" value={menu.folder.id} />
              <MenuSubmit danger icon={<Trash2 size={14} />}>Move folder to Trash</MenuSubmit>
            </form>
          </>
        ) : workspaceView === "trash" ? (
          <>
            <form
              action={restoreTrashedFolderAction}
              onSubmit={() => {
                notify(notificationCopy.lifecycleRestored(menu.folder.name));
                onClose();
              }}
            >
              <input type="hidden" name="folderId" value={menu.folder.id} />
              <MenuSubmit icon={<RotateCcw size={14} />}>Restore folder</MenuSubmit>
            </form>
            <MenuSubmit
              type="button"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => {
                requestConfirm({
                  title: "Delete folder forever",
                  message: "Delete this folder forever? Notes inside it will also be deleted.",
                  confirmLabel: "Delete forever",
                  action: deleteFolderForeverAction,
                  fields: [{ name: "folderId", value: menu.folder.id }],
                  onConfirm: () => {
                    notify(notificationCopy.lifecycleDeletedForever(menu.folder.name));
                    onClose();
                  }
                });
              }}
            >
              Delete folder forever
            </MenuSubmit>
          </>
        ) : (
          <>
          <form action={createNoteInFolderAction} onSubmit={onClose}>
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit icon={<FilePlus2 size={14} />}>New note</MenuSubmit>
          </form>
          <form action={togglePinFolderAction} onSubmit={onClose}>
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <input type="hidden" name="isPinned" value={String(menu.folder.isPinned)} />
            <MenuSubmit icon={<Pin size={14} />}>{menu.folder.isPinned ? "Unpin folder" : "Pin folder"}</MenuSubmit>
          </form>
          <form
            action={archiveFolderNotesAction}
            onSubmit={() => {
              notify(notificationCopy.lifecycleArchived(menu.folder.name));
              onClose();
            }}
          >
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit icon={<Archive size={14} />}>Archive folder</MenuSubmit>
          </form>
          {renaming ? (
            <RenameForm
              action={renameFolderAction}
              idName="folderId"
              idValue={menu.folder.id}
              fieldName="name"
              defaultName={menu.folder.name}
              onSubmit={onClose}
            />
          ) : (
            <MenuButton onClick={() => setRenaming(true)}>Rename</MenuButton>
          )}
          <form
            action={deleteFolderAction}
            onSubmit={() => {
              notify(notificationCopy.lifecycleMovedToTrash(menu.folder.name));
              onClose();
            }}
          >
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit danger icon={<Trash2 size={14} />}>Delete folder</MenuSubmit>
          </form>
        </>
        )
      )}
    </div>
  );
}

function closeNoteLocally(noteId: string, onClose: () => void) {
  removeOpenNoteTab(noteId);
  onClose();
}

function TagContextMenu({
  tag,
  requestConfirm,
  onClose
}: {
  tag: TagSummary;
  requestConfirm: (confirmAction: ConfirmActionState) => void;
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [editingColor, setEditingColor] = useState(false);

  return (
    <>
      {renaming ? (
        <RenameForm
          action={renameTagAction}
          idName="tagId"
          idValue={tag.id}
          fieldName="name"
          defaultName={tag.name}
          onSubmit={onClose}
        />
      ) : (
        <MenuButton onClick={() => setRenaming(true)}>Rename</MenuButton>
      )}
      {editingColor ? (
        <form action={updateTagColorAction} className="p-1" onSubmit={onClose}>
          <input type="hidden" name="tagId" value={tag.id} />
          <TagColorField initialColor={tag.color ?? ""} autoFocus />
          <button className="mt-1 w-full rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground">
            Save color
          </button>
        </form>
      ) : (
        <MenuButton onClick={() => setEditingColor(true)}>Change color</MenuButton>
      )}
      <MenuSubmit
        type="button"
        danger
        icon={<Trash2 size={14} />}
        onClick={() => {
          requestConfirm({
            title: "Remove tag from notes",
            message: `Remove "${tag.name}" from all notes?`,
            confirmLabel: "Remove from all notes",
            action: removeTagFromAllNotesAction,
            fields: [{ name: "tagId", value: tag.id }],
            onConfirm: onClose
          });
        }}
      >
        Remove all applied notes
      </MenuSubmit>
    </>
  );
}

function TagColorField({
  initialColor = "",
  autoFocus = false
}: {
  initialColor?: string;
  autoFocus?: boolean;
}) {
  const [color, setColor] = useState(initialColor);

  return (
    <div className="space-y-2">
      <input
        autoFocus={autoFocus}
        name="color"
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
        value={color}
        maxLength={30}
        placeholder="#0f766e or rgb(15, 118, 110)"
        onChange={(event) => setColor(event.target.value)}
      />
      <div className="grid grid-cols-6 gap-1">
        {tagColorPresets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={
              "h-6 rounded-md border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary " +
              (color.trim().toLowerCase() === preset ? "border-foreground" : "border-border")
            }
            style={{ backgroundColor: preset }}
            aria-label={`Use tag color ${preset}`}
            title={preset}
            onClick={() => setColor(preset)}
          />
        ))}
      </div>
    </div>
  );
}

function ExplorerLink({
  href,
  label,
  active,
  color,
  icon,
  detail,
  pinned,
  dropState,
  dragging,
  depth = 0
}: {
  href?: string;
  label: string;
  active: boolean;
  color?: string | null;
  icon?: ReactNode;
  detail?: string;
  pinned?: boolean;
  dropState?: "valid" | "invalid";
  dragging?: boolean;
  depth?: number;
}) {
  const stateClass = dragging
    ? "opacity-45"
    : dropState === "valid"
      ? "bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]"
      : dropState === "invalid"
        ? "bg-red-500/10 text-red-200 shadow-[inset_0_0_0_1px_rgb(248_113_113/0.45)]"
        : active
          ? "bg-muted text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground";
  const className =
    "group relative grid min-h-8 grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-md py-1.5 transition " +
    (pinned ? "pr-7 " : "pr-2 ") +
    stateClass;
  const content = (
    <>
      <span className="relative flex h-4 w-4 items-center justify-center">
        {color ? <span className="absolute h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{label}</span>
        {detail ? <span className="block truncate text-[11px] text-muted-foreground">{detail}</span> : null}
      </span>
      {pinned ? (
        <Pin
          size={11}
          className="absolute right-2 top-1.5 fill-primary text-primary"
          aria-label="Pinned"
        />
      ) : null}
    </>
  );

  if (!href) {
    return (
      <div className={className} style={{ paddingLeft: `${8 + depth * 14}px` }} title={label}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      title={label}
    >
      {content}
    </Link>
  );
}

function TagExplorerRow({
  tag,
  active,
  onRequestDelete,
  onContextMenu
}: {
  tag: TagSummary;
  active: boolean;
  onRequestDelete: (tag: TagSummary) => void;
  onContextMenu: (event: MouseEvent) => void;
}) {
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_28px] items-center gap-1" onContextMenu={onContextMenu}>
      <ExplorerLink href={`/?tag=${tag.id}`} label={tag.name} active={active} color={tag.color} />
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
        aria-label={`Delete tag ${tag.name}`}
        title="Delete tag"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRequestDelete(tag);
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

function DeleteTagDialog({ tag, onClose }: { tag: TagSummary; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-tag-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-md border border-border bg-panel-strong p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10 text-red-400">
            <Trash2 size={16} />
          </span>
          <div className="min-w-0">
            <h2 id="delete-tag-title" className="text-sm font-semibold text-foreground">
              Delete tag
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Delete "{tag.name}" and remove it from every note?
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            onClick={onClose}
          >
            Cancel
          </button>
          <form action={deleteTagAction} onSubmit={onClose}>
            <input type="hidden" name="tagId" value={tag.id} />
            <button className="h-8 rounded-md bg-red-500 px-3 text-xs font-semibold text-white hover:bg-red-600">
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ConfirmActionDialog({
  confirmAction,
  onClose
}: {
  confirmAction: ConfirmActionState;
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <Dialog
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10 text-red-400">
            <Trash2 size={16} />
          </span>
          <div className="min-w-0">
            <DialogHeader>
              <DialogTitle>{confirmAction.title}</DialogTitle>
              <DialogDescription>{confirmAction.message}</DialogDescription>
            </DialogHeader>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <form
            action={confirmAction.action}
            onSubmit={() => {
              confirmAction.onConfirm?.();
              onClose();
            }}
          >
            {confirmAction.fields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            <Button variant="destructive" size="sm" type="submit">
              {confirmAction.confirmLabel}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LifecycleNavigation({
  activeView,
  hasTrashItems,
  requestConfirm
}: {
  activeView: "active" | "archive" | "trash";
  hasTrashItems: boolean;
  requestConfirm: (confirmAction: ConfirmActionState) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1 shadow-sm">
        <LifecycleLink href="/" label="Active" active={activeView === "active"} icon={<FileText size={13} />} />
        <LifecycleLink href="/archive" label="Archive" active={activeView === "archive"} icon={<Archive size={13} />} />
        <LifecycleLink href="/trash" label="Trash" active={activeView === "trash"} icon={<Trash2 size={13} />} />
      </div>
      {activeView === "trash" && hasTrashItems ? (
        <button
          type="button"
          className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-red-500/40 px-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          onClick={() => {
            requestConfirm({
              title: "Delete all Trash",
              message: "Delete all Trash items forever? This cannot be undone.",
              confirmLabel: "Delete all",
              action: deleteAllTrashAction,
              fields: [],
              onConfirm: () => notify(notificationCopy.lifecycleTrashEmptied())
            });
          }}
        >
          <Trash2 size={13} />
          Delete all Trash
        </button>
      ) : null}
    </div>
  );
}

function LifecycleLink({
  href,
  label,
  active,
  icon
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition " +
        (active ? "bg-muted text-foreground shadow-[inset_0_-2px_0_hsl(var(--primary))]" : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function getNoteDetail(note: NoteSummary, workspaceView: "active" | "archive" | "trash") {
  if (workspaceView === "trash") {
    return getTrashRetentionLabel(note.deletedAt);
  }

  if (workspaceView === "archive") {
    return `Archived - ${formatNoteTimestamp(note.updatedAt)}`;
  }

  return note.contentText || formatNoteTimestamp(note.updatedAt);
}

function getFolderDetail(folder: FolderTreeNode, workspaceView: "active" | "archive" | "trash") {
  if (workspaceView === "trash") {
    return getTrashRetentionLabel(folder.deletedAt);
  }

  if (workspaceView === "archive") {
    return "Archived folder";
  }

  return undefined;
}

function getTrashRetentionLabel(deletedAt: string | null) {
  if (!deletedAt) {
    return "Pending cleanup";
  }

  const deletedTime = new Date(deletedAt).getTime();

  if (Number.isNaN(deletedTime)) {
    return "Pending cleanup";
  }

  const cleanupTime = deletedTime + 30 * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(0, Math.ceil((cleanupTime - Date.now()) / (24 * 60 * 60 * 1000)));

  return `${daysRemaining} days remaining`;
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {title}
    </div>
  );
}

function searchNotes(notes: NoteSummary[], searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(query) ||
      note.contentText.toLowerCase().includes(query)
  );
}

function filterEmptyFolders(tree: { folders: FolderTreeNode[]; unfiledNotes: NoteSummary[] }) {
  return {
    folders: tree.folders.map(filterFolderNode).filter((folder): folder is FolderTreeNode => Boolean(folder)),
    unfiledNotes: tree.unfiledNotes
  };
}

function filterFolderNode(folder: FolderTreeNode): FolderTreeNode | null {
  const children = folder.children.map(filterFolderNode).filter((child): child is FolderTreeNode => Boolean(child));

  if (children.length === 0 && folder.notes.length === 0) {
    return null;
  }

  return {
    ...folder,
    children
  };
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
      {children}
    </Link>
  );
}

function RenameForm({
  action,
  idName,
  idValue,
  fieldName,
  defaultName,
  onSubmit
}: {
  action: (formData: FormData) => void | Promise<void>;
  idName: string;
  idValue: string;
  fieldName: "name" | "title";
  defaultName: string;
  onSubmit: () => void;
}) {
  return (
    <form action={action} className="p-1" onSubmit={onSubmit}>
      <input type="hidden" name={idName} value={idValue} />
      <input
        autoFocus
        name={fieldName}
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
        defaultValue={defaultName}
        maxLength={200}
        required
      />
      <button className="mt-1 w-full rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground">
        Save rename
      </button>
    </form>
  );
}

function MenuButton({
  children,
  disabled,
  danger,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "flex w-full items-center rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55 " +
        (danger ? "text-red-400" : "")
      }
    >
      {children}
    </button>
  );
}

function MenuSubmit({
  children,
  icon,
  danger,
  type,
  onClick
}: {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground " +
        (danger ? "text-red-400" : "")
      }
    >
      {icon}
      {children}
    </button>
  );
}
