import type { EditorDocument } from "./editor.types";

export const emptyEditorDocument: EditorDocument = {
  type: "doc",
  schemaVersion: 1,
  content: [
    {
      type: "paragraph",
      content: []
    }
  ]
};

export function createEditorDocumentFromPlainText(text: string): EditorDocument {
  const content = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text" as const, text: paragraph }]
    }));

  return {
    type: "doc",
    schemaVersion: 1,
    content: content.length > 0 ? content : emptyEditorDocument.content
  };
}
