import { describe, expect, it } from "vitest";
import { defaultUserPreferences } from "./preferences.defaults";
import {
  mergeUserPreferencesPatch,
  normalizeUserPreferences,
  userPreferencesPatchSchema
} from "./preferences.schemas";
import { createPreferencesFromLegacyEditorPreferences } from "./preferences.service";

describe("preferences schemas", () => {
  it("accepts valid theme values", () => {
    for (const theme of ["light", "dark", "system"]) {
      const result = userPreferencesPatchSchema.safeParse({
        appearance: { theme }
      });

      expect(result.success).toBe(true);
    }
  });

  it("accepts v0.3 reduced motion preference values", () => {
    for (const reducedMotion of ["system", "on", "off"]) {
      const result = userPreferencesPatchSchema.safeParse({
        appearance: { reducedMotion }
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid theme and accent values", () => {
    expect(
      userPreferencesPatchSchema.safeParse({
        appearance: { theme: "neon" }
      }).success
    ).toBe(false);

    expect(
      userPreferencesPatchSchema.safeParse({
        appearance: { accentPreset: "url(javascript:alert(1))" }
      }).success
    ).toBe(false);
  });

  it("accepts known gradient presets and nullable gradient", () => {
    expect(
      userPreferencesPatchSchema.safeParse({
        appearance: { gradientPreset: "cyan-purple" }
      }).success
    ).toBe(true);

    expect(
      userPreferencesPatchSchema.safeParse({
        appearance: { gradientPreset: null }
      }).success
    ).toBe(true);
  });

  it("preserves defaults for missing preference keys", () => {
    const preferences = normalizeUserPreferences({
      appearance: { theme: "dark" },
      editor: { width: "wide" }
    });

    expect(preferences.appearance.theme).toBe("dark");
    expect(preferences.appearance.reducedMotion).toBe(defaultUserPreferences.appearance.reducedMotion);
    expect(preferences.appearance.accentPreset).toBe(defaultUserPreferences.appearance.accentPreset);
    expect(preferences.dashboard).toEqual(defaultUserPreferences.dashboard);
    expect(preferences.editor.width).toBe("wide");
    expect(preferences.editor.fontSize).toBe(defaultUserPreferences.editor.fontSize);
  });

  it("merges partial updates without erasing unrelated groups", () => {
    const current = normalizeUserPreferences();
    const merged = mergeUserPreferencesPatch(current, {
      appearance: { theme: "dark" },
      editor: { fontSize: "large", defaultWordWrap: true }
    });

    expect(merged.appearance.theme).toBe("dark");
    expect(merged.appearance.accentPreset).toBe(current.appearance.accentPreset);
    expect(merged.dashboard).toEqual(current.dashboard);
    expect(merged.editor.fontSize).toBe("large");
    expect(merged.editor.defaultWordWrap).toBe(true);
    expect(merged.editor.width).toBe(current.editor.width);
    expect(merged.export).toEqual(current.export);
  });

  it("validates editor preference fields", () => {
    const result = userPreferencesPatchSchema.safeParse({
      editor: {
        width: "wide",
        fontSize: "large",
        fontFamily: "mono",
        lineHeight: "spacious",
        codeTheme: "one-dark",
        defaultLineNumbers: false,
        defaultWordWrap: true,
        autoDetectionEnabled: false,
        markdownShortcutsEnabled: true,
        clipboardImagePasteEnabled: true,
        keybindings: defaultUserPreferences.editor.keybindings
      }
    });

    expect(result.success).toBe(true);
  });

  it("accepts dashboard focus mode preference", () => {
    const result = userPreferencesPatchSchema.safeParse({
      dashboard: {
        focusModeEnabled: true
      }
    });

    expect(result.success).toBe(true);
  });

  it("accepts normalized editor keybindings", () => {
    const result = userPreferencesPatchSchema.safeParse({
      editor: {
        keybindings: {
          ...defaultUserPreferences.editor.keybindings,
          "editor.find": "ctrl+shift+f"
        }
      }
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.editor?.keybindings?.["editor.find"]).toBe("Mod+Shift+F");
    }
  });

  it("rejects conflicting editor keybindings", () => {
    const result = userPreferencesPatchSchema.safeParse({
      editor: {
        keybindings: {
          ...defaultUserPreferences.editor.keybindings,
          "editor.find": "Mod+S"
        }
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty preference patches", () => {
    expect(userPreferencesPatchSchema.safeParse({}).success).toBe(false);
  });

  it("builds v0.2 preferences from legacy editor preferences", () => {
    const preferences = createPreferencesFromLegacyEditorPreferences({
      auto_detection_enabled: false,
      editor_width: "wide",
      font_size: "large",
      code_theme: "dracula",
      default_line_numbers: false,
      default_word_wrap: true
    });

    expect(preferences.editor.width).toBe("wide");
    expect(preferences.editor.fontSize).toBe("large");
    expect(preferences.editor.codeTheme).toBe("dracula");
    expect(preferences.editor.defaultLineNumbers).toBe(false);
    expect(preferences.editor.defaultWordWrap).toBe(true);
    expect(preferences.editor.autoDetectionEnabled).toBe(false);
    expect(preferences.editor.markdownShortcutsEnabled).toBe(true);
    expect(preferences.editor.keybindings).toEqual(defaultUserPreferences.editor.keybindings);
    expect(preferences.appearance).toEqual(defaultUserPreferences.appearance);
  });
});
