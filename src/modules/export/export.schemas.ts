import { z } from "zod";

export const exportFormatSchema = z.enum(["pdf", "docx"]);
export const exportModeSchema = z.enum(["bundle", "zip"]);

export const exportSingleNoteSchema = z.object({
  noteId: z.string().uuid(),
  format: exportFormatSchema
});

export const exportNotesSchema = z.object({
  noteIds: z.array(z.string().uuid()).min(1).max(50),
  format: exportFormatSchema,
  mode: exportModeSchema.default("bundle")
});
