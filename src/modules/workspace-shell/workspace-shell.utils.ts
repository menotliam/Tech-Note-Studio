import type { EditorNode, EditorTextNode } from "@/modules/editor/editor.types";
import type { FolderSummary, TagSummary } from "@/modules/organization/organization.types";
import type { NoteSummary } from "@/modules/notes/note.types";
import type { CurrentNoteForChrome, OutlineItem } from "./workspace-shell.types";

export type FolderTreeNode = FolderSummary & {
  children: FolderTreeNode[];
  notes: NoteSummary[];
};

export function buildFolderTree(folders: FolderSummary[], notes: NoteSummary[]) {
  const nodes = new Map<string, FolderTreeNode>();
  const rootFolders: FolderTreeNode[] = [];

  folders.forEach((folder) => {
    nodes.set(folder.id, {
      ...folder,
      children: [],
      notes: []
    });
  });

  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  const unfiledNotes: NoteSummary[] = [];

  notes.forEach((note) => {
    if (note.folderId && nodes.has(note.folderId)) {
      nodes.get(note.folderId)?.notes.push(note);
    } else {
      unfiledNotes.push(note);
    }
  });

  return {
    folders: sortFolderTree(rootFolders),
    unfiledNotes: [...unfiledNotes].sort(compareNotes)
  };
}

export function getPrimaryTagColor(note: NoteSummary, tags: TagSummary[]) {
  const primaryTagId = note.tagIds[0];
  const tag = tags.find((candidate) => candidate.id === primaryTagId);

  return tag?.color ?? null;
}

export function getNoteTagNames(note: NoteSummary, tags: TagSummary[]) {
  const tagById = new Map(tags.map((tag) => [tag.id, tag.name]));
  return note.tagIds.map((tagId) => tagById.get(tagId)).filter((name): name is string => Boolean(name));
}

export function extractOutlineItems(note?: CurrentNoteForChrome | null): OutlineItem[] {
  if (!note?.contentJson.content?.length) {
    return [];
  }

  return note.contentJson.content.flatMap((node, index) => extractHeading(node, index));
}

export function countApproximateEditorLines(note?: CurrentNoteForChrome | null) {
  if (!note?.contentJson.content?.length) {
    return 0;
  }

  return note.contentJson.content.reduce((count, node) => count + countNodeLines(node), 0);
}

function sortFolderTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
  return nodes
    .sort(compareFolders)
    .map((node) => ({
      ...node,
      children: sortFolderTree(node.children),
      notes: [...node.notes].sort(compareNotes)
    }));
}

function compareFolders(a: FolderTreeNode, b: FolderTreeNode) {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
}

function compareNotes(a: NoteSummary, b: NoteSummary) {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  return a.title.localeCompare(b.title);
}

function extractHeading(node: EditorNode | EditorTextNode, index: number): OutlineItem[] {
  if (!("type" in node) || node.type !== "heading") {
    return [];
  }

  const level = Number((node.attrs ?? {}).level);

  if (level !== 1 && level !== 2 && level !== 3) {
    return [];
  }

  const text = extractInlineText(node).trim();

  if (!text) {
    return [];
  }

  return [
    {
      id: `${index}-${slugify(text)}`,
      level,
      text
    }
  ];
}

function countNodeLines(node: EditorNode | EditorTextNode): number {
  if ("text" in node && typeof node.text === "string") {
    return Math.max(1, node.text.split("\n").length);
  }

  if (!("content" in node) || !node.content?.length) {
    return 1;
  }

  return Math.max(1, node.content.reduce((count, child) => count + countNodeLines(child), 0));
}

function extractInlineText(node: EditorNode | EditorTextNode): string {
  if ("text" in node && typeof node.text === "string") {
    return node.text;
  }

  if (!("content" in node) || !node.content?.length) {
    return "";
  }

  return node.content.map((child) => extractInlineText(child)).join("");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}
