import type { CurrentNoteForChrome, OpenNoteTab } from "./workspace-shell.types";

export const openTabsStorageKey = "tech-note-studio.open-tabs";

export function upsertOpenNoteTab(current: OpenNoteTab[], note: CurrentNoteForChrome): OpenNoteTab[] {
  const now = new Date().toISOString();
  const existing = current.find((tab) => tab.noteId === note.id);
  const withoutCurrent = current.filter((tab) => tab.noteId !== note.id);

  return [
    {
      noteId: note.id,
      title: note.title,
      dirty: existing?.dirty ?? false,
      lastOpenedAt: now
    },
    ...withoutCurrent
  ];
}

export function loadOpenNoteTabs(): OpenNoteTab[] {
  try {
    const value = window.sessionStorage.getItem(openTabsStorageKey);
    return value ? (JSON.parse(value) as OpenNoteTab[]) : [];
  } catch {
    return [];
  }
}

export function saveOpenNoteTabs(tabs: OpenNoteTab[]) {
  window.sessionStorage.setItem(openTabsStorageKey, JSON.stringify(tabs.slice(0, 12)));
}

export function removeOpenNoteTab(noteId: string) {
  const next = loadOpenNoteTabs().filter((tab) => tab.noteId !== noteId);
  saveOpenNoteTabs(next);
}

export function getCloseHref(tabs: OpenNoteTab[], closingNoteId?: string) {
  const nextTab = tabs.find((tab) => tab.noteId !== closingNoteId);
  return nextTab ? `/notes/${nextTab.noteId}` : "/";
}
