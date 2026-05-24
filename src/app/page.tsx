import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { listNotes } from "@/modules/notes/note.repository";
import { noteSearchSchema } from "@/modules/notes/note.schemas";
import { listFolders, listTags } from "@/modules/organization/organization.repository";
import { organizationIdSchema } from "@/modules/organization/organization.schemas";
import { loadUserPreferences } from "@/modules/preferences/preferences.service";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.repository";
import { listSystemTemplates } from "@/modules/templates/template.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function HomePage({
  searchParams
}: {
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
  const params = await searchParams;
  const searchQuery = noteSearchSchema.parse(params?.q);
  const folderId = params?.folder ? organizationIdSchema.parse(params.folder) : undefined;
  const tagId = params?.tag ? organizationIdSchema.parse(params.tag) : undefined;
  const [notes, templates, folders, tags, preferences, workspace] = await Promise.all([
    listNotes(supabase, user.id),
    listSystemTemplates(supabase),
    listFolders(supabase, user.id, workspaceId),
    listTags(supabase, user.id, workspaceId),
    loadUserPreferences(supabase, user.id),
    getWorkspaceSummary(supabase, user.id, workspaceId)
  ]);

  return (
    <DashboardShell
      userEmail={user.email ?? "Signed in"}
      notes={notes}
      templates={templates}
      folders={folders}
      tags={tags}
      preferences={preferences}
      workspace={workspace}
      searchQuery={searchQuery ?? ""}
      activeFolderId={folderId}
      activeTagId={tagId}
    />
  );
}
