import { beforeEach, describe, expect, it } from "vitest";
import {
  getCloseHref,
  loadOpenNoteTabs,
  openTabsStorageKey,
  removeOpenNoteTab,
  saveOpenNoteTabs,
  upsertOpenNoteTab
} from "./open-tabs.client";
import type { OpenNoteTab } from "./workspace-shell.types";

const firstTab: OpenNoteTab = {
  noteId: "note-1",
  title: "First",
  dirty: false,
  lastOpenedAt: "2026-05-24T00:00:00.000Z"
};

const secondTab: OpenNoteTab = {
  noteId: "note-2",
  title: "Second",
  dirty: true,
  lastOpenedAt: "2026-05-24T00:01:00.000Z"
};

describe("open note tabs storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("loads an empty tab list when storage is missing or invalid", () => {
    expect(loadOpenNoteTabs()).toEqual([]);

    window.sessionStorage.setItem(openTabsStorageKey, "{");

    expect(loadOpenNoteTabs()).toEqual([]);
  });

  it("saves at most twelve tabs", () => {
    const tabs = Array.from({ length: 14 }, (_, index) => ({
      noteId: `note-${index}`,
      title: `Note ${index}`,
      dirty: false,
      lastOpenedAt: "2026-05-24T00:00:00.000Z"
    }));

    saveOpenNoteTabs(tabs);

    expect(loadOpenNoteTabs()).toHaveLength(12);
  });

  it("removes a deleted or archived note from session storage", () => {
    saveOpenNoteTabs([firstTab, secondTab]);

    removeOpenNoteTab("note-1");

    expect(loadOpenNoteTabs()).toEqual([secondTab]);
  });

  it("upserts the current note at the front while preserving dirty state", () => {
    const [updatedTab] = upsertOpenNoteTab([firstTab], {
      id: "note-1",
      title: "First renamed",
      contentJson: { type: "doc", schemaVersion: 1, content: [] }
    });

    expect(updatedTab).toMatchObject({
      noteId: "note-1",
      title: "First renamed",
      dirty: false
    });
  });

  it("resolves the next close target", () => {
    expect(getCloseHref([firstTab, secondTab], "note-1")).toBe("/notes/note-2");
    expect(getCloseHref([firstTab], "note-1")).toBe("/");
  });
});
