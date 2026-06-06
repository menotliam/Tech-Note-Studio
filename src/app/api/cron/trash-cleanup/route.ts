import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  hardDeleteTrashedFoldersByIds,
  hardDeleteTrashedNotesByIds
} from "@/modules/notes/note-lifecycle.service";
import { getSecurityRequestContext, logSecurityEvent } from "@/modules/security/security.repository";

const retentionMs = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  return handleTrashCleanupRequest(request);
}

export async function POST(request: NextRequest) {
  return handleTrashCleanupRequest(request);
}

async function handleTrashCleanupRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const requestContext = getSecurityRequestContext(request);
  const cutoff = new Date(Date.now() - retentionMs).toISOString();

  await logSecurityEvent(supabase, {
    userId: null,
    eventType: "TRASH_CLEANUP_STARTED",
    severity: "info",
    ...requestContext,
    metadata: { cutoff }
  });

  try {
    const { data: expiredNotes, error: notesError } = await supabase
      .from("notes")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (notesError) {
      throw notesError;
    }

    const { data: expiredFolders, error: foldersError } = await supabase
      .from("folders")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (foldersError) {
      throw foldersError;
    }

    const expiredFolderIds = (expiredFolders as Array<{ id: string }>).map((folder) => folder.id);
    const noteResult = await hardDeleteTrashedNotesByIds(
      supabase,
      (expiredNotes as Array<{ id: string }>).map((note) => note.id)
    );
    const folderResult = await hardDeleteTrashedFoldersByIds(supabase, expiredFolderIds);

    await logSecurityEvent(supabase, {
      userId: null,
      eventType: "TRASH_CLEANUP_COMPLETED",
      severity: "info",
      ...requestContext,
      metadata: {
        cutoff,
        ...noteResult,
        ...folderResult
      }
    });

    return NextResponse.json({
      ok: true,
      cutoff,
      ...noteResult,
      ...folderResult
    });
  } catch (error) {
    await logSecurityEvent(supabase, {
      userId: null,
      eventType: "TRASH_CLEANUP_FAILED",
      severity: "critical",
      ...requestContext,
      metadata: { cutoff, message: error instanceof Error ? error.message : "Unknown cleanup error." }
    });

    return NextResponse.json({ error: "Trash cleanup failed." }, { status: 500 });
  }
}
