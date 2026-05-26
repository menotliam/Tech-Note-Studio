export type KeybindingScope = "editor" | "global";

export type KeybindingCommandId =
  | "note.save"
  | "editor.find"
  | "editor.alignLeft"
  | "editor.alignCenter"
  | "editor.alignRight"
  | "editor.toggleFocusMode"
  | "editor.insertCodeBlock";

export type KeybindingPreferences = Record<KeybindingCommandId, string>;

export type KeybindingCommandDefinition = {
  id: KeybindingCommandId;
  label: string;
  scope: KeybindingScope;
};
