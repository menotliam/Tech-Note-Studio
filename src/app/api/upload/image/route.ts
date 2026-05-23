import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { noteIdSchema } from "@/modules/notes/note.schemas";
import { getSecurityRequestContext, logSecurityEvent } from "@/modules/security/security.repository";

const allowedImageTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);
const maxImageSizeBytes = 10 * 1024 * 1024;
const bucketName = process.env.SUPABASE_NOTE_FILES_BUCKET ?? "note-files";

export async function POST(request: NextRequest) {
  const requestContext = getSecurityRequestContext(request);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const parsedNoteId = noteIdSchema.safeParse(formData.get("noteId"));
  const file = formData.get("file");

  if (!parsedNoteId.success || !(file instanceof File)) {
    await logRejectedUpload("invalid_request", user.id, requestContext, supabase);
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    await logRejectedUpload("unsupported_type", user.id, requestContext, supabase, { mimeType: file.type });
    return NextResponse.json({ error: "Only PNG, JPEG, and WebP images are allowed." }, { status: 415 });
  }

  if (file.size <= 0 || file.size > maxImageSizeBytes) {
    await logRejectedUpload("invalid_size", user.id, requestContext, supabase, { size: file.size });
    return NextResponse.json({ error: "Image must be between 1 byte and 10 MB." }, { status: 413 });
  }

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id, workspace_id")
    .eq("id", parsedNoteId.data)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (noteError || !note) {
    await logRejectedUpload("note_not_found", user.id, requestContext, supabase, { noteId: parsedNoteId.data });
    return NextResponse.json({ error: "Note was not found." }, { status: 404 });
  }

  const storagePath = `${user.id}/${note.workspace_id}/${note.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    await logRejectedUpload("storage_upload_failed", user.id, requestContext, supabase, {
      message: uploadError.message
    });
    return NextResponse.json({ error: "Image upload failed." }, { status: 500 });
  }

  const { error: metadataError } = await supabase.from("note_files").insert({
    owner_id: user.id,
    workspace_id: note.workspace_id,
    note_id: note.id,
    storage_bucket: bucketName,
    storage_path: storagePath,
    original_filename: sanitizeFilename(file.name),
    mime_type: file.type,
    size_bytes: file.size
  });

  if (metadataError) {
    await supabase.storage.from(bucketName).remove([storagePath]);
    await logRejectedUpload("metadata_insert_failed", user.id, requestContext, supabase, {
      message: metadataError.message
    });
    return NextResponse.json({ error: "Image metadata could not be saved." }, { status: 500 });
  }

  const publicUrl = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
  return NextResponse.json({ src: publicUrl, alt: sanitizeFilename(file.name), storagePath });
}

async function logRejectedUpload(
  reason: string,
  userId: string,
  requestContext: ReturnType<typeof getSecurityRequestContext>,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  metadata?: Record<string, unknown>
) {
  await logSecurityEvent(supabase, {
    userId,
    eventType: "FILE_UPLOAD_REJECTED",
    severity: "warning",
    ...requestContext,
    metadata: { reason, ...metadata }
  });
}

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "image";
}
