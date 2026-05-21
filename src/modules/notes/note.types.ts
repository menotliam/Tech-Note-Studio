import type { EditorDocument } from "@/modules/editor/editor.types";

export type NoteSummary = {
  id: string;
  title: string;
  contentText: string;
  isPinned: boolean;
  isArchived: boolean;
  updatedAt: string;
};

export type NoteDetail = NoteSummary & {
  workspaceId: string;
  contentJson: EditorDocument;
  schemaVersion: number;
};
