const modifierOrder = ["Mod", "Alt", "Shift"] as const;
const unsafeBrowserShortcuts = new Set(["Mod+N", "Mod+P", "Mod+T", "Mod+W", "Mod+Shift+W"]);
const reservedKeyAliases: Record<string, string> = {
  " ": "Space",
  spacebar: "Space",
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  del: "Delete",
  delete: "Delete",
  backspace: "Backspace",
  tab: "Tab",
  up: "ArrowUp",
  arrowup: "ArrowUp",
  down: "ArrowDown",
  arrowdown: "ArrowDown",
  left: "ArrowLeft",
  arrowleft: "ArrowLeft",
  right: "ArrowRight",
  arrowright: "ArrowRight"
};

export function normalizeKeyboardEvent(event: KeyboardEvent) {
  if (event.key === "Control" || event.key === "Alt" || event.key === "Shift" || event.key === "Meta") {
    return null;
  }

  const modifiers = new Set<string>();

  if (event.altKey) {
    modifiers.add("Alt");
  }

  if (event.shiftKey) {
    modifiers.add("Shift");
  }

  if (event.ctrlKey || event.metaKey) {
    modifiers.add("Mod");
  }

  return [...modifierOrder.filter((modifier) => modifiers.has(modifier)), normalizeKeyToken(event.key)].join("+");
}

export function normalizeShortcut(input: string) {
  const rawParts = input
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length === 0) {
    return null;
  }

  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const part of rawParts) {
    const lowerPart = part.toLowerCase();

    if (lowerPart === "cmd" || lowerPart === "command" || lowerPart === "meta" || lowerPart === "mod") {
      modifiers.add("Mod");
      continue;
    }

    if (lowerPart === "ctrl" || lowerPart === "control") {
      modifiers.add("Mod");
      continue;
    }

    if (lowerPart === "alt" || lowerPart === "option") {
      modifiers.add("Alt");
      continue;
    }

    if (lowerPart === "shift") {
      modifiers.add("Shift");
      continue;
    }

    if (key) {
      return null;
    }

    key = normalizeKeyToken(part);
  }

  if (!key || modifiers.has(key)) {
    return null;
  }

  return [...modifierOrder.filter((modifier) => modifiers.has(modifier)), key].join("+");
}

export function isSafeShortcut(shortcut: string) {
  const normalizedShortcut = normalizeShortcut(shortcut);

  if (!normalizedShortcut) {
    return false;
  }

  const parts = normalizedShortcut.split("+");
  const key = parts.at(-1) ?? "";
  const modifierCount = parts.length - 1;

  if (modifierCount === 0 && isPrintableKey(key)) {
    return false;
  }

  if (unsafeBrowserShortcuts.has(normalizedShortcut)) {
    return false;
  }

  return true;
}

function normalizeKeyToken(value: string) {
  const trimmed = value.trim();
  const alias = reservedKeyAliases[trimmed.toLowerCase()];

  if (alias) {
    return alias;
  }

  if (/^f([1-9]|1[0-2])$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function isPrintableKey(key: string) {
  return key.length === 1 || key === "Space";
}
