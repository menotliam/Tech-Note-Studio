import type { EditorDocument, EditorNode, EditorTextNode } from "./editor.types";

const allowedNodeTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "horizontalRule",
  "image",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "codeBlock",
  "hardBreak"
]);

export function parseEditorDocumentJson(value: string): EditorDocument {
  const parsed = JSON.parse(value) as unknown;

  if (!isEditorDocument(parsed)) {
    throw new Error("Invalid editor document.");
  }

  return {
    ...parsed,
    schemaVersion: parsed.schemaVersion ?? 1
  };
}

export function isEditorDocument(value: unknown): value is EditorDocument {
  if (!isRecord(value) || value.type !== "doc") {
    return false;
  }

  if ("schemaVersion" in value && typeof value.schemaVersion !== "number") {
    return false;
  }

  if ("content" in value && !isNodeArray(value.content)) {
    return false;
  }

  return true;
}

function isNodeArray(value: unknown): value is Array<EditorNode | EditorTextNode> {
  return Array.isArray(value) && value.every(isEditorNode);
}

function isEditorNode(value: unknown): value is EditorNode | EditorTextNode {
  if (!isRecord(value) || typeof value.type !== "string" || !allowedNodeTypes.has(value.type)) {
    return false;
  }

  if ("text" in value && typeof value.text !== "string") {
    return false;
  }

  if ("content" in value && !isNodeArray(value.content)) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
