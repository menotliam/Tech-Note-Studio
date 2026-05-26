import type {
  KeybindingCommandDefinition,
  KeybindingCommandId,
  KeybindingPreferences,
  KeybindingScope
} from "./keybindings.types";

export const keybindingCommands: KeybindingCommandDefinition[] = [
  { id: "note.save", label: "Save current note", scope: "editor" },
  { id: "editor.find", label: "Open editor find", scope: "editor" },
  { id: "editor.alignLeft", label: "Align left", scope: "editor" },
  { id: "editor.alignCenter", label: "Align center", scope: "editor" },
  { id: "editor.alignRight", label: "Align right", scope: "editor" },
  { id: "editor.toggleFocusMode", label: "Toggle focus mode", scope: "editor" },
  { id: "editor.insertCodeBlock", label: "Insert code block", scope: "editor" }
];

export const keybindingCommandMap = new Map<KeybindingCommandId, KeybindingCommandDefinition>(
  keybindingCommands.map((command) => [command.id, command])
);

export function resolveKeybindingCommand(
  keybindings: KeybindingPreferences,
  scope: KeybindingScope,
  shortcut: string
) {
  const normalizedShortcut = shortcut.toLowerCase();

  return keybindingCommands.find((command) => {
    if (command.scope !== scope) {
      return false;
    }

    return keybindings[command.id].toLowerCase() === normalizedShortcut;
  })?.id;
}
