import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await ensureUserFoundation(supabase, user);

  return <DashboardShell userEmail={user.email ?? "Signed in"} />;
}
