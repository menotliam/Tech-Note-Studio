import type { ThemePreference } from "./preferences.types";

export const themeStorageKey = "technote.theme";
export const darkModeMediaQuery = "(prefers-color-scheme: dark)";

export function shouldUseDarkTheme(theme: ThemePreference, systemPrefersDark: boolean) {
  return theme === "dark" || (theme === "system" && systemPrefersDark);
}

export function applyThemeClass(theme: ThemePreference, systemPrefersDark: boolean) {
  document.documentElement.classList.toggle("dark", shouldUseDarkTheme(theme, systemPrefersDark));
}

export function persistThemePreference(theme: ThemePreference) {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The visible theme should still update when storage is unavailable.
  }
}

export function syncThemePreference(theme: ThemePreference) {
  const systemPrefersDark = window.matchMedia(darkModeMediaQuery).matches;

  applyThemeClass(theme, systemPrefersDark);
  persistThemePreference(theme);
}
