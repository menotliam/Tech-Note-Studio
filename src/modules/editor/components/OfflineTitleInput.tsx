"use client";

import { useEffect, useRef } from "react";
import type { EditorDocument } from "@/modules/editor/editor.types";
import { createUpdateNoteOperation, enqueueSyncOperation, getCachedNote, putCachedNote } from "@/modules/offline-sync/indexeddb.client";

export function OfflineTitleInput({
  noteId,
  workspaceId,
  initialTitle,
  initialContent,
  initialContentText,
  updatedAt
}: {
  noteId: string;
  workspaceId: string;
  initialTitle: string;
  initialContent: EditorDocument;
  initialContentText: string;
  updatedAt: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cacheTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cacheTimerRef.current) {
        window.clearTimeout(cacheTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleNoteSaveStart(event: Event) {
      const detail = (event as CustomEvent<{ noteId?: string }>).detail;

      if (detail?.noteId !== noteId || !cacheTimerRef.current) {
        return;
      }

      window.clearTimeout(cacheTimerRef.current);
      cacheTimerRef.current = null;
    }

    window.addEventListener("technote:note-save-start", handleNoteSaveStart);
    return () => window.removeEventListener("technote:note-save-start", handleNoteSaveStart);
  }, [noteId]);

  useEffect(() => {
    let cancelled = false;

    void getCachedNote(noteId)
      .then((cachedNote) => {
        if (cancelled || cachedNote?.syncStatus !== "local_pending" || !inputRef.current) {
          return;
        }

        inputRef.current.value = cachedNote.title;
        window.dispatchEvent(new CustomEvent("technote:note-dirty", { detail: { noteId, dirty: true } }));
      })
      .catch(() => {
        // Local draft hydration is best-effort.
      });

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  return (
    <input
      ref={inputRef}
      name="title"
      data-note-id={noteId}
      className="w-full bg-transparent text-4xl font-bold outline-none"
      defaultValue={initialTitle}
      aria-label="Note title"
      onChange={(event) => {
        const title = event.target.value;
        window.dispatchEvent(new CustomEvent("technote:note-dirty", { detail: { noteId, dirty: true } }));

        if (cacheTimerRef.current) {
          window.clearTimeout(cacheTimerRef.current);
        }

        cacheTimerRef.current = window.setTimeout(() => {
          void cacheTitleChange({
            noteId,
            workspaceId,
            title,
            initialContent,
            initialContentText,
            updatedAt
          });
        }, 400);
      }}
    />
  );
}

async function cacheTitleChange({
  noteId,
  workspaceId,
  title,
  initialContent,
  initialContentText,
  updatedAt
}: {
  noteId: string;
  workspaceId: string;
  title: string;
  initialContent: EditorDocument;
  initialContentText: string;
  updatedAt: string;
}) {
  const cachedNote = await getCachedNote(noteId);
  const baseNote = cachedNote ?? {
    noteId,
    workspaceId,
    title,
    contentJson: initialContent,
    contentText: initialContentText,
    updatedAt,
    localUpdatedAt: new Date().toISOString(),
    syncStatus: "synced" as const
  };

  if (!cachedNote) {
    await putCachedNote(baseNote);
  }

  const shouldQueueSync = isOffline();
  const note = {
    ...baseNote,
    title,
    localUpdatedAt: new Date().toISOString(),
    syncStatus: "local_pending" as const
  };

  await putCachedNote(note);
  if (shouldQueueSync) {
    await enqueueSyncOperation(createUpdateNoteOperation(note));
  }
}

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
