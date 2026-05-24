import type { CSSProperties } from "react";
import type { AccentPreset, GradientPreset, UserPreferences } from "./preferences.types";

export type AccentPresetDefinition = {
  id: AccentPreset;
  label: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
};

export type GradientPresetDefinition = {
  id: GradientPreset;
  label: string;
  value: string;
};

export const accentPresetDefinitions: AccentPresetDefinition[] = [
  {
    id: "cyan",
    label: "Cyan",
    primary: "188 92% 44%",
    primaryForeground: "222 47% 8%",
    accent: "266 92% 68%",
    accentForeground: "0 0% 100%"
  },
  {
    id: "blue",
    label: "Blue",
    primary: "217 91% 60%",
    primaryForeground: "0 0% 100%",
    accent: "160 84% 39%",
    accentForeground: "222 47% 8%"
  },
  {
    id: "violet",
    label: "Violet",
    primary: "262 83% 64%",
    primaryForeground: "0 0% 100%",
    accent: "330 81% 60%",
    accentForeground: "0 0% 100%"
  },
  {
    id: "emerald",
    label: "Emerald",
    primary: "160 84% 39%",
    primaryForeground: "222 47% 8%",
    accent: "188 92% 44%",
    accentForeground: "222 47% 8%"
  },
  {
    id: "amber",
    label: "Amber",
    primary: "38 92% 50%",
    primaryForeground: "222 47% 8%",
    accent: "217 91% 60%",
    accentForeground: "0 0% 100%"
  },
  {
    id: "rose",
    label: "Rose",
    primary: "346 77% 58%",
    primaryForeground: "0 0% 100%",
    accent: "38 92% 50%",
    accentForeground: "222 47% 8%"
  }
];

export const gradientPresetDefinitions: GradientPresetDefinition[] = [
  { id: "cyan-purple", label: "Cyan purple", value: "linear-gradient(135deg, #22d3ee, #8b5cf6)" },
  { id: "blue-emerald", label: "Blue emerald", value: "linear-gradient(135deg, #3b82f6, #10b981)" },
  { id: "violet-rose", label: "Violet rose", value: "linear-gradient(135deg, #8b5cf6, #f43f5e)" },
  { id: "amber-rose", label: "Amber rose", value: "linear-gradient(135deg, #f59e0b, #f43f5e)" }
];

export function getAccentPresetDefinition(id: AccentPreset) {
  return accentPresetDefinitions.find((preset) => preset.id === id) ?? accentPresetDefinitions[0];
}

export function getGradientPresetDefinition(id: GradientPreset | null) {
  if (!id) {
    return null;
  }

  return gradientPresetDefinitions.find((preset) => preset.id === id) ?? gradientPresetDefinitions[0];
}

export function getPreferenceStyle(preferences: UserPreferences): CSSProperties {
  const accent = getAccentPresetDefinition(preferences.appearance.accentPreset);
  const gradient = getGradientPresetDefinition(preferences.appearance.gradientPreset);

  return {
    "--primary": accent.primary,
    "--primary-foreground": accent.primaryForeground,
    "--accent": accent.accent,
    "--accent-foreground": accent.accentForeground,
    "--accent-gradient": gradient?.value ?? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))"
  } as CSSProperties;
}
