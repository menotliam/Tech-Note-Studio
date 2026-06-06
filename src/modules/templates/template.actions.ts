"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAuthedFoundation } from "@/modules/notes/note.actions";
import { getReadableTemplateById } from "./template.repository";
import { templateIdSchema } from "./template.schemas";

export async function createNoteFromTemplateAction(formData: FormData) {
  const templateId = templateIdSchema.parse(formData.get("templateId"));
  const { supabase, user, workspaceId } = await getAuthedFoundation();
  const template = await getReadableTemplateById(supabase, templateId);

  if (!template) {
    notFound();
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      owner_id: user.id,
      title: template.name,
      content_json: template.contentJson,
      content_text: null,
      schema_version: template.schemaVersion,
      template_id: template.id
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  revalidatePath("/");
  redirect(`/notes/${data.id}`);
}
