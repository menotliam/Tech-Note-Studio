import { describe, expect, it } from "vitest";
import { hardDeleteTrashedNotesByIds } from "./note-lifecycle.service";

describe("note lifecycle service", () => {
  it("hard deletes trashed notes and removes related storage files grouped by bucket", async () => {
    const supabase = createSupabaseMock([
      { storage_bucket: "note-files", storage_path: "user/workspace/note/a.png" },
      { storage_bucket: "note-files", storage_path: "user/workspace/note/b.png" },
      { storage_bucket: "avatars", storage_path: "user/avatar.png" }
    ]);

    const result = await hardDeleteTrashedNotesByIds(supabase as never, ["note-1", "note-2"], "user-1");

    expect(result).toEqual({ deletedNotes: 2, deletedFiles: 3 });
    expect(supabase.storageRemovals).toEqual([
      { bucket: "note-files", paths: ["user/workspace/note/a.png", "user/workspace/note/b.png"] },
      { bucket: "avatars", paths: ["user/avatar.png"] }
    ]);
    expect(supabase.tableCalls).toContain("note_files");
    expect(supabase.tableCalls).toContain("notes");
    expect(supabase.filters).toEqual(
      expect.arrayContaining([
        { table: "note_files", op: "in", column: "note_id", value: ["note-1", "note-2"] },
        { table: "note_files", op: "eq", column: "owner_id", value: "user-1" },
        { table: "notes", op: "in", column: "id", value: ["note-1", "note-2"] },
        { table: "notes", op: "not", column: "deleted_at", operator: "is", value: null },
        { table: "notes", op: "eq", column: "owner_id", value: "user-1" }
      ])
    );
  });

  it("does nothing when there are no note ids", async () => {
    const supabase = createSupabaseMock([]);

    await expect(hardDeleteTrashedNotesByIds(supabase as never, [], "user-1")).resolves.toEqual({
      deletedNotes: 0,
      deletedFiles: 0
    });
    expect(supabase.tableCalls).toEqual([]);
    expect(supabase.storageRemovals).toEqual([]);
  });
});

function createSupabaseMock(files: Array<{ storage_bucket: string; storage_path: string }>) {
  const state = {
    tableCalls: [] as string[],
    filters: [] as Array<Record<string, unknown>>,
    storageRemovals: [] as Array<{ bucket: string; paths: string[] }>
  };

  return {
    ...state,
    from(table: string) {
      state.tableCalls.push(table);
      return createQuery(table, files, state);
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            state.storageRemovals.push({ bucket, paths });
            return { error: null };
          }
        };
      }
    }
  };
}

function createQuery(
  table: string,
  files: Array<{ storage_bucket: string; storage_path: string }>,
  state: {
    filters: Array<Record<string, unknown>>;
  }
) {
  const query = {
    data: table === "note_files" ? files : null,
    error: null,
    select() {
      return query;
    },
    delete() {
      return query;
    },
    in(column: string, value: unknown) {
      state.filters.push({ table, op: "in", column, value });
      return query;
    },
    eq(column: string, value: unknown) {
      state.filters.push({ table, op: "eq", column, value });
      return query;
    },
    not(column: string, operator: string, value: unknown) {
      state.filters.push({ table, op: "not", column, operator, value });
      return query;
    }
  };

  return query;
}
