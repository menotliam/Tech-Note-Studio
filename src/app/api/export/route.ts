import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAccess } from "@/modules/access-control/access-control.api";
import { sanitizeEditorDocument } from "@/modules/editor/editor.sanitizer";
import type { EditorDocument } from "@/modules/editor/editor.types";
import { attachExportImageAssets, ExportImageLoadError } from "@/modules/export/export-image-loader";
import { editorDocumentToExportDocument, exportDocumentsToBundle } from "@/modules/export/export.renderer";
import { exportNotesSchema } from "@/modules/export/export.schemas";
import { generateDocx, generateDocxBundle } from "@/modules/export/generators/docx.generator";
import { generatePdf, generatePdfBundle } from "@/modules/export/generators/pdf.generator";
import { generateZip } from "@/modules/export/generators/zip.generator";
import { consumeRateLimit, createRateLimitKey, getRequestIp, isRateLimitEnabled } from "@/modules/rate-limit/rate-limit.service";
import { getSecurityRequestContext, logSecurityEvent } from "@/modules/security/security.repository";

type ExportNoteRow = {
  id: string;
  workspace_id: string;
  title: string;
  content_json: EditorDocument;
};

type ExportDocumentForDownload = ReturnType<typeof editorDocumentToExportDocument>;

const exportRateLimitWindowMs = 60_000;
const exportRateLimitMaxRequests = 10;
const exportRateLimit = {
  action: "export",
  limit: exportRateLimitMaxRequests,
  windowSeconds: exportRateLimitWindowMs / 1000
};

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const requestContext = getSecurityRequestContext(request);
  const supabase = await createSupabaseServerClient();
  const access = await requireApiAccess(supabase);

  if (!access.ok) {
    return access.response;
  }

  const { user } = access;

  const parsed = exportNotesSchema.safeParse({
    noteIds: getRequestedNoteIds(requestUrl),
    format: requestUrl.searchParams.get("format"),
    mode: requestUrl.searchParams.get("mode") ?? undefined
  });

  if (!parsed.success) {
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "INVALID_EXPORT_REQUEST",
      severity: "warning",
      ...requestContext,
      metadata: { issues: parsed.error.issues.map((issue) => issue.message) }
    });
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  }

  const rateLimit = isRateLimitEnabled(process.env.RATE_LIMIT_ENABLED)
    ? await consumeRateLimit(supabase, {
        ...exportRateLimit,
        key: createRateLimitKey([user.id, getRequestIp(request)])
      })
    : { allowed: true, retryAfterSeconds: exportRateLimit.windowSeconds };

  if (!rateLimit.allowed) {
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "INVALID_EXPORT_REQUEST",
      severity: "warning",
      ...requestContext,
      metadata: { reason: "rate_limited" }
    });
    return NextResponse.json(
      { error: "Too many export requests." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
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
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "EXPORT_ACCESS_DENIED",
      severity: "warning",
      ...requestContext,
      metadata: {
        requestedNoteCount: uniqueNoteIds.length,
        returnedNoteCount: notes?.length ?? 0,
        mode: parsed.data.mode ?? "bundle",
        format: parsed.data.format
      }
    });
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
    const exportDocuments = exportNotes.map((note) =>
      editorDocumentToExportDocument(note.title, sanitizeEditorDocument(note.content_json))
    );
    if (hasExportImages(exportDocuments)) {
      await attachExportImageAssets({
        ownerId: user.id,
        notes: exportNotes,
        documents: exportDocuments,
        metadataClient: supabase,
        storageClient: createSupabaseServiceRoleClient()
      });
    }
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
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "EXPORT_FAILED",
      severity: "warning",
      ...requestContext,
      metadata: { message: error instanceof Error ? error.message : "Export failed." }
    });

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

    return NextResponse.json({ error: getSafeExportErrorMessage(error) }, { status: 500 });
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

function hasExportImages(documents: ExportDocumentForDownload[]) {
  return documents.some((document) => document.blocks.some((block) => block.type === "image"));
}

function getSafeExportErrorMessage(error: unknown) {
  if (error instanceof ExportImageLoadError) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("Could not embed image in ")) {
    return error.message;
  }

  return "Export failed.";
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
