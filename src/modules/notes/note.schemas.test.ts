import { describe, expect, it } from "vitest";
import { noteIdSchema, updateNoteSchema } from "./note.schemas";

describe("note schemas", () => {
  it("accepts a valid note update", () => {
    const result = updateNoteSchema.safeParse({
      noteId: "550e8400-e29b-41d4-a716-446655440000",
      title: "SQL Notes",
      body: "SELECT * FROM users;"
    });

    expect(result.success).toBe(true);
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
});
