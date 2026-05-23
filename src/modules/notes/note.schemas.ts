import { z } from "zod";

export const noteTitleSchema = z
  .string()
  .trim()
  .min(1, "Note title is required.")
  .max(200, "Note title must be 200 characters or fewer.");

export const noteBodySchema = z.string().max(200000, "Note content is too large for MVP editing.");

export const updateNoteSchema = z.object({
  noteId: z.string().uuid(),
  title: noteTitleSchema,
  body: noteBodySchema.optional(),
  contentJson: z.string().optional(),
  contentText: noteBodySchema.optional()
});

export const noteIdSchema = z.string().uuid();

export const noteSearchSchema = z.string().trim().max(120).optional();
