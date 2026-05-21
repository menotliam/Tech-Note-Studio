import { Archive, FilePlus2, Folder, Pin, Search, Tags } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";
import { NoteEditorShell } from "@/modules/editor/components/NoteEditorShell";

const sampleNotes = [
  { title: "SQL Injection Notes", meta: "Updated today", pinned: true },
  { title: "Docker Commands", meta: "Command cheat sheet", pinned: true },
  { title: "React State Patterns", meta: "Programming study", pinned: false }
];

export function DashboardShell({ userEmail }: { userEmail: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[280px_1fr]">
        <aside className="border-r border-border bg-surface p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">TechNote Studio</h1>
              <p className="max-w-48 truncate text-sm text-muted-foreground">{userEmail}</p>
            </div>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
              aria-label="Create note"
            >
              <FilePlus2 size={18} />
            </button>
          </div>

          <form action={logoutAction} className="mb-4">
            <button className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Log out
            </button>
          </form>

          <label className="mb-4 flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <Search size={16} className="text-muted-foreground" />
            <input
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search notes"
            />
          </label>

          <nav className="space-y-1 text-sm">
            <SidebarItem icon={<Pin size={16} />} label="Pinned" active />
            <SidebarItem icon={<Folder size={16} />} label="Folders" />
            <SidebarItem icon={<Tags size={16} />} label="Tags" />
            <SidebarItem icon={<Archive size={16} />} label="Archived" />
          </nav>

          <div className="mt-8">
            <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent notes
            </h2>
            <div className="space-y-2">
              {sampleNotes.map((note) => (
                <button
                  key={note.title}
                  className="w-full rounded-md border border-border bg-background p-3 text-left transition hover:border-primary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{note.title}</span>
                    {note.pinned ? <Pin size={14} className="text-primary" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{note.meta}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <NoteEditorShell />
        </section>
      </div>
    </main>
  );
}

function SidebarItem({
  icon,
  label,
  active = false
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition " +
        (active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}
