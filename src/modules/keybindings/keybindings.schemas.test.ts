import { describe, expect, it } from "vitest";
import { defaultEditorKeybindings } from "./keybindings.defaults";
import { normalizeKeyboardEvent, normalizeShortcut } from "./keybindings.normalize";
import { normalizeKeybindingPreferences, validateKeybindingPreferences } from "./keybindings.schemas";

describe("keybindings", () => {
  it("normalizes shortcut strings", () => {
    expect(normalizeShortcut("cmd+shift+f")).toBe("Mod+Shift+F");
    expect(normalizeShortcut("ctrl+alt+enter")).toBe("Mod+Alt+Enter");
  });

  it("normalizes keyboard events to Mod shortcuts", () => {
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true
    });

    expect(normalizeKeyboardEvent(event)).toBe("Mod+S");
  });

  it("hydrates missing commands from defaults", () => {
    const keybindings = normalizeKeybindingPreferences({
      "editor.find": "Mod+Shift+F"
    });

    expect(keybindings["editor.find"]).toBe("Mod+Shift+F");
    expect(keybindings["note.save"]).toBe(defaultEditorKeybindings["note.save"]);
  });

  it("rejects duplicate shortcuts in the same scope", () => {
    const validation = validateKeybindingPreferences({
      ...defaultEditorKeybindings,
      "editor.find": "Mod+S"
    });

    expect(validation.ok).toBe(false);
  });

  it("rejects unsafe printable single-key shortcuts", () => {
    expect(() =>
      normalizeKeybindingPreferences({
        ...defaultEditorKeybindings,
        "editor.find": "f"
      })
    ).toThrow();
  });
});
