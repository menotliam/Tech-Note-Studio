"use client";

import Link from "next/link";
import type { DragEvent as ReactDragEvent, MouseEvent, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
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
  Search,
  Tags,
  Trash2,
  Upload
} from "lucide-react";
import { MultiNoteExportForm } from "@/modules/export/components/MultiNoteExportForm";
import {
  archiveNoteAction,
  createBlankNoteAction,
  deleteNoteAction,
  renameNoteAction,
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
  pinFolderNotesAction,
  renameFolderAction,
  toggleTagOnNoteAction
} from "@/modules/organization/organization.actions";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import { createNoteFromTemplateAction } from "@/modules/templates/template.actions";
import type { TemplateSummary } from "@/modules/templates/template.types";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { removeOpenNoteTab } from "../open-tabs.client";
import { buildFolderTree, getPrimaryTagColor, type FolderTreeNode } from "../workspace-shell.utils";

type ContextMenuState =
  | { type: "note"; note: NoteSummary; x: number; y: number }
  | { type: "folder"; folder: FolderTreeNode; x: number; y: number }
  | null;

export function ExplorerPanel({
  notes,
  templates,
  folders,
  tags,
  selectedNote,
  searchQuery,
  activeFolderId,
  activeTagId,
  workspace
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
}) {
  const tree = buildFolderTree(folders, notes);
  const searchResults = useMemo(() => searchNotes(notes, searchQuery), [notes, searchQuery]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [, startTransition] = useTransition();

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

  function moveDroppedNoteToRoot(event: ReactDragEvent) {
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
  }

  function collapseAllFolders() {
    setCollapsedFolders(new Set(folders.map((folder) => folder.id)));
  }

  return (
    <aside
      className="border-r border-border bg-panel text-sm"
      data-explorer-panel
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
          className="hidden min-h-full space-y-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={moveDroppedNoteToRoot}
        >
          <div
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            onDragOver={(event) => event.preventDefault()}
            onDrop={moveDroppedNoteToRoot}
          >
            <Folder size={14} />
            <span className="truncate">{workspace.name}</span>
            <div className="ml-auto flex items-center gap-1">
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
            </div>
          </div>

          {creatingFolder ? (
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
            className="min-h-20 space-y-0.5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={moveDroppedNoteToRoot}
          >
            {tree.folders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                tags={tags}
                selectedNoteId={selectedNote?.id}
                activeFolderId={activeFolderId}
                collapsedFolders={collapsedFolders}
                setCollapsedFolders={setCollapsedFolders}
                moveNoteToFolder={moveNoteToFolder}
                moveFolderToParent={moveFolderToParent}
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
            {tree.unfiledNotes.map((note) => (
              <NoteNode
                key={note.id}
                note={note}
                tags={tags}
                active={selectedNote?.id === note.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ type: "note", note, x: event.clientX, y: event.clientY });
                }}
              />
            ))}
          </div>
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
          <form action={createTagAction} className="grid grid-cols-[1fr_60px_auto] gap-2">
            <input
              name="name"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none"
              placeholder="New tag"
              maxLength={60}
              required
            />
            <input
              name="color"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs outline-none"
              placeholder="#"
              maxLength={30}
            />
            <button className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted">Add</button>
          </form>
          <div className="space-y-1">
            {tags.map((tag) => (
              <ExplorerLink
                key={tag.id}
                href={`/?tag=${tag.id}`}
                label={tag.name}
                active={activeTagId === tag.id}
                color={tag.color}
              />
            ))}
          </div>
        </section>

        <section data-activity-panel="export" className="hidden">
          <PanelTitle icon={<Upload size={14} />} title="Export Cart" />
          {notes.length > 0 ? <MultiNoteExportForm notes={notes} /> : null}
        </section>
      </div>

      {contextMenu ? (
        <ExplorerContextMenu
          menu={contextMenu}
          tags={tags}
          activeNoteId={selectedNote?.id}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </aside>
  );
}

function FolderNode({
  folder,
  tags,
  selectedNoteId,
  activeFolderId,
  collapsedFolders,
  setCollapsedFolders,
  moveNoteToFolder,
  moveFolderToParent,
  openContextMenu,
  openNoteContextMenu,
  depth = 0
}: {
  folder: FolderTreeNode;
  tags: TagSummary[];
  selectedNoteId?: string;
  activeFolderId?: string;
  collapsedFolders: Set<string>;
  setCollapsedFolders: (value: Set<string>) => void;
  moveNoteToFolder: (noteId: string, folderId: string | null) => void;
  moveFolderToParent: (folderId: string, parentId: string | null) => void;
  openContextMenu: (event: MouseEvent, folder: FolderTreeNode) => void;
  openNoteContextMenu: (event: MouseEvent, note: NoteSummary) => void;
  depth?: number;
}) {
  const collapsed = collapsedFolders.has(folder.id);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.setData("application/x-technote-folder", folder.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
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
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        openContextMenu(event, folder);
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_24px] items-center">
        <ExplorerLink
          href={`/?folder=${folder.id}`}
          label={folder.name}
          active={activeFolderId === folder.id}
          icon={<Folder size={14} />}
          depth={depth}
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
              collapsedFolders={collapsedFolders}
              setCollapsedFolders={setCollapsedFolders}
              moveNoteToFolder={moveNoteToFolder}
              moveFolderToParent={moveFolderToParent}
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
              depth={depth + 1}
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
  onContextMenu,
  depth = 0
}: {
  note: NoteSummary;
  tags: TagSummary[];
  active: boolean;
  onContextMenu: (event: MouseEvent) => void;
  depth?: number;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.setData("application/x-technote-note", note.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu(event);
      }}
    >
      <ExplorerLink
        href={`/notes/${note.id}`}
        label={note.title}
        active={active}
        color={getPrimaryTagColor(note, tags)}
        icon={<FileText size={14} />}
        detail={note.contentText || formatNoteTimestamp(note.updatedAt)}
        depth={depth}
      />
    </div>
  );
}

function ExplorerContextMenu({
  menu,
  tags,
  activeNoteId,
  onClose
}: {
  menu: NonNullable<ContextMenuState>;
  tags: TagSummary[];
  activeNoteId?: string;
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const style = {
    left: menu.x,
    top: menu.y
  };

  return (
    <div
      className="fixed z-50 min-w-56 rounded-md border border-border bg-panel-strong p-1 text-sm shadow-2xl"
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      {menu.type === "note" ? (
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
          <form action={archiveNoteAction} onSubmit={() => closeNoteLocally(menu.note.id, onClose)}>
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
          <form action={deleteNoteAction} onSubmit={() => closeNoteLocally(menu.note.id, onClose)}>
            <input type="hidden" name="noteId" value={menu.note.id} />
            <MenuSubmit danger icon={<Trash2 size={14} />}>Delete</MenuSubmit>
          </form>
        </>
      ) : (
        <>
          <form action={createNoteInFolderAction} onSubmit={onClose}>
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit icon={<FilePlus2 size={14} />}>New note</MenuSubmit>
          </form>
          <form action={pinFolderNotesAction} onSubmit={onClose}>
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit icon={<Pin size={14} />}>Pin notes recursively</MenuSubmit>
          </form>
          <form action={archiveFolderNotesAction} onSubmit={onClose}>
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit icon={<Archive size={14} />}>Archive notes recursively</MenuSubmit>
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
          <form action={deleteFolderAction} onSubmit={onClose}>
            <input type="hidden" name="folderId" value={menu.folder.id} />
            <MenuSubmit danger icon={<Trash2 size={14} />}>Delete folder</MenuSubmit>
          </form>
        </>
      )}
    </div>
  );
}

function closeNoteLocally(noteId: string, onClose: () => void) {
  removeOpenNoteTab(noteId);
  onClose();
}

function ExplorerLink({
  href,
  label,
  active,
  color,
  icon,
  detail,
  depth = 0
}: {
  href: string;
  label: string;
  active: boolean;
  color?: string | null;
  icon?: ReactNode;
  detail?: string;
  depth?: number;
}) {
  return (
    <Link
      href={href}
      className={
        "group grid min-h-8 grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-md py-1.5 pr-2 transition " +
        (active
          ? "bg-muted text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      title={label}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {color ? <span className="absolute h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{label}</span>
        {detail ? <span className="block truncate text-[11px] text-muted-foreground">{detail}</span> : null}
      </span>
    </Link>
  );
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
  danger
}: {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
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
