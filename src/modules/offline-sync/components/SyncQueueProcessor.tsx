"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteSyncOperation,
  enqueueSyncOperation,
  listSyncOperations,
  markCachedNoteSynced
} from "../indexeddb.client";
import type { CachedNote, SyncQueueOperation } from "../sync.types";
import { publishNetworkStatus, useNetworkStatus } from "../hooks/useNetworkStatus";

export function SyncQueueProcessor() {
  const isOnline = useNetworkStatus();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || isProcessingRef.current) {
      return;
    }

    const runProcessor = () => {
      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      void processSyncQueue()
        .catch(() => {
          publishNetworkStatus(false);
          // Sync is best-effort; queued operations stay in IndexedDB for the next online pass.
        })
        .finally(() => {
          isProcessingRef.current = false;
        });
    };

    runProcessor();
    window.addEventListener("tech-note-studio:sync-queue-updated", runProcessor);

    return () => {
      window.removeEventListener("tech-note-studio:sync-queue-updated", runProcessor);
    };
  }, [isOnline]);

  return null;
}

async function processSyncQueue() {
  const operations = await listSyncOperations();

  if (operations.length === 0) {
    return;
  }

  const supabase = createSupabaseBrowserClient();

  for (const operation of operations) {
    if (operation.operationType !== "UPDATE_NOTE") {
      continue;
    }

    const note = operation.payload as CachedNote;

    if (!note.workspaceId || !note.contentJson) {
      await deleteSyncOperation(operation.operationId);
      continue;
    }

    const { error } = await supabase
      .from("notes")
      .update({
        title: note.title,
        content_json: note.contentJson,
        content_text: note.contentText,
        schema_version: note.contentJson.schemaVersion ?? 1,
        last_synced_at: new Date().toISOString()
      })
      .eq("id", note.noteId)
      .eq("workspace_id", note.workspaceId);

    if (error) {
      publishNetworkStatus(false);
      await enqueueSyncOperation({
        ...operation,
        retryCount: operation.retryCount + 1,
        lastError: error.message
      } satisfies SyncQueueOperation);
      continue;
    }

    publishNetworkStatus(true);
    await deleteSyncOperation(operation.operationId);
    await markCachedNoteSynced(note.noteId);
  }
}
