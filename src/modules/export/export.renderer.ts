import type { EditorDocument, EditorNode, EditorTextNode } from "@/modules/editor/editor.types";
import type { ExportBlock, ExportBundle, ExportDocument } from "./export.types";

export function editorDocumentToExportDocument(title: string, document: EditorDocument): ExportDocument {
  return {
    title,
    blocks: getNodeChildren(document).flatMap((node) => nodeToExportBlocks(node))
  };
}

export function exportDocumentsToBundle(documents: ExportDocument[]): ExportBundle {
  return {
    title: documents.length === 1 ? documents[0]?.title ?? "Export" : "Export",
    documents
  };
}

function nodeToExportBlocks(node: EditorNode | EditorTextNode): ExportBlock[] {
  if (!("type" in node)) {
    return [];
  }

  switch (node.type) {
    case "heading":
      return [
        {
          type: "heading",
          level: normalizeHeadingLevel(node.attrs?.level),
          text: getNodeText(node)
        }
      ];
    case "paragraph": {
      const text = getNodeText(node);
      return text ? [{ type: "paragraph", text }] : [];
    }
    case "blockquote":
      return [{ type: "quote", text: getNodeText(node) }];
    case "horizontalRule":
      return [{ type: "divider" }];
    case "codeBlock":
      return [
        {
          type: "code",
          language: typeof node.attrs?.language === "string" ? node.attrs.language : "plaintext",
          code: getNodeText(node)
        }
      ];
    case "image":
      if (typeof node.attrs?.src !== "string" || !node.attrs.src) {
        return [];
      }

      return [
        {
          type: "image",
          src: node.attrs.src,
          alt: typeof node.attrs?.alt === "string" ? node.attrs.alt : "Image"
        }
      ];
    case "bulletList":
    case "orderedList":
      return [
        {
          type: "list",
          ordered: node.type === "orderedList",
          items: getNodeChildren(node).map((child) => getNodeText(child)).filter(Boolean)
        }
      ];
    case "taskList":
      return [
        {
          type: "checklist",
          items: getNodeChildren(node).map((child) => ({
            checked: Boolean("attrs" in child && child.attrs?.checked),
            text: getNodeText(child)
          }))
        }
      ];
    case "table":
      return [{ type: "table", rows: getTableRows(node) }];
    default:
      return [];
  }
}

function getNodeText(node: EditorNode | EditorTextNode): string {
  if ("text" in node && typeof node.text === "string") {
    return node.text;
  }

  return getNodeChildren(node).map((child) => getNodeText(child)).join("").trim();
}

function getTableRows(node: EditorNode): string[][] {
  return getNodeChildren(node)
    .filter((row) => row.type === "tableRow")
    .map((row) =>
      getNodeChildren(row)
        .filter((cell) => cell.type === "tableHeader" || cell.type === "tableCell")
        .map((cell) => getNodeText(cell))
    );
}

function getNodeChildren(node: EditorDocument | EditorNode | EditorTextNode): Array<EditorNode | EditorTextNode> {
  return "content" in node && Array.isArray(node.content) ? node.content : [];
}

function normalizeHeadingLevel(level: unknown): 1 | 2 | 3 {
  return level === 1 || level === 2 || level === 3 ? level : 2;
}
