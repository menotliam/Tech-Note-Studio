import type { SupabaseClient } from "@supabase/supabase-js";

type NoteFileRow = {
  storage_bucket: string;
  storage_path: string;
};

export async function hardDeleteTrashedNotesByIds(
  supabase: SupabaseClient,
  noteIds: string[],
  ownerId?: string
) {
  if (noteIds.length === 0) {
    return { deletedNotes: 0, deletedFiles: 0 };
  }

  let filesQuery = supabase
    .from("note_files")
    .select("storage_bucket, storage_path")
    .in("note_id", noteIds);

  if (ownerId) {
    filesQuery = filesQuery.eq("owner_id", ownerId);
  }

  const { data: files, error: filesError } = await filesQuery;

  if (filesError) {
    throw filesError;
  }

  await removeStorageFiles(supabase, files as NoteFileRow[]);

  let deleteQuery = supabase
    .from("notes")
    .delete()
    .in("id", noteIds)
    .not("deleted_at", "is", null);

  if (ownerId) {
    deleteQuery = deleteQuery.eq("owner_id", ownerId);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    throw deleteError;
  }

  return {
    deletedNotes: noteIds.length,
    deletedFiles: files?.length ?? 0
  };
}

export async function hardDeleteTrashedFoldersByIds(
  supabase: SupabaseClient,
  folderIds: string[],
  ownerId?: string
) {
  const pendingIds = new Set(folderIds);
  let deletedFolders = 0;

  if (pendingIds.size === 0) {
    return { deletedFolders: 0 };
  }

  while (pendingIds.size > 0) {
    const batchIds = [...pendingIds];
    let childrenQuery = supabase
      .from("folders")
      .select("parent_id")
      .in("parent_id", batchIds);

    if (ownerId) {
      childrenQuery = childrenQuery.eq("owner_id", ownerId);
    }

    const { data: children, error: childrenError } = await childrenQuery;

    if (childrenError) {
      throw childrenError;
    }

    const parentIdsWithChildren = new Set(
      (children as Array<{ parent_id: string | null }>).map((child) => child.parent_id).filter(Boolean)
    );
    const leafIds = batchIds.filter((folderId) => !parentIdsWithChildren.has(folderId));

    if (leafIds.length === 0) {
      break;
    }

    let query = supabase
      .from("folders")
      .delete()
      .in("id", leafIds)
      .not("deleted_at", "is", null);

    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    deletedFolders += leafIds.length;
    leafIds.forEach((folderId) => pendingIds.delete(folderId));
  }

  return { deletedFolders };
}

async function removeStorageFiles(supabase: SupabaseClient, files: NoteFileRow[]) {
  const filesByBucket = new Map<string, string[]>();

  for (const file of files) {
    const paths = filesByBucket.get(file.storage_bucket) ?? [];
    paths.push(file.storage_path);
    filesByBucket.set(file.storage_bucket, paths);
  }

  for (const [bucket, paths] of filesByBucket.entries()) {
    if (paths.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(bucket).remove(paths);

    if (error) {
      throw error;
    }
  }
}
