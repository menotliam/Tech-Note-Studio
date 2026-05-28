"use client";

import { useLayoutEffect } from "react";
import { getAccentPresetDefinition, getGradientPresetDefinition } from "@/modules/preferences/preferences.ui";
import {
  applyThemeClass,
  darkModeMediaQuery,
  persistThemePreference
} from "@/modules/preferences/preferences.theme";
import {
  applyReducedMotionAttribute,
  persistReducedMotionPreference,
  reducedMotionMediaQuery
} from "@/modules/motion/use-reduced-motion-preference";
import type { UserPreferences } from "@/modules/preferences/preferences.types";

export function PreferenceThemeApplier({ preferences }: { preferences: UserPreferences }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const themeMediaQuery = window.matchMedia(darkModeMediaQuery);
    const motionMediaQuery = window.matchMedia(reducedMotionMediaQuery);
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
      applyThemeClass(preferences.appearance.theme, themeMediaQuery.matches);
    };

    const applyMotion = () => {
      applyReducedMotionAttribute(preferences.appearance.reducedMotion, motionMediaQuery.matches);
    };

    persistThemePreference(preferences.appearance.theme);
    persistReducedMotionPreference(preferences.appearance.reducedMotion);
    applyTheme();
    applyMotion();
    themeMediaQuery.addEventListener("change", applyTheme);
    motionMediaQuery.addEventListener("change", applyMotion);

    return () => {
      themeMediaQuery.removeEventListener("change", applyTheme);
      motionMediaQuery.removeEventListener("change", applyMotion);
    };
  }, [preferences]);

  return null;
}
