import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/modules/dashboard/components/DashboardShell";
import { getNoteById, listNotes } from "@/modules/notes/note.repository";
import { noteIdSchema, noteSearchSchema } from "@/modules/notes/note.schemas";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export default async function NotePage({
  params,
  searchParams
}: {
  params: Promise<{ noteId: string }>;
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

  const resolvedParams = await params;
  const noteId = noteIdSchema.safeParse(resolvedParams.noteId);

  if (!noteId.success) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const searchQuery = noteSearchSchema.parse(resolvedSearchParams?.q);
  const [notes, selectedNote] = await Promise.all([
    listNotes(supabase, user.id, searchQuery),
    getNoteById(supabase, user.id, noteId.data)
  ]);

  if (!selectedNote || selectedNote.isArchived) {
    notFound();
  }

  return (
    <DashboardShell
      userEmail={user.email ?? "Signed in"}
      notes={notes}
      selectedNote={selectedNote}
      searchQuery={searchQuery ?? ""}
    />
  );
}
