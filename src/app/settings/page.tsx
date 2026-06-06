import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsShell } from "@/modules/preferences/components/SettingsShell";
import { loadUserPreferences } from "@/modules/preferences/preferences.service";
import { listSecurityActivityEvents } from "@/modules/security-activity/security-activity.repository";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.repository";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function SettingsPage() {
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

  const [preferences, workspace, securityActivity] = await Promise.all([
    loadUserPreferences(supabase, user.id),
    getWorkspaceSummary(supabase, user.id, workspaceId),
    listSecurityActivityEvents(supabase, user.id)
  ]);

  return (
    <SettingsShell
      initialPreferences={preferences}
      securityActivity={securityActivity}
      workspace={workspace}
      userEmail={user.email ?? "Signed in"}
    />
  );
}
