import { describe, expect, it } from "vitest";
import { extractPlainTextFromEditorJson } from "./editor-text-extractor";
import type { EditorDocument } from "./editor.types";

describe("extractPlainTextFromEditorJson", () => {
  it("extracts prose and code content for search", () => {
    const document: EditorDocument = {
      type: "doc",
      schemaVersion: 1,
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "SQL Notes" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Parameterized queries prevent injection." }]
        },
        {
          type: "codeBlock",
          attrs: { language: "sql" },
          content: [{ type: "text", text: "SELECT * FROM users WHERE id = $1;" }]
        }
      ]
    };

    expect(extractPlainTextFromEditorJson(document)).toContain("SQL Notes");
    expect(extractPlainTextFromEditorJson(document)).toContain("SELECT * FROM users");
  });
});
