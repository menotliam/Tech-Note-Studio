import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPreferences } from "./preferences.types";

export type UserPreferencesRow = {
  owner_id: string;
  appearance: unknown;
  dashboard: unknown;
  editor: unknown;
  export: unknown;
};

export type LegacyEditorPreferencesRow = {
  auto_detection_enabled: boolean;
  editor_width: string;
  font_size: string;
  code_theme: string;
  default_line_numbers: boolean;
  default_word_wrap: boolean;
};

export async function getUserPreferencesRow(
  supabase: SupabaseClient,
  ownerId: string
): Promise<UserPreferencesRow | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("owner_id, appearance, dashboard, editor, export")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as UserPreferencesRow | null) ?? null;
}

export async function insertUserPreferencesRow(
  supabase: SupabaseClient,
  ownerId: string,
  preferences: UserPreferences
): Promise<UserPreferencesRow> {
  const { data, error } = await supabase
    .from("user_preferences")
    .insert(toPreferenceRecord(ownerId, preferences))
    .select("owner_id, appearance, dashboard, editor, export")
    .single();

  if (error) {
    throw error;
  }

  return data as UserPreferencesRow;
}

export async function upsertUserPreferencesRow(
  supabase: SupabaseClient,
  ownerId: string,
  preferences: UserPreferences
): Promise<UserPreferencesRow> {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(toPreferenceRecord(ownerId, preferences), { onConflict: "owner_id" })
    .select("owner_id, appearance, dashboard, editor, export")
    .single();

  if (error) {
    throw error;
  }

  return data as UserPreferencesRow;
}

export async function getLegacyEditorPreferencesRow(
  supabase: SupabaseClient,
  ownerId: string
): Promise<LegacyEditorPreferencesRow | null> {
  const { data, error } = await supabase
    .from("editor_preferences")
    .select("auto_detection_enabled, editor_width, font_size, code_theme, default_line_numbers, default_word_wrap")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as LegacyEditorPreferencesRow | null) ?? null;
}

function toPreferenceRecord(ownerId: string, preferences: UserPreferences) {
  return {
    owner_id: ownerId,
    appearance: preferences.appearance,
    dashboard: preferences.dashboard,
    editor: preferences.editor,
    export: preferences.export
  };
}
