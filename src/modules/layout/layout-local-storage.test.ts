import { describe, expect, it } from "vitest";
import { layoutStorageKey } from "./panel-sizing";
import { readLocalLayoutPreferences, sanitizeLocalLayoutPreferences, writeLocalLayoutPreference } from "./layout-local-storage";

describe("layout local storage", () => {
  it("ignores invalid local layout values", () => {
    expect(sanitizeLocalLayoutPreferences(null)).toEqual({});
    expect(sanitizeLocalLayoutPreferences({ explorerWidth: "wide" })).toEqual({});
  });

  it("clamps supported panel widths", () => {
    expect(sanitizeLocalLayoutPreferences({ explorerWidth: 100 })).toEqual({ explorerWidth: 220 });
    expect(sanitizeLocalLayoutPreferences({ secondaryPanelWidth: 999 })).toEqual({ secondaryPanelWidth: 360 });
  });

  it("reads and writes layout width values without throwing", () => {
    window.localStorage.clear();

    writeLocalLayoutPreference("explorerWidth", 301);

    const saved = readLocalLayoutPreferences();
    expect(saved.explorerWidth).toBe(301);
    expect(typeof saved.updatedAt).toBe("string");
    expect(window.localStorage.getItem(layoutStorageKey)).toContain("explorerWidth");
  });
});

