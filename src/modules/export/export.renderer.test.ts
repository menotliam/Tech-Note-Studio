import { describe, expect, it } from "vitest";
import { editorDocumentToExportDocument, exportDocumentsToBundle } from "./export.renderer";
import type { EditorDocument } from "@/modules/editor/editor.types";

describe("editorDocumentToExportDocument", () => {
  it("normalizes editor JSON into export blocks", () => {
    const document: EditorDocument = {
      type: "doc",
      schemaVersion: 1,
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Setup" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Install dependencies." }]
        },
        {
          type: "codeBlock",
          attrs: { language: "bash" },
          content: [{ type: "text", text: "npm install\nnpm run dev" }]
        }
      ]
    };

    const result = editorDocumentToExportDocument("Project Docs", document);

    expect(result.title).toBe("Project Docs");
    expect(result.blocks).toEqual([
      { type: "heading", level: 2, text: "Setup" },
      { type: "paragraph", text: "Install dependencies." },
      { type: "code", language: "bash", code: "npm install\nnpm run dev" }
    ]);
  });

  it("creates a multi-note export bundle", () => {
    const first = { title: "One", blocks: [] };
    const second = { title: "Two", blocks: [] };

    expect(exportDocumentsToBundle([first, second])).toEqual({
      title: "Export",
      documents: [first, second]
    });
  });

  it("keeps inline images from editor paragraphs", () => {
    const document: EditorDocument = {
      type: "doc",
      schemaVersion: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before" },
            {
              type: "image",
              attrs: {
                src: "https://example.com/image.png",
                alt: "Diagram"
              }
            },
            { type: "text", text: "After" }
          ]
        }
      ]
    };

    const result = editorDocumentToExportDocument("Inline images", document);

    expect(result.blocks).toEqual([
      { type: "paragraph", text: "Before" },
      { type: "image", src: "https://example.com/image.png", alt: "Diagram" },
      { type: "paragraph", text: "After" }
    ]);
  });

  it("preserves image export metadata used by PDF and DOCX embedding", () => {
    const document: EditorDocument = {
      type: "doc",
      schemaVersion: 1,
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [
            {
              type: "image",
              attrs: {
                src: "https://example.com/storage/v1/object/public/note-files/user/workspace/note/image.png",
                alt: "Architecture diagram",
                caption: "Deployment architecture",
                width: 360,
                fileId: "550e8400-e29b-41d4-a716-446655440000"
              }
            }
          ]
        }
      ]
    };

    const result = editorDocumentToExportDocument("Image metadata", document);

    expect(result.blocks).toEqual([
      {
        type: "image",
        src: "https://example.com/storage/v1/object/public/note-files/user/workspace/note/image.png",
        alt: "Architecture diagram",
        caption: "Deployment architecture",
        width: 360,
        alignment: "right",
        fileId: "550e8400-e29b-41d4-a716-446655440000"
      }
    ]);
  });
});
