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
      return paragraphToExportBlocks(node);
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

      return [createImageExportBlock(node)];
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

function paragraphToExportBlocks(node: EditorNode): ExportBlock[] {
  const children = getNodeChildren(node);

  if (children.length === 0) {
    return [];
  }

  const blocks: ExportBlock[] = [];
  let textBuffer = "";

  children.forEach((child) => {
    if (child.type !== "image") {
      textBuffer += getNodeText(child);
      return;
    }

    if (textBuffer.trim()) {
      blocks.push({ type: "paragraph", text: textBuffer.trim() });
      textBuffer = "";
    }

    blocks.push(createImageExportBlock(child, getTextAlignment(node.attrs?.textAlign)));
  });

  if (textBuffer.trim()) {
    blocks.push({ type: "paragraph", text: textBuffer.trim() });
  }

  return blocks;
}

function createImageExportBlock(
  node: EditorNode,
  parentAlignment?: Extract<ExportBlock, { type: "image" }>["alignment"]
): Extract<ExportBlock, { type: "image" }> {
  const block: Extract<ExportBlock, { type: "image" }> = {
    type: "image",
    src: String(node.attrs?.src),
    alt: typeof node.attrs?.alt === "string" ? node.attrs.alt : "Image"
  };
  const alignment = getTextAlignment(node.attrs?.textAlign) ?? parentAlignment;

  if (alignment) {
    block.alignment = alignment;
  }

  if (typeof node.attrs?.caption === "string" && node.attrs.caption) {
    block.caption = node.attrs.caption;
  }

  if (typeof node.attrs?.width === "number") {
    block.width = node.attrs.width;
  }

  if (typeof node.attrs?.fileId === "string" && node.attrs.fileId) {
    block.fileId = node.attrs.fileId;
  }

  return block;
}

function getNodeText(node: EditorNode | EditorTextNode): string {
  if ("text" in node && typeof node.text === "string") {
    return node.text.replaceAll("\u200B", "");
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

function getTextAlignment(value: unknown): Extract<ExportBlock, { type: "image" }>["alignment"] | undefined {
  return value === "left" || value === "center" || value === "right" ? value : undefined;
}
