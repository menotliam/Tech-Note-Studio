import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { listTrashedNotes } from "@/modules/notes/note.repository";
import { listTags, listTrashedFolders } from "@/modules/organization/organization.repository";
import { loadUserPreferences } from "@/modules/preferences/preferences.service";
import { listSystemTemplates } from "@/modules/templates/template.repository";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function TrashPage() {
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

  const [notes, templates, folders, tags, preferences, workspace] = await Promise.all([
    listTrashedNotes(supabase, user.id),
    listSystemTemplates(supabase),
    listTrashedFolders(supabase, user.id, workspaceId),
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
      workspaceView="trash"
    />
  );
}
