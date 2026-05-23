import { z } from "zod";
import {
  accentPresetValues,
  codeThemeValues,
  dashboardDefaultViewValues,
  dashboardDensityValues,
  dashboardSortValues,
  defaultUserPreferences,
  editorFontFamilyValues,
  editorFontSizeValues,
  editorLineHeightValues,
  editorWidthValues,
  gradientPresetValues,
  noteListStyleValues,
  themePreferenceValues
} from "./preferences.defaults";
import type {
  AppearancePreferences,
  DashboardPreferences,
  EditorPreferences,
  ExportPreferences,
  UserPreferences,
  UserPreferencesPatch
} from "./preferences.types";

export const appearancePreferencesSchema = z.object({
  theme: z.enum(themePreferenceValues).default(defaultUserPreferences.appearance.theme),
  accentPreset: z.enum(accentPresetValues).default(defaultUserPreferences.appearance.accentPreset),
  gradientPreset: z.enum(gradientPresetValues).nullable().default(defaultUserPreferences.appearance.gradientPreset)
});

export const dashboardPreferencesSchema = z.object({
  density: z.enum(dashboardDensityValues).default(defaultUserPreferences.dashboard.density),
  sidebarCollapsed: z.boolean().default(defaultUserPreferences.dashboard.sidebarCollapsed),
  defaultView: z.enum(dashboardDefaultViewValues).default(defaultUserPreferences.dashboard.defaultView),
  noteListStyle: z.enum(noteListStyleValues).default(defaultUserPreferences.dashboard.noteListStyle),
  sortDefault: z.enum(dashboardSortValues).default(defaultUserPreferences.dashboard.sortDefault)
});

export const editorPreferencesSchema = z.object({
  width: z.enum(editorWidthValues).default(defaultUserPreferences.editor.width),
  fontSize: z.enum(editorFontSizeValues).default(defaultUserPreferences.editor.fontSize),
  fontFamily: z.enum(editorFontFamilyValues).default(defaultUserPreferences.editor.fontFamily),
  lineHeight: z.enum(editorLineHeightValues).default(defaultUserPreferences.editor.lineHeight),
  codeTheme: z.enum(codeThemeValues).default(defaultUserPreferences.editor.codeTheme),
  defaultLineNumbers: z.boolean().default(defaultUserPreferences.editor.defaultLineNumbers),
  defaultWordWrap: z.boolean().default(defaultUserPreferences.editor.defaultWordWrap),
  autoDetectionEnabled: z.boolean().default(defaultUserPreferences.editor.autoDetectionEnabled),
  markdownShortcutsEnabled: z.boolean().default(defaultUserPreferences.editor.markdownShortcutsEnabled),
  clipboardImagePasteEnabled: z.boolean().default(defaultUserPreferences.editor.clipboardImagePasteEnabled)
});

export const exportPreferencesSchema = z.object({
  includeImageCaptions: z.boolean().default(defaultUserPreferences.export.includeImageCaptions)
});

export const userPreferencesSchema = z.object({
  appearance: appearancePreferencesSchema.default(defaultUserPreferences.appearance),
  dashboard: dashboardPreferencesSchema.default(defaultUserPreferences.dashboard),
  editor: editorPreferencesSchema.default(defaultUserPreferences.editor),
  export: exportPreferencesSchema.default(defaultUserPreferences.export)
});

const appearancePreferencesPatchSchema = z
  .object({
    theme: z.enum(themePreferenceValues).optional(),
    accentPreset: z.enum(accentPresetValues).optional(),
    gradientPreset: z.enum(gradientPresetValues).nullable().optional()
  })
  .strict();

const dashboardPreferencesPatchSchema = z
  .object({
    density: z.enum(dashboardDensityValues).optional(),
    sidebarCollapsed: z.boolean().optional(),
    defaultView: z.enum(dashboardDefaultViewValues).optional(),
    noteListStyle: z.enum(noteListStyleValues).optional(),
    sortDefault: z.enum(dashboardSortValues).optional()
  })
  .strict();

const editorPreferencesPatchSchema = z
  .object({
    width: z.enum(editorWidthValues).optional(),
    fontSize: z.enum(editorFontSizeValues).optional(),
    fontFamily: z.enum(editorFontFamilyValues).optional(),
    lineHeight: z.enum(editorLineHeightValues).optional(),
    codeTheme: z.enum(codeThemeValues).optional(),
    defaultLineNumbers: z.boolean().optional(),
    defaultWordWrap: z.boolean().optional(),
    autoDetectionEnabled: z.boolean().optional(),
    markdownShortcutsEnabled: z.boolean().optional(),
    clipboardImagePasteEnabled: z.boolean().optional()
  })
  .strict();

const exportPreferencesPatchSchema = z
  .object({
    includeImageCaptions: z.boolean().optional()
  })
  .strict();

export const userPreferencesPatchSchema = z
  .object({
    appearance: appearancePreferencesPatchSchema.optional(),
    dashboard: dashboardPreferencesPatchSchema.optional(),
    editor: editorPreferencesPatchSchema.optional(),
    export: exportPreferencesPatchSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one preference group is required.");

export function normalizeUserPreferences(input?: {
  appearance?: unknown;
  dashboard?: unknown;
  editor?: unknown;
  export?: unknown;
}): UserPreferences {
  return userPreferencesSchema.parse({
    appearance: input?.appearance ?? {},
    dashboard: input?.dashboard ?? {},
    editor: input?.editor ?? {},
    export: input?.export ?? {}
  });
}

export function mergeUserPreferencesPatch(
  current: UserPreferences,
  patch: UserPreferencesPatch
): UserPreferences {
  return userPreferencesSchema.parse({
    appearance: mergePreferenceGroup<AppearancePreferences>(current.appearance, patch.appearance),
    dashboard: mergePreferenceGroup<DashboardPreferences>(current.dashboard, patch.dashboard),
    editor: mergePreferenceGroup<EditorPreferences>(current.editor, patch.editor),
    export: mergePreferenceGroup<ExportPreferences>(current.export, patch.export)
  });
}

function mergePreferenceGroup<T extends object>(current: T, patch?: Partial<T>) {
  return {
    ...current,
    ...(patch ?? {})
  };
}
