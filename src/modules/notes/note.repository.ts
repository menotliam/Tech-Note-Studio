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
  deleted_at: string | null;
  updated_at: string;
};

const NOTE_SELECT =
  "id, workspace_id, title, content_json, content_text, schema_version, is_pinned, is_archived, deleted_at, updated_at";

function toNoteSummary(row: NoteRow): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    contentText: row.content_text ?? "",
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
    folderId: null,
    tagIds: []
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
    .select(NOTE_SELECT)
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

  let notes = await attachNoteOrganization(supabase, ownerId, (data as NoteRow[]).map(toNoteSummary));

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

export async function listArchivedNotes(
  supabase: SupabaseClient,
  ownerId: string
): Promise<NoteSummary[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .eq("is_archived", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return attachNoteOrganization(supabase, ownerId, (data as NoteRow[]).map(toNoteSummary));
}

export async function listTrashedNotes(
  supabase: SupabaseClient,
  ownerId: string
): Promise<NoteSummary[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("owner_id", ownerId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw error;
  }

  return attachNoteOrganization(supabase, ownerId, (data as NoteRow[]).map(toNoteSummary));
}

async function attachNoteOrganization(
  supabase: SupabaseClient,
  ownerId: string,
  notes: NoteSummary[]
): Promise<NoteSummary[]> {
  if (notes.length === 0) {
    return notes;
  }

  const noteIds = notes.map((note) => note.id);
  const [folderResult, tagResult] = await Promise.all([
    supabase
      .from("note_folders")
      .select("note_id, folder_id")
      .eq("owner_id", ownerId)
      .in("note_id", noteIds),
    supabase
      .from("note_tags")
      .select("note_id, tag_id")
      .eq("owner_id", ownerId)
      .in("note_id", noteIds)
  ]);

  if (folderResult.error) {
    throw folderResult.error;
  }

  if (tagResult.error) {
    throw tagResult.error;
  }

  const folderByNoteId = new Map(
    (folderResult.data as Array<{ note_id: string; folder_id: string }>).map((row) => [row.note_id, row.folder_id])
  );
  const tagsByNoteId = new Map<string, string[]>();

  for (const row of tagResult.data as Array<{ note_id: string; tag_id: string }>) {
    const tagIds = tagsByNoteId.get(row.note_id) ?? [];
    tagIds.push(row.tag_id);
    tagsByNoteId.set(row.note_id, tagIds);
  }

  return notes.map((note) => ({
    ...note,
    folderId: folderByNoteId.get(note.id) ?? null,
    tagIds: tagsByNoteId.get(note.id) ?? []
  }));
}

export async function getNoteById(
  supabase: SupabaseClient,
  ownerId: string,
  noteId: string
): Promise<NoteDetail | null> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
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
