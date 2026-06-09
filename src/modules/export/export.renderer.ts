import type { EditorDocument, EditorNode, EditorTextNode } from "@/modules/editor/editor.types";
import type { ExportBlock, ExportBundle, ExportDocument, ExportListItem, ExportTextContent, ExportTextRun } from "./export.types";

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
          ...getNodeTextContent(node)
        }
      ];
    case "paragraph": {
      return paragraphToExportBlocks(node);
    }
    case "blockquote":
      return [{ type: "quote", ...getNodeTextContent(node) }];
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
          items: getListItems(node)
        }
      ];
    case "taskList":
      return [
        {
          type: "checklist",
          items: getNodeChildren(node).map((child) => ({
            checked: Boolean("attrs" in child && child.attrs?.checked),
            ...getNodeTextContent(child)
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
  let textBuffer: ExportTextRun[] = [];

  children.forEach((child) => {
    if (child.type !== "image") {
      textBuffer.push(...getNodeTextRuns(child));
      return;
    }

    const textContent = normalizeTextRuns(textBuffer, getTextAlignment(node.attrs?.textAlign));

    if (textContent.text) {
      blocks.push({ type: "paragraph", ...textContent });
      textBuffer = [];
    }

    blocks.push(createImageExportBlock(child, getTextAlignment(node.attrs?.textAlign)));
  });

  const textContent = normalizeTextRuns(textBuffer, getTextAlignment(node.attrs?.textAlign));

  if (textContent.text) {
    blocks.push({ type: "paragraph", ...textContent });
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
  return getNodeTextContent(node).text;
}

function getNodeTextContent(node: EditorNode | EditorTextNode): ExportTextContent {
  return normalizeTextRuns(getNodeTextRuns(node), "attrs" in node ? getTextAlignment(node.attrs?.textAlign) : undefined);
}

function getListItems(node: EditorNode, depth = 0, orderedPath: number[] = []): ExportListItem[] {
  const ordered = node.type === "orderedList";

  return getNodeChildren(node)
    .filter((child) => child.type === "listItem")
    .flatMap((listItem, index) => {
      const nextOrderedPath = ordered ? [...orderedPath, index + 1] : [];
      const itemTextContent = getListItemTextContent(listItem);
      const nestedItems = getNodeChildren(listItem)
        .filter((child) => child.type === "bulletList" || child.type === "orderedList")
        .flatMap((child) => getListItems(child, depth + 1, nextOrderedPath));
      const currentItem = itemTextContent.text
        ? [
            {
              ...itemTextContent,
              depth,
              ordered,
              marker: ordered ? `${nextOrderedPath.join(".")}.` : undefined
            }
          ]
        : [];

      return [...currentItem, ...nestedItems];
    });
}

function getListItemTextContent(node: EditorNode): ExportTextContent {
  const textRuns = getNodeChildren(node)
    .filter((child) => child.type !== "bulletList" && child.type !== "orderedList")
    .flatMap((child) => getNodeTextRuns(child));

  return normalizeTextRuns(textRuns, getTextAlignment(node.attrs?.textAlign));
}

function getNodeTextRuns(node: EditorNode | EditorTextNode): ExportTextRun[] {
  if ("text" in node && typeof node.text === "string") {
    const text = node.text.replaceAll("\u200B", "");

    if (!text) {
      return [];
    }

    return [
      {
        text,
        ...getTextMarkStyles(node.marks)
      }
    ];
  }

  return getNodeChildren(node).flatMap((child) => getNodeTextRuns(child));
}

function normalizeTextRuns(runs: ExportTextRun[], alignment?: ExportTextContent["alignment"]): ExportTextContent {
  const normalizedRuns = mergeAdjacentTextRuns(
    runs
      .map((run) => ({ ...run, text: run.text.replaceAll("\u200B", "") }))
      .filter((run) => run.text)
  );
  const text = normalizedRuns.map((run) => run.text).join("").trim();
  const leadingTrim = normalizedRuns.length > 0 ? normalizedRuns[0]!.text.length - normalizedRuns[0]!.text.trimStart().length : 0;
  const trailingTrim =
    normalizedRuns.length > 0
      ? normalizedRuns[normalizedRuns.length - 1]!.text.length - normalizedRuns[normalizedRuns.length - 1]!.text.trimEnd().length
      : 0;
  const trimmedRuns = normalizedRuns
    .map((run, index) => {
      let nextText = run.text;

      if (index === 0 && leadingTrim > 0) {
        nextText = nextText.slice(leadingTrim);
      }

      if (index === normalizedRuns.length - 1 && trailingTrim > 0) {
        nextText = nextText.slice(0, Math.max(0, nextText.length - trailingTrim));
      }

      return { ...run, text: nextText };
    })
    .filter((run) => run.text);

  return {
    text,
    ...(trimmedRuns.some((run) => run.bold || run.italic || run.code) ? { runs: trimmedRuns } : {}),
    ...(alignment ? { alignment } : {})
  };
}

function mergeAdjacentTextRuns(runs: ExportTextRun[]) {
  const merged: ExportTextRun[] = [];

  runs.forEach((run) => {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      Boolean(previous.bold) === Boolean(run.bold) &&
      Boolean(previous.italic) === Boolean(run.italic) &&
      Boolean(previous.code) === Boolean(run.code)
    ) {
      previous.text += run.text;
      return;
    }

    merged.push({ ...run });
  });

  return merged;
}

function getTextMarkStyles(marks: EditorTextNode["marks"]): Omit<ExportTextRun, "text"> {
  const markTypes = new Set((marks ?? []).map((mark) => mark.type));

  return {
    ...(markTypes.has("bold") ? { bold: true } : {}),
    ...(markTypes.has("italic") ? { italic: true } : {}),
    ...(markTypes.has("code") ? { code: true } : {})
  };
}

function getTableRows(node: EditorNode): ExportTextContent[][] {
  return getNodeChildren(node)
    .filter((row) => row.type === "tableRow")
    .map((row) =>
      getNodeChildren(row)
        .filter((cell) => cell.type === "tableHeader" || cell.type === "tableCell")
        .map((cell) => getNodeTextContent(cell))
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
