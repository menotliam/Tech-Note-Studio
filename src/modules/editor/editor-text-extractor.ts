import type { EditorDocument, EditorNode, EditorTextNode } from "./editor.types";

const BLOCK_TYPES_WITH_LINE_BREAKS = new Set([
  "heading",
  "paragraph",
  "blockquote",
  "codeBlock",
  "listItem",
  "taskItem"
]);

export function extractPlainTextFromEditorJson(document: EditorDocument): string {
  if (!document.content?.length) {
    return "";
  }

  return document.content
    .map((node) => extractNodeText(node))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractNodeText(node: EditorNode | EditorTextNode): string {
  if ("text" in node && typeof node.text === "string") {
    return node.text.replaceAll("\u200B", "");
  }

  if (!("content" in node) || !node.content?.length) {
    return "";
  }

  const separator = BLOCK_TYPES_WITH_LINE_BREAKS.has(node.type) ? "\n" : "";
  return node.content.map((child) => extractNodeText(child)).join(separator).trim();
}
