import type { EditorDocument } from "@/modules/editor/editor.types";

export type NoteSummary = {
  id: string;
  title: string;
  contentText: string;
  isPinned: boolean;
  isArchived: boolean;
  updatedAt: string;
  folderId: string | null;
  tagIds: string[];
};

export type NoteDetail = NoteSummary & {
  workspaceId: string;
  contentJson: EditorDocument;
  schemaVersion: number;
  folderId: string | null;
  tagIds: string[];
};
