import { describe, expect, it } from "vitest";
import {
  assignFolderSchema,
  assignParentFolderSchema,
  assignTagSchema,
  createFolderSchema,
  createTagSchema,
  renameFolderSchema
} from "./organization.schemas";

describe("organization schemas", () => {
  it("accepts folder creation input", () => {
    expect(createFolderSchema.safeParse({ name: "Databases" }).success).toBe(true);
    expect(
      createFolderSchema.safeParse({
        name: "Postgres",
        parentId: "550e8400-e29b-41d4-a716-446655440000"
      }).success
    ).toBe(true);
  });

  it("rejects empty folder names", () => {
    expect(createFolderSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts tag creation input", () => {
    expect(createTagSchema.safeParse({ name: "SQL", color: "#0f766e" }).success).toBe(true);
  });

  it("accepts note-folder assignment with no folder for clearing", () => {
    expect(
      assignFolderSchema.safeParse({
        noteId: "550e8400-e29b-41d4-a716-446655440000"
      }).success
    ).toBe(true);
  });

  it("rejects invalid note-tag assignment ids", () => {
    expect(assignTagSchema.safeParse({ noteId: "bad", tagId: "also-bad" }).success).toBe(false);
  });

  it("validates folder rename and parent assignment", () => {
    expect(
      renameFolderSchema.safeParse({
        folderId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Renamed"
      }).success
    ).toBe(true);

    expect(
      assignParentFolderSchema.safeParse({
        folderId: "550e8400-e29b-41d4-a716-446655440000",
        parentId: "550e8400-e29b-41d4-a716-446655440001"
      }).success
    ).toBe(true);
  });
});
