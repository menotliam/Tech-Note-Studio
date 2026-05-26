import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultUserPreferences } from "./preferences.defaults";
import {
  mergeUserPreferencesPatch,
  normalizeUserPreferences,
  userPreferencesPatchSchema
} from "./preferences.schemas";
import {
  getLegacyEditorPreferencesRow,
  getUserPreferencesRow,
  insertUserPreferencesRow,
  upsertUserPreferencesRow,
  type LegacyEditorPreferencesRow
} from "./preferences.repository";
import type { UserPreferences, UserPreferencesPatch } from "./preferences.types";

export async function loadUserPreferences(supabase: SupabaseClient, ownerId: string): Promise<UserPreferences> {
  const row = await getUserPreferencesRow(supabase, ownerId);

  if (!row) {
    return normalizeUserPreferences();
  }

  return normalizeUserPreferences(row);
}

export async function ensureUserPreferences(supabase: SupabaseClient, ownerId: string): Promise<UserPreferences> {
  const existingRow = await getUserPreferencesRow(supabase, ownerId);

  if (existingRow) {
    return normalizeUserPreferences(existingRow);
  }

  const legacyEditorPreferences = await getLegacyEditorPreferencesRow(supabase, ownerId);
  const preferences = createPreferencesFromLegacyEditorPreferences(legacyEditorPreferences);

  try {
    const insertedRow = await insertUserPreferencesRow(supabase, ownerId, preferences);
    return normalizeUserPreferences(insertedRow);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const row = await getUserPreferencesRow(supabase, ownerId);
    return normalizeUserPreferences(row ?? preferences);
  }
}

export async function updateUserPreferences(
  supabase: SupabaseClient,
  ownerId: string,
  patch: UserPreferencesPatch
): Promise<UserPreferences> {
  const parsedPatch = userPreferencesPatchSchema.parse(patch);
  const current = await loadUserPreferences(supabase, ownerId);
  const next = mergeUserPreferencesPatch(current, parsedPatch);
  const savedRow = await upsertUserPreferencesRow(supabase, ownerId, next);

  return normalizeUserPreferences(savedRow);
}

export function createPreferencesFromLegacyEditorPreferences(
  legacyEditorPreferences?: LegacyEditorPreferencesRow | null
): UserPreferences {
  return {
    ...defaultUserPreferences,
    appearance: { ...defaultUserPreferences.appearance },
    dashboard: { ...defaultUserPreferences.dashboard },
    editor: {
      ...defaultUserPreferences.editor,
      width: parseLegacyEditorWidth(legacyEditorPreferences?.editor_width),
      fontSize: parseLegacyFontSize(legacyEditorPreferences?.font_size),
      codeTheme: parseLegacyCodeTheme(legacyEditorPreferences?.code_theme),
      defaultLineNumbers:
        legacyEditorPreferences?.default_line_numbers ?? defaultUserPreferences.editor.defaultLineNumbers,
      defaultWordWrap: legacyEditorPreferences?.default_word_wrap ?? defaultUserPreferences.editor.defaultWordWrap,
      autoDetectionEnabled:
        legacyEditorPreferences?.auto_detection_enabled ?? defaultUserPreferences.editor.autoDetectionEnabled,
      keybindings: { ...defaultUserPreferences.editor.keybindings }
    },
    export: { ...defaultUserPreferences.export }
  };
}

function parseLegacyEditorWidth(value: string | undefined) {
  return value === "compact" || value === "comfortable" || value === "wide"
    ? value
    : defaultUserPreferences.editor.width;
}

function parseLegacyFontSize(value: string | undefined) {
  return value === "small" || value === "medium" || value === "large"
    ? value
    : defaultUserPreferences.editor.fontSize;
}

function parseLegacyCodeTheme(value: string | undefined) {
  return value === "github-dark" || value === "github-light" || value === "dracula" || value === "one-dark"
    ? value
    : defaultUserPreferences.editor.codeTheme;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
