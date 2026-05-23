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
});
