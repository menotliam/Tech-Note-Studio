import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { listNotes } from "@/modules/notes/note.repository";
import { noteSearchSchema } from "@/modules/notes/note.schemas";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await ensureUserFoundation(supabase, user);
  const params = await searchParams;
  const searchQuery = noteSearchSchema.parse(params?.q);
  const notes = await listNotes(supabase, user.id, searchQuery);

  return (
    <DashboardShell
      userEmail={user.email ?? "Signed in"}
      notes={notes}
      searchQuery={searchQuery ?? ""}
    />
  );
}
