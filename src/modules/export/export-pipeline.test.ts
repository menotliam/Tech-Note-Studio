import { describe, expect, it } from "vitest";
import { sanitizeEditorDocument } from "@/modules/editor/editor.sanitizer";
import type { EditorDocument } from "@/modules/editor/editor.types";
import { attachExportImageAssets } from "./export-image-loader";
import { editorDocumentToExportDocument } from "./export.renderer";
import { generateDocx } from "./generators/docx.generator";
import { generatePdf } from "./generators/pdf.generator";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

describe("export pipeline", () => {
  it("sanitizes editor content, loads verified images, and generates PDF/DOCX", async () => {
    const editorDocument: EditorDocument = {
      type: "doc",
      schemaVersion: 1,
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Release notes" }]
        },
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            { type: "text", text: "Architecture" },
            {
              type: "image",
              attrs: {
                src: "https://example.supabase.co/storage/v1/object/public/note-files/user-1/workspace-1/note-1/diagram.png",
                alt: "Architecture diagram",
                caption: "Architecture diagram",
                width: 320
              }
            }
          ]
        }
      ]
    };
    const exportDocument = editorDocumentToExportDocument("Release", sanitizeEditorDocument(editorDocument));

    await attachExportImageAssets({
      ownerId: "user-1",
      notes: [{ id: "note-1", workspace_id: "workspace-1", title: "Release" }],
      documents: [exportDocument],
      metadataClient: createMetadataClient([
        {
          id: "file-1",
          owner_id: "user-1",
          workspace_id: "workspace-1",
          note_id: "note-1",
          storage_bucket: "note-files",
          storage_path: "user-1/workspace-1/note-1/diagram.png",
          original_filename: "diagram.png",
          mime_type: "image/png",
          size_bytes: onePixelPng.length
        }
      ]),
      storageClient: createStorageClient(new Blob([onePixelPng], { type: "image/png" })) as never
    });

    const pdf = await generatePdf(exportDocument);
    const docx = await generateDocx(exportDocument);

    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    expect(docx.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});

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

function createStorageClient(blob: Blob) {
  return {
    storage: {
      from: () => ({
        download: async () => ({ data: blob, error: null })
      })
    }
  };
}
