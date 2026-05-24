import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderSummary, TagSummary } from "./organization.types";

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
};

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
    .select("id, name, parent_id")
    .eq("owner_id", ownerId)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as FolderRow[]).map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id
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
