import type { UserPreferences } from "./preferences.types";
import { defaultEditorKeybindings } from "@/modules/keybindings/keybindings.defaults";

export const themePreferenceValues = ["light", "dark", "system"] as const;
export const reducedMotionPreferenceValues = ["system", "on", "off"] as const;
export const accentPresetValues = ["cyan", "blue", "violet", "emerald", "amber", "rose"] as const;
export const gradientPresetValues = ["cyan-purple", "blue-emerald", "violet-rose", "amber-rose"] as const;
export const dashboardDensityValues = ["compact", "comfortable", "spacious"] as const;
export const dashboardDefaultViewValues = ["folder", "recent", "pinned", "all"] as const;
export const noteListStyleValues = ["row", "card"] as const;
export const dashboardSortValues = ["updated_desc", "created_desc", "title_asc"] as const;
export const editorWidthValues = ["compact", "comfortable", "wide"] as const;
export const editorFontSizeValues = ["small", "medium", "large"] as const;
export const editorFontFamilyValues = ["system", "serif", "mono"] as const;
export const editorLineHeightValues = ["compact", "comfortable", "spacious"] as const;
export const codeThemeValues = ["default-dark-aware", "github-dark", "github-light", "dracula", "one-dark"] as const;

export const defaultUserPreferences: UserPreferences = {
  appearance: {
    theme: "system",
    reducedMotion: "system",
    accentPreset: "cyan",
    gradientPreset: "cyan-purple"
  },
  dashboard: {
    density: "comfortable",
    sidebarCollapsed: false,
    focusModeEnabled: false,
    defaultView: "folder",
    noteListStyle: "row",
    sortDefault: "updated_desc"
  },
  editor: {
    width: "comfortable",
    fontSize: "medium",
    fontFamily: "system",
    lineHeight: "comfortable",
    codeTheme: "default-dark-aware",
    defaultLineNumbers: true,
    defaultWordWrap: false,
    autoDetectionEnabled: true,
    markdownShortcutsEnabled: true,
    clipboardImagePasteEnabled: true,
    keybindings: defaultEditorKeybindings
  },
  export: {
    includeImageCaptions: true
  }
};
