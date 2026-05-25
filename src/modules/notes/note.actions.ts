"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createEditorDocumentFromPlainText, emptyEditorDocument } from "@/modules/editor/editor-documents";
import { extractPlainTextFromEditorJson } from "@/modules/editor/editor-text-extractor";
import { parseEditorDocumentJson } from "@/modules/editor/editor.validation";
import { logSecurityEvent } from "@/modules/security/security.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";
import { hardDeleteTrashedFoldersByIds, hardDeleteTrashedNotesByIds } from "./note-lifecycle.service";
import { noteIdSchema, renameNoteSchema, updateNoteSchema } from "./note.schemas";

export async function getAuthedFoundation() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { workspaceId } = await ensureUserFoundation(supabase, user);

  if (!workspaceId) {
    throw new Error("Default workspace is missing.");
  }

  return {
    supabase,
    user,
    workspaceId
  };
}

export async function createBlankNoteAction() {
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const contentText = extractPlainTextFromEditorJson(emptyEditorDocument);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      owner_id: user.id,
      title: "Untitled",
      content_json: emptyEditorDocument,
      content_text: contentText,
      schema_version: 1
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  revalidatePath("/");
  redirect(`/notes/${data.id}`);
}

export async function updateNoteAction(formData: FormData) {
  const parsed = updateNoteSchema.safeParse({
    noteId: formData.get("noteId"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    contentJson: formData.get("contentJson") || undefined,
    contentText: formData.get("contentText") || undefined
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid note input.");
  }

  const { supabase, user } = await getAuthedFoundation();
  const contentJson = parsed.data.contentJson
    ? parseEditorDocumentJson(parsed.data.contentJson)
    : createEditorDocumentFromPlainText(parsed.data.body ?? "");
  const contentText = extractPlainTextFromEditorJson(contentJson);

  const { error } = await supabase
    .from("notes")
    .update({
      title: parsed.data.title,
      content_json: contentJson,
      content_text: contentText,
      schema_version: 1,
      last_synced_at: new Date().toISOString()
    })
    .eq("id", parsed.data.noteId)
    .eq("owner_id", user.id);

  if (error) {
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "NOTE_UPDATE_FAILED",
      severity: "warning",
      metadata: { noteId: parsed.data.noteId, message: error.message }
    });
    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/notes/${parsed.data.noteId}`);
}

export async function togglePinNoteAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const isPinned = formData.get("isPinned") === "true";
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ is_pinned: !isPinned })
    .eq("id", noteId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/notes/${noteId}`);
}

export async function renameNoteAction(formData: FormData) {
  const parsed = renameNoteSchema.parse({
    noteId: formData.get("noteId"),
    title: formData.get("title")
  });
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ title: parsed.title })
    .eq("id", parsed.noteId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/notes/${parsed.noteId}`);
}

export async function archiveNoteAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ is_archived: true, is_pinned: false })
    .eq("id", noteId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/archive");
  redirect("/");
}

export async function restoreArchivedNoteAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ is_archived: false })
    .eq("id", noteId)
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/archive");
}

export async function deleteNoteAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString(), is_archived: false, is_pinned: false })
    .eq("id", noteId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/trash");
  redirect("/");
}

export async function moveNoteToTrashAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString(), is_archived: false, is_pinned: false })
    .eq("id", noteId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/trash");
}

export async function restoreTrashedNoteAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const { supabase, user } = await getAuthedFoundation();

  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: null, is_archived: false })
    .eq("id", noteId)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/trash");
}

export async function deleteNoteForeverAction(formData: FormData) {
  const noteId = noteIdSchema.parse(formData.get("noteId"));
  const { supabase, user } = await getAuthedFoundation();
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (noteError) {
    throw noteError;
  }

  if (!note) {
    throw new Error("Only trashed notes can be deleted forever.");
  }

  await hardDeleteTrashedNotesByIds(supabase, [noteId], user.id);
  revalidatePath("/trash");
}

export async function deleteAllTrashAction() {
  const { supabase, user } = await getAuthedFoundation();
  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("id")
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  if (notesError) {
    throw notesError;
  }

  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id")
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  if (foldersError) {
    throw foldersError;
  }

  await hardDeleteTrashedNotesByIds(
    supabase,
    (notes as Array<{ id: string }>).map((note) => note.id),
    user.id
  );
  await hardDeleteTrashedFoldersByIds(
    supabase,
    (folders as Array<{ id: string }>).map((folder) => folder.id),
    user.id
  );

  revalidatePath("/trash");
}
