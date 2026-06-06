import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { getNoteById, listNotes } from "@/modules/notes/note.repository";
import { noteIdSchema, noteSearchSchema } from "@/modules/notes/note.schemas";
import { listFolders, listTags } from "@/modules/organization/organization.repository";
import { organizationIdSchema } from "@/modules/organization/organization.schemas";
import { loadUserPreferences } from "@/modules/preferences/preferences.service";
import { listSystemTemplates } from "@/modules/templates/template.repository";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";
import type { WorkspaceActivity } from "@/modules/workspace-shell/workspace-shell.types";

export default async function NotePage({
  params,
  searchParams
}: {
  params: Promise<{ noteId: string }>;
  searchParams?: Promise<{ q?: string; folder?: string; tag?: string; explorerTag?: string; panel?: string; split?: string }>;
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
  const explorerTagId = resolvedSearchParams?.explorerTag
    ? organizationIdSchema.parse(resolvedSearchParams.explorerTag)
    : undefined;
  const requestedPanel = parseWorkspaceActivity(resolvedSearchParams?.panel);
  const splitNoteId =
    resolvedSearchParams?.split && resolvedSearchParams.split !== noteId.data
      ? noteIdSchema.safeParse(resolvedSearchParams.split)
      : null;
  const [notes, selectedNote, splitNote, templates, folders, tags, preferences, workspace] = await Promise.all([
    listNotes(supabase, user.id),
    getNoteById(supabase, user.id, noteId.data),
    splitNoteId?.success ? getNoteById(supabase, user.id, splitNoteId.data) : Promise.resolve(null),
    listSystemTemplates(supabase),
    listFolders(supabase, user.id, workspaceId),
    listTags(supabase, user.id, workspaceId),
    loadUserPreferences(supabase, user.id),
    getWorkspaceSummary(supabase, user.id, workspaceId)
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
      preferences={preferences}
      workspace={workspace}
      selectedNote={selectedNote}
      splitNote={splitNote?.isArchived ? null : splitNote}
      searchQuery={searchQuery ?? ""}
      activeFolderId={folderId}
      activeTagId={tagId}
      activeExplorerTagId={explorerTagId}
      requestedActivity={requestedPanel}
    />
  );
}

function parseWorkspaceActivity(value?: string): WorkspaceActivity | undefined {
  if (value === "explorer" || value === "search" || value === "templates" || value === "tags" || value === "export") {
    return value;
  }

  return undefined;
}
