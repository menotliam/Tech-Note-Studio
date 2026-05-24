import { z } from "zod";

export const folderNameSchema = z.string().trim().min(1).max(120);
export const tagNameSchema = z.string().trim().min(1).max(60);
export const colorSchema = z.string().trim().max(30).optional();
export const organizationIdSchema = z.string().uuid();

export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: organizationIdSchema.optional()
});

export const createTagSchema = z.object({
  name: tagNameSchema,
  color: colorSchema
});

export const assignFolderSchema = z.object({
  noteId: organizationIdSchema,
  folderId: organizationIdSchema.optional()
});

export const assignTagSchema = z.object({
  noteId: organizationIdSchema,
  tagId: organizationIdSchema
});

export const folderIdSchema = organizationIdSchema;

export const renameFolderSchema = z.object({
  folderId: organizationIdSchema,
  name: folderNameSchema
});

export const assignParentFolderSchema = z.object({
  folderId: organizationIdSchema,
  parentId: organizationIdSchema.optional()
});
