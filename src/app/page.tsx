import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { listNotes } from "@/modules/notes/note.repository";
import { noteSearchSchema } from "@/modules/notes/note.schemas";
import { listFolders, listTags } from "@/modules/organization/organization.repository";
import { organizationIdSchema } from "@/modules/organization/organization.schemas";
import type { WorkspaceActivity } from "@/modules/workspace-shell/workspace-shell.types";
import { loadUserPreferences } from "@/modules/preferences/preferences.service";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.repository";
import { listSystemTemplates } from "@/modules/templates/template.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; folder?: string; tag?: string; explorerTag?: string; panel?: string }>;
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
  const explorerTagId = params?.explorerTag ? organizationIdSchema.parse(params.explorerTag) : undefined;
  const requestedPanel = parseWorkspaceActivity(params?.panel);
  const [notes, templates, folders, tags, preferences, workspace] = await Promise.all([
    listNotes(supabase, user.id, searchQuery ?? undefined),
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
