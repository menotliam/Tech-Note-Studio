import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { getNoteById, listNotes } from "@/modules/notes/note.repository";
import { noteIdSchema, noteSearchSchema } from "@/modules/notes/note.schemas";
import { listFolders, listTags } from "@/modules/organization/organization.repository";
import { organizationIdSchema } from "@/modules/organization/organization.schemas";
import { listSystemTemplates } from "@/modules/templates/template.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function NotePage({
  params,
  searchParams
}: {
  params: Promise<{ noteId: string }>;
  searchParams?: Promise<{ q?: string; folder?: string; tag?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { workspaceId } = await ensureUserFoundation(supabase, user);
  if (!workspaceId) {
    throw new Error("Default workspace is missing.");
  }

  const resolvedParams = await params;
  const noteId = noteIdSchema.safeParse(resolvedParams.noteId);

  if (!noteId.success) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const searchQuery = noteSearchSchema.parse(resolvedSearchParams?.q);
  const folderId = resolvedSearchParams?.folder
    ? organizationIdSchema.parse(resolvedSearchParams.folder)
    : undefined;
  const tagId = resolvedSearchParams?.tag ? organizationIdSchema.parse(resolvedSearchParams.tag) : undefined;
  const [notes, selectedNote, templates, folders, tags] = await Promise.all([
    listNotes(supabase, user.id, searchQuery, { folderId, tagId }),
    getNoteById(supabase, user.id, noteId.data),
    listSystemTemplates(supabase),
    listFolders(supabase, user.id, workspaceId),
    listTags(supabase, user.id, workspaceId)
  ]);

  if (!selectedNote || selectedNote.isArchived) {
    notFound();
  }

  return (
    <DashboardShell
      userEmail={user.email ?? "Signed in"}
      notes={notes}
      templates={templates}
      folders={folders}
      tags={tags}
      selectedNote={selectedNote}
      searchQuery={searchQuery ?? ""}
      activeFolderId={folderId}
      activeTagId={tagId}
    />
  );
}
