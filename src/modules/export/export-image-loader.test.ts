import { describe, expect, it } from "vitest";
import { attachExportImageAssets, ExportImageLoadError } from "./export-image-loader";
import type { ExportDocument } from "./export.types";

const note = {
  id: "note-1",
  workspace_id: "workspace-1",
  title: "Image note"
};

describe("export image loader", () => {
  it("attaches verified owner image assets", async () => {
    const document = createImageDocument("https://example.supabase.co/storage/v1/object/public/note-files/user-1/workspace-1/note-1/image.png");

    await attachExportImageAssets({
      ownerId: "user-1",
      notes: [note],
      documents: [document],
      metadataClient: createMetadataClient([
        {
          id: "file-1",
          owner_id: "user-1",
          workspace_id: "workspace-1",
          note_id: "note-1",
          storage_bucket: "note-files",
          storage_path: "user-1/workspace-1/note-1/image.png",
          original_filename: "image.png",
          mime_type: "image/png",
          size_bytes: 8
        }
      ]),
      storageClient: createStorageClient(new Blob(["image-bytes"], { type: "image/png" })) as never
    });

    const block = document.blocks[0];

    expect(block.type).toBe("image");
    if (block.type === "image") {
      expect(block.asset?.mimeType).toBe("image/png");
      expect(block.asset?.storagePath).toBe("user-1/workspace-1/note-1/image.png");
      expect(block.asset?.data.length).toBeGreaterThan(0);
    }
  });

  it("rejects images that are not verified for the exported note", async () => {
    const document = createImageDocument("https://example.supabase.co/storage/v1/object/public/note-files/user-2/workspace-2/note-2/image.png");

    await expect(
      attachExportImageAssets({
        ownerId: "user-1",
        notes: [note],
        documents: [document],
        metadataClient: createMetadataClient([]),
        storageClient: createStorageClient(new Blob(["image-bytes"], { type: "image/png" })) as never
      })
    ).rejects.toBeInstanceOf(ExportImageLoadError);
  });

  it("loads by file id and reuses duplicate storage downloads", async () => {
    const documents: ExportDocument[] = [
      {
        title: "Repeated images",
        blocks: [
          { type: "image", src: "https://example.test/opaque-url", alt: "First", fileId: "file-1" },
          { type: "image", src: "https://example.test/opaque-url", alt: "Second", fileId: "file-1" }
        ]
      }
    ];
    const storageClient = createStorageClient(new Blob(["image-bytes"], { type: "image/png" }));

    await attachExportImageAssets({
      ownerId: "user-1",
      notes: [note],
      documents,
      metadataClient: createMetadataClient([
        {
          id: "file-1",
          owner_id: "user-1",
          workspace_id: "workspace-1",
          note_id: "note-1",
          storage_bucket: "note-files",
          storage_path: "user-1/workspace-1/note-1/image.png",
          original_filename: "image.png",
          mime_type: "image/png",
          size_bytes: 8
        }
      ]),
      storageClient: storageClient as never
    });

    const [first, second] = documents[0].blocks;

    expect(first.type).toBe("image");
    expect(second.type).toBe("image");
    if (first.type === "image" && second.type === "image") {
      expect(first.asset).toBe(second.asset);
    }
    expect(storageClient.downloads).toEqual(["note-files:user-1/workspace-1/note-1/image.png"]);
  });

  it("rejects metadata that belongs to another workspace without exposing storage paths", async () => {
    const document = createImageDocument("https://example.supabase.co/storage/v1/object/public/note-files/user-1/workspace-1/note-1/image.png");

    await expect(
      attachExportImageAssets({
        ownerId: "user-1",
        notes: [note],
        documents: [document],
        metadataClient: createMetadataClient([
          {
            id: "file-1",
            owner_id: "user-1",
            workspace_id: "workspace-2",
            note_id: "note-1",
            storage_bucket: "note-files",
            storage_path: "user-1/workspace-1/note-1/image.png",
            original_filename: "image.png",
            mime_type: "image/png",
            size_bytes: 8
          }
        ]),
        storageClient: createStorageClient(new Blob(["image-bytes"], { type: "image/png" })) as never
      })
    ).rejects.toThrow('Could not verify image in "Image note".');
  });
});

function createImageDocument(src: string): ExportDocument {
  return {
    title: "Image note",
    blocks: [{ type: "image", src, alt: "Diagram" }]
  };
}

function createMetadataClient(data: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data, error: null })
        })
      })
    })
  } as never;
}

type MockStorageClient = {
  downloads: string[];
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob; error: null }>;
    };
  };
};

function createStorageClient(blob: Blob): MockStorageClient {
  const downloads: string[] = [];

  return {
    downloads,
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          downloads.push(`${bucket}:${path}`);
          return { data: blob, error: null };
        }
      })
    }
  };
}
