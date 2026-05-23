import { describe, expect, it } from "vitest";
import { parseEditorDocumentJson } from "./editor.validation";

describe("editor validation", () => {
  it("accepts supported editor JSON", () => {
    const document = parseEditorDocumentJson(
      JSON.stringify({
        type: "doc",
        schemaVersion: 1,
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Editor MVP" }]
          },
          {
            type: "codeBlock",
            attrs: { language: "sql" },
            content: [{ type: "text", text: "SELECT * FROM notes;" }]
          }
        ]
      })
    );

    expect(document.type).toBe("doc");
    expect(document.schemaVersion).toBe(1);
  });

  it("rejects unsupported raw html nodes", () => {
    expect(() =>
      parseEditorDocumentJson(
        JSON.stringify({
          type: "doc",
          content: [{ type: "html", content: [{ type: "text", text: "<script />" }] }]
        })
      )
    ).toThrow("Invalid editor document.");
  });
});
