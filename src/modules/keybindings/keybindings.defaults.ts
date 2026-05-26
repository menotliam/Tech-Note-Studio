import type { KeybindingCommandId, KeybindingPreferences } from "./keybindings.types";

export const keybindingCommandIds = [
  "note.save",
  "editor.find",
  "editor.alignLeft",
  "editor.alignCenter",
  "editor.alignRight",
  "editor.toggleFocusMode",
  "editor.insertCodeBlock"
] as const satisfies readonly KeybindingCommandId[];

export const defaultEditorKeybindings: KeybindingPreferences = {
  "note.save": "Mod+S",
  "editor.find": "Mod+F",
  "editor.alignLeft": "Mod+L",
  "editor.alignCenter": "Mod+E",
  "editor.alignRight": "Mod+R",
  "editor.toggleFocusMode": "Mod+Q",
  "editor.insertCodeBlock": "Mod+M"
};
