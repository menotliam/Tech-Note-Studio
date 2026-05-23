import type { CachedNote, SyncQueueOperation } from "./sync.types";

const databaseName = "tech-note-studio";
const databaseVersion = 1;
const notesStoreName = "notes_cache";
const queueStoreName = "sync_queue";

export async function putCachedNote(note: CachedNote) {
  if (!canUseIndexedDb()) {
    return;
  }

  const database = await openOfflineDatabase();
  await putRecord(database, notesStoreName, note);
  database.close();
}

export async function putCachedNotes(notes: CachedNote[]) {
  if (!canUseIndexedDb() || notes.length === 0) {
    return;
  }

  const database = await openOfflineDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(notesStoreName, "readwrite");
    const store = transaction.objectStore(notesStoreName);
    notes.forEach((note) => store.put(note));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  database.close();
}

export async function getCachedNote(noteId: string): Promise<CachedNote | null> {
  if (!canUseIndexedDb()) {
    return null;
  }

  const database = await openOfflineDatabase();
  const note = await getRecord<CachedNote>(database, notesStoreName, noteId);
  database.close();
  return note;
}

export async function enqueueSyncOperation(operation: SyncQueueOperation) {
  if (!canUseIndexedDb()) {
    return;
  }

  const database = await openOfflineDatabase();
  await putRecord(database, queueStoreName, operation);
  database.close();
  dispatchQueueUpdated();
}

export async function listSyncOperations(): Promise<SyncQueueOperation[]> {
  if (!canUseIndexedDb()) {
    return [];
  }

  const database = await openOfflineDatabase();
  const operations = await getAllRecords<SyncQueueOperation>(database, queueStoreName);
  database.close();
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function deleteSyncOperation(operationId: string) {
  if (!canUseIndexedDb()) {
    return;
  }

  const database = await openOfflineDatabase();
  await deleteRecord(database, queueStoreName, operationId);
  database.close();
}

export async function markCachedNoteSynced(noteId: string) {
  const note = await getCachedNote(noteId);

  if (!note) {
    return;
  }

  await putCachedNote({
    ...note,
    syncStatus: "synced",
    updatedAt: new Date().toISOString(),
    localUpdatedAt: new Date().toISOString()
  });
}

export function createUpdateNoteOperation(note: CachedNote): SyncQueueOperation {
  return {
    operationId: `UPDATE_NOTE:${note.noteId}`,
    operationType: "UPDATE_NOTE",
    entityType: "note",
    entityId: note.noteId,
    payload: note,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null
  };
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function dispatchQueueUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tech-note-studio:sync-queue-updated"));
  }
}

function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(notesStoreName)) {
        database.createObjectStore(notesStoreName, { keyPath: "noteId" });
      }

      if (!database.objectStoreNames.contains(queueStoreName)) {
        database.createObjectStore(queueStoreName, { keyPath: "operationId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(database: IDBDatabase, storeName: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function getRecord<T>(database: IDBDatabase, storeName: string, key: string) {
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords<T>(database: IDBDatabase, storeName: string) {
  return new Promise<T[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[] | undefined) ?? []);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(database: IDBDatabase, storeName: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
