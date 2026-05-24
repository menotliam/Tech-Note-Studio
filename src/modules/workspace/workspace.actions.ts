"use server";

import { revalidatePath } from "next/cache";
import { getAuthedFoundation } from "@/modules/notes/note.actions";
import {
  parseNullableWorkspaceFormValue,
  workspacePersonalizationSchema
} from "./workspace.schemas";
import type { WorkspaceSummary } from "./workspace.types";

export async function updateWorkspacePersonalizationAction(formData: FormData): Promise<WorkspaceSummary> {
  const parsed = workspacePersonalizationSchema.parse({
    name: formData.get("name"),
    icon: parseNullableWorkspaceFormValue(formData.get("icon")),
    accent: parseNullableWorkspaceFormValue(formData.get("accent")),
    cover: parseNullableWorkspaceFormValue(formData.get("cover")),
    defaultLayout: formData.get("defaultLayout")
  });
  const { supabase, user, workspaceId } = await getAuthedFoundation();

  const { error } = await supabase
    .from("workspaces")
    .update({
      name: parsed.name,
      icon: parsed.icon,
      accent: parsed.accent,
      cover: parsed.cover,
      default_layout: parsed.defaultLayout
    })
    .eq("id", workspaceId)
    .eq("owner_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/settings");

  return {
    id: workspaceId,
    name: parsed.name,
    icon: parsed.icon,
    accent: parsed.accent,
    cover: parsed.cover,
    defaultLayout: parsed.defaultLayout
  };
}
