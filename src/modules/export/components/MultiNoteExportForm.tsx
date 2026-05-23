"use client";

import { useMemo, useState } from "react";
import { Download, GripVertical, X } from "lucide-react";
import type { NoteSummary } from "@/modules/notes/note.types";

type ExportMode = "bundle" | "zip";

export function MultiNoteExportForm({ notes }: { notes: NoteSummary[] }) {
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>("bundle");
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const selectedNotes = selectedNoteIds
    .map((noteId) => noteById.get(noteId))
    .filter((note): note is NoteSummary => Boolean(note));
  const query = useMemo(() => {
    const params = new URLSearchParams();
    selectedNoteIds.forEach((noteId) => params.append("noteIds", noteId));
    params.set("mode", exportMode);
    return params.toString();
  }, [exportMode, selectedNoteIds]);
  const disabled = selectedNoteIds.length === 0;

  return (
    <section className="mt-6 rounded-md border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Export packet
        </h2>
        <span className="text-xs text-muted-foreground">{selectedNoteIds.length} selected</span>
      </div>

      {selectedNotes.length > 0 ? (
        <div className="mb-3 space-y-1 border-b border-border pb-3">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Export order
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {selectedNotes.map((note, index) => (
              <div
                key={note.id}
                draggable
                onDragStart={() => setDraggedNoteId(note.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  if (draggedNoteId) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const placeAfter = event.clientY > rect.top + rect.height / 2;
                    setSelectedNoteIds((current) => moveSelectedNote(current, draggedNoteId, note.id, placeAfter));
                  }
                  setDraggedNoteId(null);
                }}
                onDragEnd={() => setDraggedNoteId(null)}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              >
                <GripVertical size={15} className="shrink-0 cursor-grab text-muted-foreground" />
                <span className="w-6 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate">{note.title}</span>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${note.title} from export`}
                  onClick={() =>
                    setSelectedNoteIds((current) => current.filter((noteId) => noteId !== note.id))
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
        {notes.map((note) => (
          <label key={note.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={selectedNoteIds.includes(note.id)}
              onChange={(event) => {
                setSelectedNoteIds((current) =>
                  event.target.checked
                    ? [...current, note.id]
                    : current.filter((noteId) => noteId !== note.id)
                );
              }}
            />
            <span className="line-clamp-2">{note.title}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-surface p-1">
        <ModeButton active={exportMode === "bundle"} label="One file" onClick={() => setExportMode("bundle")} />
        <ModeButton active={exportMode === "zip"} label="ZIP files" onClick={() => setExportMode("zip")} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ExportLink disabled={disabled} href={`/api/export?${query}&format=pdf`} label="PDF" />
        <ExportLink disabled={disabled} href={`/api/export?${query}&format=docx`} label="DOCX" />
      </div>
    </section>
  );
}

function moveSelectedNote(noteIds: string[], draggedNoteId: string, targetNoteId: string, placeAfter: boolean) {
  if (draggedNoteId === targetNoteId) {
    return noteIds;
  }

  const next = noteIds.filter((noteId) => noteId !== draggedNoteId);
  const targetIndex = next.indexOf(targetNoteId);

  if (targetIndex === -1) {
    return noteIds;
  }

  next.splice(placeAfter ? targetIndex + 1 : targetIndex, 0, draggedNoteId);
  return next;
}

function ModeButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        "h-8 rounded-md px-2 text-sm transition " +
        (active ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ExportLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border text-sm text-muted-foreground opacity-60">
        <Download size={15} />
        {label}
      </span>
    );
  }

  return (
    <a
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border text-sm hover:bg-muted"
      href={href}
    >
      <Download size={15} />
      {label}
    </a>
  );
}
