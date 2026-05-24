import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyThemeClass, persistThemePreference, shouldUseDarkTheme, syncThemePreference } from "./preferences.theme";

function mockSystemTheme(systemPrefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: systemPrefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  });
}

describe("preference theme helpers", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    window.localStorage.clear();
    mockSystemTheme(false);
  });

  it("resolves dark mode for explicit and system theme values", () => {
    expect(shouldUseDarkTheme("dark", false)).toBe(true);
    expect(shouldUseDarkTheme("light", true)).toBe(false);
    expect(shouldUseDarkTheme("system", true)).toBe(true);
    expect(shouldUseDarkTheme("system", false)).toBe(false);
  });

  it("applies the theme class without persisting", () => {
    applyThemeClass("dark", false);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    applyThemeClass("light", true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("technote.theme")).toBeNull();
  });

  it("persists the selected theme for the first paint script", () => {
    persistThemePreference("system");

    expect(window.localStorage.getItem("technote.theme")).toBe("system");
  });

  it("syncs quick-switch changes to both html class and local storage", () => {
    document.documentElement.classList.add("dark");
    window.localStorage.setItem("technote.theme", "dark");

    syncThemePreference("light");

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("technote.theme")).toBe("light");
  });

  it("uses the current system preference when syncing system theme", () => {
    mockSystemTheme(true);

    syncThemePreference("system");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("technote.theme")).toBe("system");
  });
});
