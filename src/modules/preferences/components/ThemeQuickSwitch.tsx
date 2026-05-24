"use client";

import { useState } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import { syncThemePreference } from "@/modules/preferences/preferences.theme";
import type { ThemePreference } from "@/modules/preferences/preferences.types";

const nextTheme: Record<ThemePreference, ThemePreference> = {
  system: "dark",
  dark: "light",
  light: "system"
};

export function ThemeQuickSwitch({ initialTheme }: { initialTheme: ThemePreference }) {
  const [theme, setTheme] = useState(initialTheme);

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Sparkles;

  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
      aria-label="Switch theme"
      title={`Theme: ${theme}`}
      onClick={() => {
        const next = nextTheme[theme];
        setTheme(next);
        syncThemePreference(next);
        void fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appearance: { theme: next } })
        });
      }}
    >
      <Icon size={16} />
    </button>
  );
}
