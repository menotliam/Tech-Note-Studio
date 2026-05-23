import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EditorDocument } from "@/modules/editor/editor.types";
import { editorDocumentToExportDocument, exportDocumentsToBundle } from "@/modules/export/export.renderer";
import { exportNotesSchema } from "@/modules/export/export.schemas";
import { generateDocx, generateDocxBundle } from "@/modules/export/generators/docx.generator";
import { generatePdf, generatePdfBundle } from "@/modules/export/generators/pdf.generator";
import { generateZip } from "@/modules/export/generators/zip.generator";

type ExportNoteRow = {
  id: string;
  workspace_id: string;
  title: string;
  content_json: EditorDocument;
};

type ExportDocumentForDownload = ReturnType<typeof editorDocumentToExportDocument>;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const parsed = exportNotesSchema.safeParse({
    noteIds: getRequestedNoteIds(requestUrl),
    format: requestUrl.searchParams.get("format"),
    mode: requestUrl.searchParams.get("mode") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const uniqueNoteIds = [...new Set(parsed.data.noteIds)];
  const { data: notes, error: noteError } = await supabase
    .from("notes")
    .select("id, workspace_id, title, content_json")
    .eq("owner_id", user.id)
    .in("id", uniqueNoteIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (noteError) {
    return NextResponse.json({ error: "Could not load notes." }, { status: 500 });
  }

  if (!notes || notes.length !== uniqueNoteIds.length) {
    return NextResponse.json({ error: "One or more notes were not found." }, { status: 404 });
  }

  const exportNotes = orderNotesByRequest(uniqueNoteIds, notes as ExportNoteRow[]);
  const workspaceId = exportNotes[0]?.workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: "No notes selected." }, { status: 400 });
  }

  const { data: exportJob } = await supabase
    .from("export_jobs")
    .insert({
      owner_id: user.id,
      workspace_id: workspaceId,
      status: "processing",
      format: parsed.data.format,
      note_ids: exportNotes.map((note) => note.id)
    })
    .select("id")
    .single();

  try {
    const exportDocuments = exportNotes.map((note) => editorDocumentToExportDocument(note.title, note.content_json));
    const exportBundle = exportDocumentsToBundle(exportDocuments);
    const file =
      parsed.data.mode === "zip"
        ? await generateExportZip(exportDocuments, parsed.data.format)
        : parsed.data.format === "pdf"
          ? await generatePdfBundle(exportBundle)
          : await generateDocxBundle(exportBundle);
    const filename =
      parsed.data.mode === "zip"
        ? `${createSafeFileBase(exportBundle.title)}.zip`
        : createSafeFilename(exportBundle.title, parsed.data.format);

    if (exportJob?.id) {
      await supabase
        .from("export_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", exportJob.id)
        .eq("owner_id", user.id);
    }

    const responseBody = new Uint8Array(file);

    return new NextResponse(responseBody, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type":
          parsed.data.mode === "zip"
            ? "application/zip"
            : parsed.data.format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    });
  } catch (error) {
    if (exportJob?.id) {
      await supabase
        .from("export_jobs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Export failed.",
          completed_at: new Date().toISOString()
        })
        .eq("id", exportJob.id)
        .eq("owner_id", user.id);
    }

    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}

function createSafeFilename(title: string, format: "pdf" | "docx") {
  return `${createSafeFileBase(title)}.${format}`;
}

function createSafeFileBase(title: string) {
  return (
    title
      .trim()
      .normalize("NFD")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "d")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "note"
  );
}

function getRequestedNoteIds(requestUrl: URL) {
  const repeated = requestUrl.searchParams.getAll("noteIds");
  const legacySingle = requestUrl.searchParams.get("noteId");

  return [...repeated, legacySingle]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function orderNotesByRequest(noteIds: string[], notes: ExportNoteRow[]) {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  return noteIds.map((noteId) => noteById.get(noteId)).filter((note): note is ExportNoteRow => Boolean(note));
}

async function generateExportZip(documents: ExportDocumentForDownload[], format: "pdf" | "docx") {
  const usedNames = new Set<string>();
  const entries = await Promise.all(
    documents.map(async (document, index) => {
      const content = format === "pdf" ? await generatePdf(document) : await generateDocx(document);
      const name = createUniqueExportName(document.title, format, index, usedNames);

      return { name, content };
    })
  );

  return generateZip(entries);
}

function createUniqueExportName(
  title: string,
  format: "pdf" | "docx",
  index: number,
  usedNames: Set<string>
) {
  const prefix = String(index + 1).padStart(2, "0");
  const base = `${prefix}-${createSafeFileBase(title)}`;
  let candidate = `${base}.${format}`;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    candidate = `${base}-${suffix}.${format}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}
