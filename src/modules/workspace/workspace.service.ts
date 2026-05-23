import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureUserPreferences } from "@/modules/preferences/preferences.service";

const defaultEditorPreferences = {
  auto_detection_enabled: true,
  editor_width: "comfortable",
  font_size: "medium",
  code_theme: "default-dark-aware",
  default_line_numbers: true,
  default_word_wrap: false
};

export async function ensureUserFoundation(
  supabase: SupabaseClient,
  user: User,
  displayName?: string
) {
  const fallbackName = user.email?.split("@")[0] ?? "TechNote User";

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    throw profileLookupError;
  }

  if (!existingProfile) {
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      display_name: displayName?.trim() || fallbackName
    });

    if (error) {
      throw error;
    }
  }

  let workspaceId: string | null = null;

  const { data: existingWorkspace, error: workspaceLookupError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  if (workspaceLookupError) {
    throw workspaceLookupError;
  }

  if (existingWorkspace) {
    workspaceId = existingWorkspace.id;
  } else {
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        owner_id: user.id,
        name: "Personal Workspace",
        is_default: true
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    workspaceId = data.id;
  }

  const { data: existingPreferences, error: preferencesLookupError } = await supabase
    .from("editor_preferences")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (preferencesLookupError) {
    throw preferencesLookupError;
  }

  if (!existingPreferences) {
    const { error: preferencesError } = await supabase.from("editor_preferences").insert({
      owner_id: user.id,
      ...defaultEditorPreferences
    });

    if (preferencesError) {
      throw preferencesError;
    }
  }

  await ensureUserPreferences(supabase, user.id);

  return {
    workspaceId
  };
}
