import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportBlock, ExportDocument, ExportImageAsset } from "./export.types";

type ExportImageNote = {
  id: string;
  workspace_id: string;
  title?: string;
};

type NoteFileRow = {
  id: string;
  owner_id: string;
  workspace_id: string;
  note_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
  size_bytes: number;
};

type ExportImageReference = {
  noteId: string;
  block: Extract<ExportBlock, { type: "image" }>;
  fileId: string | null;
  storagePath: string | null;
};

const allowedExportImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export class ExportImageLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportImageLoadError";
  }
}

export async function attachExportImageAssets({
  ownerId,
  notes,
  documents,
  metadataClient,
  storageClient
}: {
  ownerId: string;
  notes: ExportImageNote[];
  documents: ExportDocument[];
  metadataClient: SupabaseClient;
  storageClient: SupabaseClient;
}) {
  const references = collectExportImageReferences(notes, documents);

  if (references.length === 0) {
    return documents;
  }

  const noteIds = new Set(notes.map((note) => note.id));
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const { data, error } = await metadataClient
    .from("note_files")
    .select("id, owner_id, workspace_id, note_id, storage_bucket, storage_path, original_filename, mime_type, size_bytes")
    .eq("owner_id", ownerId)
    .in("note_id", [...noteIds]);

  if (error) {
    throw new ExportImageLoadError("Could not load image metadata for export.");
  }

  const fileByPath = new Map((data as NoteFileRow[] | null ?? []).map((file) => [file.storage_path, file]));
  const fileById = new Map((data as NoteFileRow[] | null ?? []).map((file) => [file.id, file]));
  const assetByPath = new Map<string, ExportImageAsset>();

  for (const reference of references) {
    const file = reference.fileId ? fileById.get(reference.fileId) : reference.storagePath ? fileByPath.get(reference.storagePath) : null;

    const note = noteById.get(reference.noteId);
    const noteTitle = note?.title ?? "selected note";

    if (
      !file ||
      !note ||
      file.owner_id !== ownerId ||
      file.note_id !== reference.noteId ||
      file.workspace_id !== note.workspace_id ||
      !isAllowedExportImageMimeType(file.mime_type)
    ) {
      throw new ExportImageLoadError(`Could not verify image in "${noteTitle}".`);
    }

    const cachedAsset = assetByPath.get(file.storage_path);

    if (cachedAsset) {
      reference.block.asset = cachedAsset;
      continue;
    }

    const { data: blob, error: downloadError } = await storageClient.storage
      .from(file.storage_bucket)
      .download(file.storage_path);

    if (downloadError || !blob) {
      throw new ExportImageLoadError(`Could not load image in "${noteTitle}".`);
    }

    const asset: ExportImageAsset = {
      data: Buffer.from(await blob.arrayBuffer()),
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      storageBucket: file.storage_bucket,
      storagePath: file.storage_path,
      originalFilename: file.original_filename
    };

    assetByPath.set(file.storage_path, asset);
    reference.block.asset = asset;
  }

  return documents;
}

function collectExportImageReferences(notes: ExportImageNote[], documents: ExportDocument[]) {
  const references: ExportImageReference[] = [];

  documents.forEach((document, index) => {
    const note = notes[index];

    if (!note) {
      return;
    }

    document.blocks.forEach((block) => {
      if (block.type !== "image") {
        return;
      }

      const imageReference = getImageReferenceFromBlock(block);

      if (!imageReference.fileId && !imageReference.storagePath) {
        throw new ExportImageLoadError("An exported note contains an image that could not be verified.");
      }

      references.push({
        noteId: note.id,
        block,
        ...imageReference
      });
    });
  });

  return references;
}

function getImageReferenceFromBlock(block: Extract<ExportBlock, { type: "image" }>) {
  return {
    fileId: block.fileId ?? getFileIdFromAppImageUrl(block.src),
    storagePath: getStoragePathFromPublicUrl(block.src)
  };
}

function getFileIdFromAppImageUrl(src: string) {
  try {
    const url = new URL(src, "https://tech-note-studio.local");

    if (!src.startsWith("/") || url.pathname !== "/api/files/note-image") {
      return null;
    }

    const fileId = url.searchParams.get("fileId");

    return fileId && isUuidLike(fileId) ? fileId : null;
  } catch {
    return null;
  }
}

function getStoragePathFromPublicUrl(src: string) {
  try {
    const url = new URL(src);
    const markerMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\//);

    if (!markerMatch || markerMatch.index === undefined) {
      return null;
    }

    const pathAfterMarker = url.pathname.slice(markerMatch.index + markerMatch[0].length);
    const [, ...storagePathParts] = pathAfterMarker.split("/");
    const storagePath = storagePathParts.join("/");

    return storagePath ? decodeURIComponent(storagePath) : null;
  } catch {
    return null;
  }
}

function isAllowedExportImageMimeType(value: string): value is ExportImageAsset["mimeType"] {
  return allowedExportImageMimeTypes.has(value);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
