import { z } from "zod";
import { defaultEditorKeybindings, keybindingCommandIds } from "./keybindings.defaults";
import { normalizeShortcut, isSafeShortcut } from "./keybindings.normalize";
import { keybindingCommandMap } from "./keybindings.registry";
import type { KeybindingCommandId, KeybindingPreferences, KeybindingScope } from "./keybindings.types";

export const keybindingPreferencesSchema = z
  .preprocess(
    (input) => ({ ...defaultEditorKeybindings, ...(isRecord(input) ? input : {}) }),
    z
      .object(createKeybindingPreferenceShape())
      .strict()
  )
  .superRefine((value, context) => {
    const conflict = validateKeybindingPreferences(value as KeybindingPreferences);

    if (!conflict.ok) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: conflict.message
      });
    }
  }) as z.ZodType<KeybindingPreferences>;

export const keybindingPreferencesPatchSchema = keybindingPreferencesSchema;

function createKeybindingPreferenceShape() {
  return keybindingCommandIds.reduce(
    (shape, commandId) => {
      shape[commandId] = z
        .string()
        .trim()
        .transform((shortcut, context) => {
          const normalizedShortcut = normalizeShortcut(shortcut);

          if (!normalizedShortcut) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid shortcut for ${commandId}.`
            });
            return z.NEVER;
          }

          return normalizedShortcut;
        });

      return shape;
    },
    {} as Record<KeybindingCommandId, z.ZodType<string>>
  );
}

export function normalizeKeybindingPreferences(input?: Partial<Record<string, string>>) {
  return keybindingPreferencesSchema.parse(input ?? {});
}

export function validateKeybindingPreferences(keybindings: KeybindingPreferences):
  | { ok: true }
  | { ok: false; message: string } {
  const shortcutsByScope = new Map<KeybindingScope, Map<string, string>>();

  for (const [commandId, shortcut] of Object.entries(keybindings)) {
    const command = keybindingCommandMap.get(commandId as KeybindingCommandId);

    if (!command) {
      return { ok: false, message: `Unsupported command: ${commandId}` };
    }

    const normalizedShortcut = normalizeShortcut(shortcut);

    if (!normalizedShortcut || !isSafeShortcut(normalizedShortcut)) {
      return { ok: false, message: `Invalid shortcut for ${commandId}.` };
    }

    const scopeShortcuts = shortcutsByScope.get(command.scope) ?? new Map<string, string>();
    const existingCommandId = scopeShortcuts.get(normalizedShortcut.toLowerCase());

    if (existingCommandId) {
      return {
        ok: false,
        message: `${normalizedShortcut} is already assigned to ${existingCommandId}.`
      };
    }

    scopeShortcuts.set(normalizedShortcut.toLowerCase(), commandId);
    shortcutsByScope.set(command.scope, scopeShortcuts);
  }

  return { ok: true };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
