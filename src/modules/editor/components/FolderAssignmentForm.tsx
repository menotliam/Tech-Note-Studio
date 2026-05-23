import { assignFolderToNoteAction } from "@/modules/organization/organization.actions";
import type { FolderSummary } from "@/modules/organization/organization.types";

export function FolderAssignmentForm({
  noteId,
  folderId,
  folders
}: {
  noteId: string;
  folderId: string | null;
  folders: FolderSummary[];
}) {
  return (
    <form key={`${noteId}:${folderId ?? "none"}`} action={assignFolderToNoteAction}>
      <input type="hidden" name="noteId" value={noteId} />
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Folder
        <select
          name="folderId"
          className="mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm normal-case tracking-normal text-foreground"
          defaultValue={folderId ?? ""}
        >
          <option value="">No folder</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      <button className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted">
        Apply
      </button>
    </form>
  );
}
