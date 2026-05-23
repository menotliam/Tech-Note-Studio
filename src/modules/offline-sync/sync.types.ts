import type { EditorDocument } from "@/modules/editor/editor.types";

export type CachedNote = {
  noteId: string;
  workspaceId: string | null;
  title: string;
  contentJson: EditorDocument | null;
  contentText: string;
  updatedAt: string;
  localUpdatedAt: string;
  syncStatus: "synced" | "local_pending" | "conflict";
};

export type SyncQueueOperation = {
  operationId: string;
  operationType: "UPDATE_NOTE" | "CREATE_NOTE" | "ARCHIVE_NOTE" | "DELETE_NOTE" | "UPDATE_NOTE_METADATA";
  entityType: "note";
  entityId: string;
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
};
