"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emptyEditorDocument } from "@/modules/editor/editor-documents";
import { getAuthedFoundation } from "@/modules/notes/note.actions";
import { hardDeleteTrashedFoldersByIds, hardDeleteTrashedNotesByIds } from "@/modules/notes/note-lifecycle.service";
import {
  assignParentFolderSchema,
  assignFolderSchema,
  assignTagSchema,
  createFolderSchema,
  createTagSchema,
  folderIdSchema,
  renameTagSchema,
  renameFolderSchema,
  tagIdSchema,
  updateTagColorSchema
} from "./organization.schemas";

export async function createFolderAction(formData: FormData) {
  const parsed = createFolderSchema.parse({
    name: formData.get("name"),
    parentId: formData.get("parentId") || undefined
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();

  if (parsed.parentId) {
    await assertOwnedFolder(supabase, user.id, parsed.parentId);
  }

  const { error } = await supabase.from("folders").insert({
    workspace_id: workspaceId,
    owner_id: user.id,
    name: parsed.name,
    parent_id: parsed.parentId ?? null
  });

  if (error) {
    throw error;
  }

  revalidatePath("/");
}

export async function renameFolderAction(formData: FormData) {
  const parsed = renameFolderSchema.parse({
    folderId: formData.get("folderId"),
    name: formData.get("name")
  });
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("folders")
    .update({ name: parsed.name })
    .eq("id", parsed.folderId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
}

export async function assignParentFolderByIdsAction(folderId: string, parentId: string | null) {
  const parsed = assignParentFolderSchema.parse({
    folderId,
    parentId: parentId ?? undefined
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  await assertOwnedFolder(supabase, user.id, parsed.folderId);

  if (parsed.parentId) {
    await assertOwnedFolder(supabase, user.id, parsed.parentId);
  }

  const folderIds = await getDescendantFolderIds(supabase, user.id, workspaceId, parsed.folderId);

  if (parsed.parentId && folderIds.includes(parsed.parentId)) {
    throw new Error("Cannot move a folder into itself or its children.");
  }

  const { error } = await supabase
    .from("folders")
    .update({ parent_id: parsed.parentId ?? null })
    .eq("id", parsed.folderId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
}

export async function createTagAction(formData: FormData) {
  const parsed = createTagSchema.parse({
    name: formData.get("name"),
    color: normalizeTagColorInput(formData.get("color"))
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();

  const { data: existingTags, error: existingTagsError } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("owner_id", user.id)
    .eq("workspace_id", workspaceId);

  if (existingTagsError) {
    throw existingTagsError;
  }

  const existingTag = (existingTags as Array<{ id: string; name?: string; color?: string | null }>).find(
    (tag) => typeof tag.name === "string" && tag.name.toLowerCase() === parsed.name.toLowerCase()
  );

  if (existingTag) {
    revalidateWorkspaceTagViews();
    return;
  }

  const color = parsed.color && !hasTagColorConflict(existingTags, parsed.color) ? parsed.color : null;

  const { error } = await supabase.from("tags").insert({
    workspace_id: workspaceId,
    owner_id: user.id,
    name: parsed.name,
    color
  });

  if (error) {
    if (error.code === "23505") {
      revalidateWorkspaceTagViews();
      return;
    }

    throw error;
  }

  revalidateWorkspaceTagViews();
}

export async function renameTagAction(formData: FormData) {
  const parsed = renameTagSchema.parse({
    tagId: formData.get("tagId"),
    name: formData.get("name")
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  await assertOwnedTag(supabase, user.id, parsed.tagId);

  const { data: existingTags, error: existingTagsError } = await supabase
    .from("tags")
    .select("id, name")
    .eq("owner_id", user.id)
    .eq("workspace_id", workspaceId);

  if (existingTagsError) {
    throw existingTagsError;
  }

  const nameConflict = (existingTags as Array<{ id: string; name?: string }>).some(
    (tag) =>
      tag.id !== parsed.tagId &&
      typeof tag.name === "string" &&
      tag.name.toLowerCase() === parsed.name.toLowerCase()
  );

  if (nameConflict) {
    revalidateWorkspaceTagViews();
    return;
  }

  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.name })
    .eq("owner_id", user.id)
    .eq("id", parsed.tagId);

  if (error) {
    if (error.code === "23505") {
      revalidateWorkspaceTagViews();
      return;
    }

    throw error;
  }

  revalidateWorkspaceTagViews();
}

export async function updateTagColorAction(formData: FormData) {
  const parsed = updateTagColorSchema.parse({
    tagId: formData.get("tagId"),
    color: normalizeTagColorInput(formData.get("color"))
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  await assertOwnedTag(supabase, user.id, parsed.tagId);

  const { data: existingTags, error: existingTagsError } = await supabase
    .from("tags")
    .select("id, color")
    .eq("owner_id", user.id)
    .eq("workspace_id", workspaceId);

  if (existingTagsError) {
    throw existingTagsError;
  }

  if (parsed.color && hasTagColorConflict(existingTags, parsed.color, parsed.tagId)) {
    revalidateWorkspaceTagViews();
    return;
  }

  const { error } = await supabase
    .from("tags")
    .update({ color: parsed.color || null })
    .eq("owner_id", user.id)
    .eq("id", parsed.tagId);

  if (error) {
    throw error;
  }

  revalidateWorkspaceTagViews();
}

export async function removeTagFromAllNotesAction(formData: FormData) {
  const tagId = tagIdSchema.parse(formData.get("tagId"));
  const { supabase, user } = await getAuthedFoundation();
  await assertOwnedTag(supabase, user.id, tagId);

  const { data: taggedNotes, error: taggedNotesError } = await supabase
    .from("note_tags")
    .select("note_id")
    .eq("owner_id", user.id)
    .eq("tag_id", tagId);

  if (taggedNotesError) {
    throw taggedNotesError;
  }

  const { error } = await supabase
    .from("note_tags")
    .delete()
    .eq("owner_id", user.id)
    .eq("tag_id", tagId);

  if (error) {
    throw error;
  }

  revalidateWorkspaceTagViews();

  for (const noteId of new Set((taggedNotes as Array<{ note_id: string }>).map((row) => row.note_id))) {
    revalidatePath(`/notes/${noteId}`);
  }
}

export async function deleteTagAction(formData: FormData) {
  const tagId = tagIdSchema.parse(formData.get("tagId"));
  const { supabase, user } = await getAuthedFoundation();
  await assertOwnedTag(supabase, user.id, tagId);

  const { data: taggedNotes, error: taggedNotesError } = await supabase
    .from("note_tags")
    .select("note_id")
    .eq("owner_id", user.id)
    .eq("tag_id", tagId);

  if (taggedNotesError) {
    throw taggedNotesError;
  }

  const { error: relationError } = await supabase
    .from("note_tags")
    .delete()
    .eq("owner_id", user.id)
    .eq("tag_id", tagId);

  if (relationError) {
    throw relationError;
  }

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("owner_id", user.id)
    .eq("id", tagId);

  if (error) {
    throw error;
  }

  revalidateWorkspaceTagViews();

  for (const noteId of new Set((taggedNotes as Array<{ note_id: string }>).map((row) => row.note_id))) {
    revalidatePath(`/notes/${noteId}`);
  }
}

function revalidateWorkspaceTagViews() {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/trash");
  revalidatePath("/notes/[noteId]", "page");
}

function hasTagColorConflict(
  tags: unknown,
  color: string,
  ignoredTagId?: string
) {
  const normalizedColor = color.trim().toLowerCase();

  if (!normalizedColor) {
    return false;
  }

  return (tags as Array<{ id: string; color?: string | null }>).some(
    (tag) => tag.id !== ignoredTagId && tag.color?.trim().toLowerCase() === normalizedColor
  );
}

function normalizeTagColorInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const color = value.trim();
  return color && color !== "#" ? color : undefined;
}

export async function createNoteInFolderAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  await assertOwnedFolder(supabase, user.id, folderId);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      owner_id: user.id,
      title: "Untitled",
      content_json: emptyEditorDocument,
      content_text: null,
      schema_version: 1
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const { error: folderError } = await supabase.from("note_folders").insert({
    note_id: data.id,
    folder_id: folderId,
    owner_id: user.id
  });

  if (folderError) {
    throw folderError;
  }

  revalidatePath("/");
  redirect(`/notes/${data.id}`);
}

export async function assignFolderToNoteAction(formData: FormData) {
  const rawFolderId = formData.get("folderId");
  const parsed = assignFolderSchema.parse({
    noteId: formData.get("noteId"),
    folderId: rawFolderId ? rawFolderId : undefined
  });
  const { supabase, user } = await getAuthedFoundation();
  await assertOwnedNote(supabase, user.id, parsed.noteId);

  const { error: deleteError } = await supabase
    .from("note_folders")
    .delete()
    .eq("owner_id", user.id)
    .eq("note_id", parsed.noteId);

  if (deleteError) {
    throw deleteError;
  }

  if (parsed.folderId) {
    await assertOwnedFolder(supabase, user.id, parsed.folderId);

    const { error: insertError } = await supabase.from("note_folders").insert({
      note_id: parsed.noteId,
      folder_id: parsed.folderId,
      owner_id: user.id
    });

    if (insertError) {
      throw insertError;
    }
  }

  revalidatePath("/");
  revalidatePath(`/notes/${parsed.noteId}`);
}

export async function assignFolderToNoteByIdsAction(noteId: string, folderId: string | null) {
  const parsed = assignFolderSchema.parse({
    noteId,
    folderId: folderId ?? undefined
  });
  const { supabase, user } = await getAuthedFoundation();
  await assertOwnedNote(supabase, user.id, parsed.noteId);

  const { error: deleteError } = await supabase
    .from("note_folders")
    .delete()
    .eq("owner_id", user.id)
    .eq("note_id", parsed.noteId);

  if (deleteError) {
    throw deleteError;
  }

  if (parsed.folderId) {
    await assertOwnedFolder(supabase, user.id, parsed.folderId);

    const { error: insertError } = await supabase.from("note_folders").insert({
      note_id: parsed.noteId,
      folder_id: parsed.folderId,
      owner_id: user.id
    });

    if (insertError) {
      throw insertError;
    }
  }

  revalidatePath("/");
  revalidatePath(`/notes/${parsed.noteId}`);
}

export async function toggleTagOnNoteAction(formData: FormData) {
  const parsed = assignTagSchema.parse({
    noteId: formData.get("noteId"),
    tagId: formData.get("tagId")
  });
  const { supabase, user } = await getAuthedFoundation();
  await Promise.all([
    assertOwnedNote(supabase, user.id, parsed.noteId),
    assertOwnedTag(supabase, user.id, parsed.tagId)
  ]);

  const { data: existing, error: existingError } = await supabase
    .from("note_tags")
    .select("note_id")
    .eq("owner_id", user.id)
    .eq("note_id", parsed.noteId)
    .eq("tag_id", parsed.tagId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error } = await supabase
      .from("note_tags")
      .delete()
      .eq("owner_id", user.id)
      .eq("note_id", parsed.noteId)
      .eq("tag_id", parsed.tagId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("note_tags").insert({
      note_id: parsed.noteId,
      tag_id: parsed.tagId,
      owner_id: user.id
    });

    if (error) {
      throw error;
    }
  }

  revalidatePath("/");
  revalidatePath(`/notes/${parsed.noteId}`);
}

export async function togglePinFolderAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const isPinned = formData.get("isPinned") === "true";
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("folders")
    .update({ is_pinned: !isPinned })
    .eq("id", folderId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
}

export async function archiveFolderNotesAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const folderIds = await getDescendantFolderIds(supabase, user.id, workspaceId, folderId);
  const noteIds = await getNoteIdsForFolders(supabase, user.id, folderIds);
  await updateFoldersByIds(supabase, user.id, folderIds, { is_archived: true, deleted_at: null, is_pinned: false });
  await updateNotesByIds(supabase, user.id, noteIds, { is_archived: true, deleted_at: null, is_pinned: false });
  revalidatePath("/");
  revalidatePath("/archive");
}

export async function deleteFolderAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const folderIds = await getDescendantFolderIds(supabase, user.id, workspaceId, folderId);
  const noteIds = await getNoteIdsForFolders(supabase, user.id, folderIds);
  const deletedAt = new Date().toISOString();
  await updateFoldersByIds(supabase, user.id, folderIds, {
    deleted_at: deletedAt,
    is_archived: false,
    is_pinned: false
  });
  await updateNotesByIds(supabase, user.id, noteIds, {
    deleted_at: deletedAt,
    is_archived: false,
    is_pinned: false
  });

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/trash");
}

export async function restoreArchivedFolderAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const folderIds = await getDescendantFolderIds(supabase, user.id, workspaceId, folderId);
  const noteIds = await getNoteIdsForFolders(supabase, user.id, folderIds);
  await updateFoldersByIds(supabase, user.id, folderIds, { is_archived: false });
  await updateNotesByIds(supabase, user.id, noteIds, { is_archived: false });

  revalidatePath("/");
  revalidatePath("/archive");
}

export async function restoreTrashedFolderAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const folderIds = await getDescendantFolderIds(supabase, user.id, workspaceId, folderId);
  const noteIds = await getNoteIdsForFolders(supabase, user.id, folderIds);
  await updateFoldersByIds(supabase, user.id, folderIds, { deleted_at: null, is_archived: false });
  await updateNotesByIds(supabase, user.id, noteIds, { deleted_at: null, is_archived: false });

  revalidatePath("/");
  revalidatePath("/trash");
}

export async function deleteFolderForeverAction(formData: FormData) {
  const folderId = folderIdSchema.parse(formData.get("folderId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const folderIds = await getDescendantFolderIds(supabase, user.id, workspaceId, folderId);
  const noteIds = await getNoteIdsForFolders(supabase, user.id, folderIds);
  await hardDeleteTrashedNotesByIds(supabase, noteIds, user.id);
  await hardDeleteTrashedFoldersByIds(supabase, [...folderIds].reverse(), user.id);

  revalidatePath("/trash");
}

async function getDescendantFolderIds(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  workspaceId: string,
  folderId: string
): Promise<string[]> {
  await assertOwnedFolder(supabase, ownerId, folderId);

  const { data, error } = await supabase
    .from("folders")
    .select("id, parent_id")
    .eq("owner_id", ownerId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  const childrenByParentId = new Map<string | null, string[]>();

  for (const folder of data as Array<{ id: string; parent_id: string | null }>) {
    const children = childrenByParentId.get(folder.parent_id) ?? [];
    children.push(folder.id);
    childrenByParentId.set(folder.parent_id, children);
  }

  const result: string[] = [];
  const visit = (currentFolderId: string) => {
    result.push(currentFolderId);
    for (const childId of childrenByParentId.get(currentFolderId) ?? []) {
      visit(childId);
    }
  };

  visit(folderId);
  return result;
}

async function getNoteIdsForFolders(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  folderIds: string[]
) {
  if (folderIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("note_folders")
    .select("note_id")
    .eq("owner_id", ownerId)
    .in("folder_id", folderIds);

  if (error) {
    throw error;
  }

  return [...new Set((data as Array<{ note_id: string }>).map((row) => row.note_id))];
}

async function updateNotesByIds(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  noteIds: string[],
  values: Record<string, unknown>
) {
  if (noteIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("notes")
    .update(values)
    .eq("owner_id", ownerId)
    .in("id", noteIds);

  if (error) {
    throw error;
  }
}

async function updateFoldersByIds(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  folderIds: string[],
  values: Record<string, unknown>
) {
  if (folderIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("folders")
    .update(values)
    .eq("owner_id", ownerId)
    .in("id", folderIds);

  if (error) {
    throw error;
  }
}

async function assertOwnedNote(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  noteId: string
) {
  const { data, error } = await supabase
    .from("notes")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("id", noteId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Note not found.");
  }
}

async function assertOwnedFolder(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  folderId: string
) {
  const { data, error } = await supabase
    .from("folders")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("id", folderId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Folder not found.");
  }
}

async function assertOwnedTag(
  supabase: Awaited<ReturnType<typeof getAuthedFoundation>>["supabase"],
  ownerId: string,
  tagId: string
) {
  const { data, error } = await supabase
    .from("tags")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("id", tagId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Tag not found.");
  }
}
