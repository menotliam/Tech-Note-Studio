import { describe, expect, it } from "vitest";
import { noteIdSchema, renameNoteSchema, updateNoteSchema } from "./note.schemas";

describe("note schemas", () => {
  it("accepts a valid note update", () => {
    const result = updateNoteSchema.safeParse({
      noteId: "550e8400-e29b-41d4-a716-446655440000",
      title: "SQL Notes",
      body: "SELECT * FROM users;"
    });

    expect(result.success).toBe(true);
  });

  it("does not preserve plaintext contentText input", () => {
    const result = updateNoteSchema.parse({
      noteId: "550e8400-e29b-41d4-a716-446655440000",
      title: "SQL Notes",
      contentJson: JSON.stringify({ type: "doc", content: [] }),
      contentText: "SELECT * FROM private_notes;"
    });

    expect("contentText" in result).toBe(false);
  });

  it("rejects an empty note title", () => {
    const result = updateNoteSchema.safeParse({
      noteId: "550e8400-e29b-41d4-a716-446655440000",
      title: "",
      body: "Body"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid note ids", () => {
    expect(noteIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("validates note rename input", () => {
    expect(
      renameNoteSchema.safeParse({
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        title: "Renamed note"
      }).success
    ).toBe(true);

    expect(
      renameNoteSchema.safeParse({
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        title: ""
      }).success
    ).toBe(false);
  });
});
