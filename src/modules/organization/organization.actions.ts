"use server";

import { revalidatePath } from "next/cache";
import { getAuthedFoundation } from "@/modules/notes/note.actions";
import {
  assignFolderSchema,
  assignTagSchema,
  createFolderSchema,
  createTagSchema
} from "./organization.schemas";

export async function createFolderAction(formData: FormData) {
  const parsed = createFolderSchema.parse({
    name: formData.get("name")
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();

  const { error } = await supabase.from("folders").insert({
    workspace_id: workspaceId,
    owner_id: user.id,
    name: parsed.name
  });

  if (error) {
    throw error;
  }

  revalidatePath("/");
}

export async function createTagAction(formData: FormData) {
  const parsed = createTagSchema.parse({
    name: formData.get("name"),
    color: formData.get("color") || undefined
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();

  const { error } = await supabase.from("tags").insert({
    workspace_id: workspaceId,
    owner_id: user.id,
    name: parsed.name,
    color: parsed.color || null
  });

  if (error) {
    throw error;
  }

  revalidatePath("/");
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
