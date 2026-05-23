import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditorDocument } from "@/modules/editor/editor.types";
import { getNoteFolderId, getNoteTagIds } from "@/modules/organization/organization.repository";
import type { NoteDetail, NoteSummary } from "./note.types";

type NoteRow = {
  id: string;
  workspace_id: string;
  title: string;
  content_json: EditorDocument;
  content_text: string | null;
  schema_version: number;
  is_pinned: boolean;
  is_archived: boolean;
  updated_at: string;
};

function toNoteSummary(row: NoteRow): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    contentText: row.content_text ?? "",
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    updatedAt: row.updated_at
  };
}

function toNoteDetailBase(row: NoteRow): Omit<NoteDetail, "folderId" | "tagIds"> {
  return {
    ...toNoteSummary(row),
    workspaceId: row.workspace_id,
    contentJson: row.content_json,
    schemaVersion: row.schema_version
  };
}

export async function listNotes(
  supabase: SupabaseClient,
  ownerId: string,
  search?: string,
  filters?: {
    folderId?: string;
    tagId?: string;
  }
): Promise<NoteSummary[]> {
  let query = supabase
    .from("notes")
    .select("id, workspace_id, title, content_json, content_text, schema_version, is_pinned, is_archived, updated_at")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (search) {
    const escapedSearch = search.replace(/[%_]/g, "\\$&");
    query = query.or(`title.ilike.%${escapedSearch}%,content_text.ilike.%${escapedSearch}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let notes = (data as NoteRow[]).map(toNoteSummary);

  if (filters?.folderId) {
    const { data: noteFolders, error: folderError } = await supabase
      .from("note_folders")
      .select("note_id")
      .eq("owner_id", ownerId)
      .eq("folder_id", filters.folderId);

    if (folderError) {
      throw folderError;
    }

    const allowedNoteIds = new Set((noteFolders as Array<{ note_id: string }>).map((row) => row.note_id));
    notes = notes.filter((note) => allowedNoteIds.has(note.id));
  }

  if (filters?.tagId) {
    const { data: noteTags, error: tagError } = await supabase
      .from("note_tags")
      .select("note_id")
      .eq("owner_id", ownerId)
      .eq("tag_id", filters.tagId);

    if (tagError) {
      throw tagError;
    }

    const allowedNoteIds = new Set((noteTags as Array<{ note_id: string }>).map((row) => row.note_id));
    notes = notes.filter((note) => allowedNoteIds.has(note.id));
  }

  return notes;
}

export async function getNoteById(
  supabase: SupabaseClient,
  ownerId: string,
  noteId: string
): Promise<NoteDetail | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, workspace_id, title, content_json, content_text, schema_version, is_pinned, is_archived, updated_at")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [folderId, tagIds] = await Promise.all([
    getNoteFolderId(supabase, ownerId, noteId),
    getNoteTagIds(supabase, ownerId, noteId)
  ]);

  return {
    ...toNoteDetailBase(data as NoteRow),
    folderId,
    tagIds
  };
}
