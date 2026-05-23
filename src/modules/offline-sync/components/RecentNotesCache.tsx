"use client";

import { useEffect } from "react";
import type { NoteSummary } from "@/modules/notes/note.types";
import { getCachedNote, putCachedNotes } from "../indexeddb.client";

export function RecentNotesCache({ notes }: { notes: NoteSummary[] }) {
  useEffect(() => {
    void cacheRecentNotes(notes).catch(() => {
      // IndexedDB can be unavailable in private modes; offline cache should never block the app.
    });
  }, [notes]);

  return null;
}

async function cacheRecentNotes(notes: NoteSummary[]) {
  const cachedNotes = await Promise.all(
    notes.map(async (note) => {
      const existingNote = await getCachedNote(note.id);
      const hasLocalChanges = existingNote?.syncStatus === "local_pending";

      return {
        noteId: note.id,
        workspaceId: existingNote?.workspaceId ?? null,
        title: hasLocalChanges ? existingNote.title : note.title,
        contentJson: existingNote?.contentJson ?? null,
        contentText: hasLocalChanges ? existingNote.contentText : note.contentText,
        updatedAt: hasLocalChanges ? existingNote.updatedAt : note.updatedAt,
        localUpdatedAt: existingNote?.localUpdatedAt ?? new Date().toISOString(),
        syncStatus: existingNote?.syncStatus ?? "synced"
      };
    })
  );

  await putCachedNotes(cachedNotes);
}
