import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAccess } from "@/modules/access-control/access-control.api";

const fileIdSchema = z.string().uuid();
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type NoteFileRow = {
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const parsedFileId = fileIdSchema.safeParse(requestUrl.searchParams.get("fileId"));

  if (!parsedFileId.success) {
    return NextResponse.json({ error: "Invalid image request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const access = await requireApiAccess(supabase);

  if (!access.ok) {
    return access.response;
  }

  const { user } = access;

  const { data: file, error: fileError } = await supabase
    .from("note_files")
    .select("storage_bucket, storage_path, original_filename, mime_type")
    .eq("id", parsedFileId.data)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (fileError || !file) {
    return NextResponse.json({ error: "Image was not found." }, { status: 404 });
  }

  const noteFile = file as NoteFileRow;

  if (!allowedImageTypes.has(noteFile.mime_type)) {
    return NextResponse.json({ error: "Image was not found." }, { status: 404 });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(noteFile.storage_bucket)
    .download(noteFile.storage_path);

  if (downloadError || !blob) {
    return NextResponse.json({ error: "Image could not be loaded." }, { status: 404 });
  }

  const body = new Uint8Array(await blob.arrayBuffer());

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${createSafeFilename(noteFile.original_filename)}"`,
      "Content-Type": noteFile.mime_type,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function createSafeFilename(value: string | null) {
  return value?.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "image";
}
