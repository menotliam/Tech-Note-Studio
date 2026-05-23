import type {
  accentPresetValues,
  codeThemeValues,
  dashboardDefaultViewValues,
  dashboardDensityValues,
  dashboardSortValues,
  editorFontFamilyValues,
  editorFontSizeValues,
  editorLineHeightValues,
  editorWidthValues,
  gradientPresetValues,
  noteListStyleValues,
  themePreferenceValues
} from "./preferences.defaults";

export type ThemePreference = (typeof themePreferenceValues)[number];
export type AccentPreset = (typeof accentPresetValues)[number];
export type GradientPreset = (typeof gradientPresetValues)[number];
export type DashboardDensity = (typeof dashboardDensityValues)[number];
export type DashboardDefaultView = (typeof dashboardDefaultViewValues)[number];
export type NoteListStyle = (typeof noteListStyleValues)[number];
export type DashboardSort = (typeof dashboardSortValues)[number];
export type EditorWidth = (typeof editorWidthValues)[number];
export type EditorFontSize = (typeof editorFontSizeValues)[number];
export type EditorFontFamily = (typeof editorFontFamilyValues)[number];
export type EditorLineHeight = (typeof editorLineHeightValues)[number];
export type CodeTheme = (typeof codeThemeValues)[number];

export type AppearancePreferences = {
  theme: ThemePreference;
  accentPreset: AccentPreset;
  gradientPreset: GradientPreset | null;
};

export type DashboardPreferences = {
  density: DashboardDensity;
  sidebarCollapsed: boolean;
  defaultView: DashboardDefaultView;
  noteListStyle: NoteListStyle;
  sortDefault: DashboardSort;
};

export type EditorPreferences = {
  width: EditorWidth;
  fontSize: EditorFontSize;
  fontFamily: EditorFontFamily;
  lineHeight: EditorLineHeight;
  codeTheme: CodeTheme;
  defaultLineNumbers: boolean;
  defaultWordWrap: boolean;
  autoDetectionEnabled: boolean;
  markdownShortcutsEnabled: boolean;
  clipboardImagePasteEnabled: boolean;
};

export type ExportPreferences = {
  includeImageCaptions: boolean;
};

export type UserPreferences = {
  appearance: AppearancePreferences;
  dashboard: DashboardPreferences;
  editor: EditorPreferences;
  export: ExportPreferences;
};

export type UserPreferencesPatch = {
  appearance?: Partial<AppearancePreferences>;
  dashboard?: Partial<DashboardPreferences>;
  editor?: Partial<EditorPreferences>;
  export?: Partial<ExportPreferences>;
};
