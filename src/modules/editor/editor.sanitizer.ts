import type { EditorDocument, EditorMark, EditorNode, EditorTextNode } from "./editor.types";

const allowedNodeTypes = new Set([
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

const allowedTextMarkTypes = new Set(["bold", "italic", "code", "link"]);

export function sanitizeEditorDocument(document: EditorDocument): EditorDocument {
  return {
    type: "doc",
    schemaVersion: document.schemaVersion ?? 1,
    content: sanitizeChildren(document.content ?? [], false)
  };
}

function sanitizeChildren(children: Array<EditorNode | EditorTextNode>, preserveText: boolean) {
  return children
    .map((child) => sanitizeNode(child, preserveText))
    .filter((child): child is EditorNode | EditorTextNode => Boolean(child));
}

function sanitizeNode(node: EditorNode | EditorTextNode, preserveText: boolean): EditorNode | EditorTextNode | null {
  if (!allowedNodeTypes.has(node.type)) {
    return null;
  }

  if (node.type === "text") {
    return {
      type: "text",
      text: preserveText ? node.text ?? "" : sanitizeText(node.text ?? ""),
      marks: sanitizeMarks(node.marks)
    };
  }

  return {
    type: node.type,
    attrs: sanitizeAttrs(node.type, getNodeAttrs(node)),
    content: sanitizeChildren(getNodeChildren(node), node.type === "codeBlock")
  };
}

function getNodeAttrs(node: EditorNode | EditorTextNode) {
  return "attrs" in node ? node.attrs : undefined;
}

function getNodeChildren(node: EditorNode | EditorTextNode) {
  return "content" in node && Array.isArray(node.content) ? node.content : [];
}

function sanitizeText(value: string) {
  return value.replace(/<\s*\/?\s*script\b[^>]*>/gi, "");
}

function sanitizeMarks(marks: EditorMark[] | undefined) {
  const safeMarks = (marks ?? [])
    .filter((mark) => allowedTextMarkTypes.has(mark.type))
    .map((mark) => ({
      type: mark.type,
      attrs: mark.type === "link" ? sanitizeLinkAttrs(mark.attrs) : undefined
    }))
    .filter((mark) => mark.type !== "link" || Boolean(mark.attrs?.href));

  return safeMarks.length > 0 ? safeMarks : undefined;
}

function sanitizeAttrs(nodeType: string, attrs: Record<string, unknown> | undefined) {
  switch (nodeType) {
    case "heading":
      return { level: sanitizeHeadingLevel(attrs?.level) };
    case "taskItem":
      return { checked: Boolean(attrs?.checked) };
    case "image":
      return sanitizeImageAttrs(attrs);
    case "codeBlock":
      return sanitizeCodeBlockAttrs(attrs);
    default:
      return undefined;
  }
}

function sanitizeHeadingLevel(level: unknown) {
  return level === 1 || level === 2 || level === 3 ? level : 2;
}

function sanitizeImageAttrs(attrs: Record<string, unknown> | undefined) {
  const src = typeof attrs?.src === "string" && isSafeWebUrl(attrs.src) ? attrs.src : "";
  const alt = typeof attrs?.alt === "string" ? attrs.alt.slice(0, 300) : "";
  const title = typeof attrs?.title === "string" ? attrs.title.slice(0, 300) : "";

  return src ? { src, alt, title } : undefined;
}

function sanitizeLinkAttrs(attrs: Record<string, unknown> | undefined) {
  const href = typeof attrs?.href === "string" && isSafeUrl(attrs.href) ? attrs.href : "";

  return href ? { href, target: "_blank", rel: "noopener noreferrer nofollow" } : undefined;
}

function sanitizeCodeBlockAttrs(attrs: Record<string, unknown> | undefined) {
  const language =
    typeof attrs?.language === "string" && /^[a-z0-9+#.-]{1,40}$/i.test(attrs.language)
      ? attrs.language
      : "plaintext";
  const confidence = typeof attrs?.confidence === "number" ? Math.min(Math.max(attrs.confidence, 0), 1) : undefined;

  return {
    language,
    detectedType: typeof attrs?.detectedType === "string" ? attrs.detectedType.slice(0, 40) : "code",
    showLineNumbers: Boolean(attrs?.showLineNumbers),
    wordWrap: Boolean(attrs?.wordWrap),
    source: typeof attrs?.source === "string" ? attrs.source.slice(0, 40) : undefined,
    confidence
  };
}

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function isSafeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
