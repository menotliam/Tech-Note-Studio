import { describe, expect, it } from "vitest";
import { extractPlainTextFromEditorJson } from "./editor-text-extractor";
import { createEditorDocumentFromPlainText, emptyEditorDocument } from "./editor-documents";

describe("editor documents", () => {
  it("creates paragraph nodes from plain text", () => {
    const document = createEditorDocumentFromPlainText("First paragraph.\n\nSecond paragraph.");

    expect(document.type).toBe("doc");
    expect(document.schemaVersion).toBe(1);
    expect(document.content).toHaveLength(2);
    expect(extractPlainTextFromEditorJson(document)).toContain("Second paragraph.");
  });

  it("keeps empty notes as a valid document", () => {
    expect(emptyEditorDocument.type).toBe("doc");
    expect(emptyEditorDocument.content).toHaveLength(1);
  });
});
