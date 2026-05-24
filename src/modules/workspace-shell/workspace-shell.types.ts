import type { EditorDocument } from "@/modules/editor/editor.types";

export type WorkspaceActivity = "explorer" | "search" | "templates" | "tags" | "export" | "settings";

export type OutlineItem = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
};

export type OpenNoteTab = {
  noteId: string;
  title: string;
  dirty: boolean;
  lastOpenedAt: string;
};

export type CurrentNoteForChrome = {
  id: string;
  title: string;
  contentJson: EditorDocument;
};
