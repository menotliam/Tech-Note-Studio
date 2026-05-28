"use client";

import { useMemo, useState } from "react";
import { Download, GripVertical, Loader2, X } from "lucide-react";
import type { NoteSummary } from "@/modules/notes/note.types";
import { notificationCopy } from "@/modules/notifications/notification-copy";
import { notify } from "@/modules/notifications/notification.service";

type ExportMode = "bundle" | "zip";

export function MultiNoteExportForm({ notes }: { notes: NoteSummary[] }) {
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>("bundle");
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | null>(null);
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
    <section className="mt-6 rounded-md border border-border bg-background p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Export packet
        </h2>
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{selectedNoteIds.length} selected</span>
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
                className={
                  "flex items-center gap-2 rounded-md border bg-surface px-2 py-1.5 text-sm transition " +
                  (draggedNoteId === note.id ? "border-primary opacity-60" : "border-border")
                }
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
          <label
            key={note.id}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/60"
          >
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
        <ExportButton
          disabled={disabled || Boolean(exportingFormat)}
          href={`/api/export?${query}&format=pdf`}
          label="PDF"
          format="pdf"
          exporting={exportingFormat === "pdf"}
          onExportStart={() => setExportingFormat("pdf")}
          onExportEnd={() => setExportingFormat(null)}
        />
        <ExportButton
          disabled={disabled || Boolean(exportingFormat)}
          href={`/api/export?${query}&format=docx`}
          label="DOCX"
          format="docx"
          exporting={exportingFormat === "docx"}
          onExportStart={() => setExportingFormat("docx")}
          onExportEnd={() => setExportingFormat(null)}
        />
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

function ExportButton({
  disabled,
  href,
  label,
  format,
  exporting,
  onExportStart,
  onExportEnd
}: {
  disabled: boolean;
  href: string;
  label: string;
  format: "pdf" | "docx";
  exporting: boolean;
  onExportStart: () => void;
  onExportEnd: () => void;
}) {
  if (disabled) {
    return <ExportButtonChrome exporting={exporting} label={label} />;
  }

  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border text-sm hover:bg-muted"
      onClick={() => {
        void downloadExport({ href, format, onExportStart, onExportEnd });
      }}
    >
      <Download size={15} />
      {label}
    </button>
  );
}

function ExportButtonChrome({ exporting, label }: { exporting: boolean; label: string }) {
  return (
    <span className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border text-sm text-muted-foreground opacity-60">
      {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      {exporting ? "Exporting" : label}
    </span>
  );
}

async function downloadExport({
  href,
  format,
  onExportStart,
  onExportEnd
}: {
  href: string;
  format: "pdf" | "docx";
  onExportStart: () => void;
  onExportEnd: () => void;
}) {
  onExportStart();
  notify(notificationCopy.exportStarted(format));

  try {
    const response = await fetch(href);
    const blob = await response.blob();

    if (!response.ok) {
      throw new Error("Export failed.");
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getExportFilename(response, format);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify(notificationCopy.exportFinished(format));
  } catch {
    notify(notificationCopy.exportFailed());
  } finally {
    onExportEnd();
  }
}

function getExportFilename(response: Response, format: "pdf" | "docx") {
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  return filenameMatch?.[1] ?? `technote-export.${format}`;
}
