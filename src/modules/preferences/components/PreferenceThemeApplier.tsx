"use client";

import { useLayoutEffect } from "react";
import { getAccentPresetDefinition, getGradientPresetDefinition } from "@/modules/preferences/preferences.ui";
import {
  applyThemeClass,
  darkModeMediaQuery,
  persistThemePreference
} from "@/modules/preferences/preferences.theme";
import type { UserPreferences } from "@/modules/preferences/preferences.types";

export function PreferenceThemeApplier({ preferences }: { preferences: UserPreferences }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia(darkModeMediaQuery);
    const accent = getAccentPresetDefinition(preferences.appearance.accentPreset);
    const gradient = getGradientPresetDefinition(preferences.appearance.gradientPreset);

    root.style.setProperty("--primary", accent.primary);
    root.style.setProperty("--primary-foreground", accent.primaryForeground);
    root.style.setProperty("--accent", accent.accent);
    root.style.setProperty("--accent-foreground", accent.accentForeground);
    root.style.setProperty(
      "--accent-gradient",
      gradient?.value ?? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))"
    );

    const applyTheme = () => {
      applyThemeClass(preferences.appearance.theme, mediaQuery.matches);
    };

    persistThemePreference(preferences.appearance.theme);
    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [preferences]);

  return null;
}
