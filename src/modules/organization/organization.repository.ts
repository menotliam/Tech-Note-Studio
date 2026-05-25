import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderSummary, TagSummary } from "./organization.types";

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  deleted_at: string | null;
};

const FOLDER_SELECT = "id, name, parent_id, is_pinned, is_archived, deleted_at";

type TagRow = {
  id: string;
  name: string;
  color: string | null;
};

export async function listFolders(
  supabase: SupabaseClient,
  ownerId: string,
  workspaceId: string
): Promise<FolderSummary[]> {
  const { data, error } = await supabase
    .from("folders")
    .select(FOLDER_SELECT)
    .eq("owner_id", ownerId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as FolderRow[]).map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    isPinned: folder.is_pinned,
    isArchived: folder.is_archived,
    deletedAt: folder.deleted_at
  }));
}

export async function listArchivedFolders(
  supabase: SupabaseClient,
  ownerId: string,
  workspaceId: string
): Promise<FolderSummary[]> {
  return listFoldersByLifecycle(supabase, ownerId, workspaceId, "archive");
}

export async function listTrashedFolders(
  supabase: SupabaseClient,
  ownerId: string,
  workspaceId: string
): Promise<FolderSummary[]> {
  return listFoldersByLifecycle(supabase, ownerId, workspaceId, "trash");
}

async function listFoldersByLifecycle(
  supabase: SupabaseClient,
  ownerId: string,
  workspaceId: string,
  lifecycle: "archive" | "trash"
): Promise<FolderSummary[]> {
  let query = supabase
    .from("folders")
    .select(FOLDER_SELECT)
    .eq("owner_id", ownerId)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (lifecycle === "archive") {
    query = query.is("deleted_at", null).eq("is_archived", true);
  } else {
    query = query.not("deleted_at", "is", null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as FolderRow[]).map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    isPinned: folder.is_pinned,
    isArchived: folder.is_archived,
    deletedAt: folder.deleted_at
  }));
}

export async function listTags(
  supabase: SupabaseClient,
  ownerId: string,
  workspaceId: string
): Promise<TagSummary[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("owner_id", ownerId)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as TagRow[]).map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color
  }));
}

export async function getNoteFolderId(
  supabase: SupabaseClient,
  ownerId: string,
  noteId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("note_folders")
    .select("folder_id")
    .eq("owner_id", ownerId)
    .eq("note_id", noteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.folder_id ?? null;
}

export async function getNoteTagIds(
  supabase: SupabaseClient,
  ownerId: string,
  noteId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("note_tags")
    .select("tag_id")
    .eq("owner_id", ownerId)
    .eq("note_id", noteId);

  if (error) {
    throw error;
  }

  return (data as Array<{ tag_id: string }>).map((row) => row.tag_id);
}
