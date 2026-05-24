"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Circle, GitCompareArrows, X } from "lucide-react";
import type { CurrentNoteForChrome, OpenNoteTab } from "../workspace-shell.types";
import {
  getCloseHref,
  loadOpenNoteTabs,
  saveOpenNoteTabs,
  upsertOpenNoteTab
} from "../open-tabs.client";

export function EditorTabStrip({
  currentNote,
  splitNote
}: {
  currentNote?: CurrentNoteForChrome | null;
  splitNote?: CurrentNoteForChrome | null;
}) {
  const router = useRouter();
  const [tabs, setTabs] = useState<OpenNoteTab[]>([]);

  useEffect(() => {
    setTabs(loadOpenNoteTabs());
  }, []);

  useEffect(() => {
    function handleCloseTab(event: Event) {
      const closingNoteId = (event as CustomEvent<{ noteId?: string }>).detail?.noteId;

      if (!closingNoteId) {
        return;
      }

      setTabs((current) => {
        const next = current.filter((candidate) => candidate.noteId !== closingNoteId);
        saveOpenNoteTabs(next);

        if (closingNoteId === currentNote?.id) {
          router.push(getCloseHref(next));
          return current;
        }

        return next;
      });
    }

    window.addEventListener("technote:close-tab", handleCloseTab);
    return () => window.removeEventListener("technote:close-tab", handleCloseTab);
  }, [currentNote?.id, router]);

  useEffect(() => {
    if (!currentNote) {
      return;
    }

    setTabs((current) => {
      const next = splitNote
        ? upsertOpenNoteTab(upsertOpenNoteTab(current, currentNote), splitNote)
        : upsertOpenNoteTab(current, currentNote);
      saveOpenNoteTabs(next);
      return next;
    });
  }, [currentNote, splitNote]);

  useEffect(() => {
    function handleDirty(event: Event) {
      const detail = (event as CustomEvent<{ noteId: string; dirty: boolean }>).detail;

      if (!detail?.noteId) {
        return;
      }

      setTabs((current) => {
        const next = current.map((tab) => (tab.noteId === detail.noteId ? { ...tab, dirty: detail.dirty } : tab));
        saveOpenNoteTabs(next);
        return next;
      });
    }

    window.addEventListener("technote:note-dirty", handleDirty);
    return () => window.removeEventListener("technote:note-dirty", handleDirty);
  }, []);

  const visibleTabs = useMemo(() => tabs.slice(0, 8), [tabs]);

  if (!currentNote) {
    return (
      <div className="flex h-10 items-center border-b border-border bg-panel px-3 text-xs text-muted-foreground">
        No editor tab
      </div>
    );
  }

  const activeNoteId = currentNote.id;
  const splitTarget = visibleTabs.find((tab) => tab.noteId !== activeNoteId);

  return (
    <div className="flex h-10 min-w-0 items-stretch overflow-hidden border-b border-border bg-panel">
      <div className="flex h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        {visibleTabs.map((tab) => {
          const active = tab.noteId === activeNoteId;
          const splitActive = tab.noteId === splitNote?.id;

          return (
            <div key={tab.noteId} className="group relative flex min-w-0 shrink-0">
              {active ? (
                <motion.span
                  layoutId="tab-active"
                  className="absolute inset-0 border-t-2 border-primary bg-background"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              ) : null}
              <Link
                href={`/notes/${tab.noteId}`}
                className={
                  "relative flex h-10 max-w-52 items-center gap-2 border-r border-border py-0 pl-3 pr-9 text-sm transition " +
                  (active ? "text-foreground" : splitActive ? "text-primary" : "text-muted-foreground hover:text-foreground")
                }
                title={tab.title}
              >
                {tab.dirty ? <Circle size={9} className="fill-yellow-400 text-yellow-400" /> : null}
                <span className="truncate">{tab.title}</span>
              </Link>
              {active ? (
                <Link
                  href={getCloseHref(visibleTabs, tab.noteId)}
                  className="absolute right-1 top-1 hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground group-hover:flex"
                  aria-label={`Close ${tab.title}`}
                  title="Close tab"
                  onClick={() => {
                    const next = tabs.filter((candidate) => candidate.noteId !== tab.noteId);
                    saveOpenNoteTabs(next);
                  }}
                >
                  <X size={14} />
                </Link>
              ) : (
                <button
                  type="button"
                  className="absolute right-1 top-1 hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground group-hover:flex"
                  aria-label={`Close ${tab.title}`}
                  title="Close tab"
                  onClick={() => {
                    const next = tabs.filter((candidate) => candidate.noteId !== tab.noteId);
                    setTabs(next);
                    saveOpenNoteTabs(next);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {splitTarget ? (
        <Link
          href={`/notes/${activeNoteId}?split=${splitTarget.noteId}`}
          className="flex w-10 items-center justify-center border-l border-border text-muted-foreground transition hover:bg-muted hover:text-primary"
          aria-label={`Open ${splitTarget.title} in split view`}
          title={`Split with ${splitTarget.title}`}
        >
          <GitCompareArrows size={15} />
        </Link>
      ) : (
        <div className="flex w-10 items-center justify-center border-l border-border text-muted-foreground opacity-50">
          <GitCompareArrows size={15} />
        </div>
      )}
    </div>
  );
}
