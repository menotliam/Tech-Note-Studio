import type { LocalLayoutPreferencesV03, PanelWidthKey } from "./layout-preferences.types";
import { clampPanelWidth, layoutStorageKey, panelWidthLimits } from "./panel-sizing";

export function readLocalLayoutPreferences(storage: Storage | undefined = getStorage()) {
  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(layoutStorageKey);

    if (!rawValue) {
      return {};
    }

    return sanitizeLocalLayoutPreferences(JSON.parse(rawValue));
  } catch {
    return {};
  }
}

export function writeLocalLayoutPreference(
  key: PanelWidthKey,
  width: number,
  storage: Storage | undefined = getStorage()
) {
  if (!storage) {
    return;
  }

  try {
    const current = readLocalLayoutPreferences(storage);
    const next: LocalLayoutPreferencesV03 = {
      ...current,
      [key]: clampPanelWidth(key, width),
      updatedAt: new Date().toISOString()
    };

    storage.setItem(layoutStorageKey, JSON.stringify(next));
  } catch {
    // Layout persistence must never block the workspace.
  }
}

export function sanitizeLocalLayoutPreferences(input: unknown): LocalLayoutPreferencesV03 {
  if (!isRecord(input)) {
    return {};
  }

  const output: LocalLayoutPreferencesV03 = {};

  for (const key of Object.keys(panelWidthLimits) as PanelWidthKey[]) {
    const value = input[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = clampPanelWidth(key, value);
    }
  }

  if (typeof input.updatedAt === "string") {
    output.updatedAt = input.updatedAt;
  }

  return output;
}

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

