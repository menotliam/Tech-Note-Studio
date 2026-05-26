import { describe, expect, it } from "vitest";
import type { EditorNode } from "./editor.types";
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

  it("sanitizes unsafe link and script text while preserving code text", () => {
    const document = parseEditorDocumentJson(
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "<script>alert(1)</script>Click",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }]
              }
            ]
          },
          {
            type: "codeBlock",
            attrs: { language: "javascript" },
            content: [{ type: "text", text: "<script>alert(1)</script>" }]
          }
        ]
      })
    );

    const paragraph = document.content?.[0] as EditorNode;
    const codeBlock = document.content?.[1] as EditorNode;

    expect(paragraph.content?.[0]?.text).toBe("alert(1)Click");
    expect(paragraph.content?.[0]?.marks).toBeUndefined();
    expect(codeBlock.content?.[0]?.text).toBe("<script>alert(1)</script>");
  });

  it("sanitizes unsafe image attrs used by export", () => {
    const document = parseEditorDocumentJson(
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              src: "javascript:alert(1)",
              caption: "Unsafe image"
            }
          },
          {
            type: "image",
            attrs: {
              src: "https://example.com/image.png",
              width: 9999,
              textAlign: "center",
              fileId: "not-a-uuid"
            }
          }
        ]
      })
    );

    expect(document.content).toHaveLength(1);
    const image = document.content?.[0] as EditorNode;

    expect(image.attrs?.src).toBe("https://example.com/image.png");
    expect(image.attrs?.width).toBe(1200);
    expect(image.attrs?.textAlign).toBe("center");
    expect(image.attrs?.fileId).toBeUndefined();
  });
});
