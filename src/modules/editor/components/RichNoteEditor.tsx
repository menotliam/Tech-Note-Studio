"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  Bold,
  Braces,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table2
} from "lucide-react";
import { extractPlainTextFromEditorJson } from "@/modules/editor/editor-text-extractor";
import { getPasteDetectionAction } from "@/modules/editor/editor-paste-detection";
import { TechnicalCodeBlock } from "@/modules/editor/extensions/TechnicalCodeBlock";
import type { EditorDocument } from "@/modules/editor/editor.types";
import type { DetectionResult } from "@/modules/detection/detection.types";
import {
  createUpdateNoteOperation,
  enqueueSyncOperation,
  putCachedNote
} from "@/modules/offline-sync/indexeddb.client";

type RichNoteEditorProps = {
  noteId: string;
  workspaceId: string;
  title: string;
  updatedAt: string;
  initialContent: EditorDocument;
};

export function RichNoteEditor({ noteId, workspaceId, title, updatedAt, initialContent }: RichNoteEditorProps) {
  const tiptapContent = useMemo(() => toTiptapContent(initialContent), [initialContent]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contentJson, setContentJson] = useState(() => serializeContent(tiptapContent));
  const [contentText, setContentText] = useState(() => extractPlainTextFromEditorJson(initialContent));
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);
  const autoDetectionEnabledRef = useRef(autoDetectionEnabled);
  const cacheTimerRef = useRef<number | null>(null);
  const [pasteSuggestion, setPasteSuggestion] = useState<{
    text: string;
    from: number;
    to: number;
    top: number;
    left: number;
    result: DetectionResult;
  } | null>(null);

  useEffect(() => {
    autoDetectionEnabledRef.current = autoDetectionEnabled;
  }, [autoDetectionEnabled]);

  useEffect(() => {
    return () => {
      if (cacheTimerRef.current) {
        window.clearTimeout(cacheTimerRef.current);
      }
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        link: false,
        codeBlock: false
      }),
      TechnicalCodeBlock,
      Link.configure({
        openOnClick: false,
        protocols: ["http", "https", "mailto"]
      }),
      Placeholder.configure({
        placeholder: "Write technical notes, paste code, or type / for structure later..."
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        allowBase64: false
      })
    ],
    content: tiptapContent,
    editorProps: {
      attributes: {
        class:
          "min-h-96 rounded-md border border-border bg-surface px-5 py-4 leading-7 outline-none focus:border-primary"
      },
      handlePaste(view, event) {
        const pastedText = event.clipboardData?.getData("text/plain") ?? "";

        if (!pastedText.trim()) {
          return false;
        }

        const pasteAction = getPasteDetectionAction(pastedText, autoDetectionEnabledRef.current);

        if (pasteAction.action === "ignore") {
          setPasteSuggestion(null);
          return false;
        }

        event.preventDefault();

        if (pasteAction.action === "auto_format") {
          insertDetectedCodeBlock(view, pastedText, pasteAction.result, "auto_detected");
          setPasteSuggestion(null);
          return true;
        }

        const from = view.state.selection.from;
        const transaction = view.state.tr.insertText(pastedText);
        const to = from + pastedText.length;
        view.dispatch(transaction);
        const coords = view.coordsAtPos(from);
        const containerRect = containerRef.current?.getBoundingClientRect();
        setPasteSuggestion({
          text: pastedText,
          from,
          to,
          top: containerRect ? Math.max(coords.top - containerRect.top - 48, 8) : 0,
          left: containerRect ? Math.max(coords.left - containerRect.left, 8) : 0,
          result: pasteAction.result
        });
        return true;
      }
    },
    onCreate({ editor: createdEditor }) {
      const document = toEditorDocument(createdEditor.getJSON());
      const text = createdEditor.getText({ blockSeparator: "\n" });
      setContentJson(JSON.stringify(document));
      setContentText(text);
      cacheEditorContent({
        noteId,
        workspaceId,
        title,
        updatedAt,
        contentJson: document,
        contentText: text,
        enqueueForSync: false
      });
    },
    onUpdate({ editor: updatedEditor }) {
      const document = toEditorDocument(updatedEditor.getJSON());
      const text = updatedEditor.getText({ blockSeparator: "\n" });
      setContentJson(JSON.stringify(document));
      setContentText(text);

      if (cacheTimerRef.current) {
        window.clearTimeout(cacheTimerRef.current);
      }

      cacheTimerRef.current = window.setTimeout(() => {
        cacheEditorContent({
          noteId,
          workspaceId,
          title,
          updatedAt,
          contentJson: document,
          contentText: text,
          enqueueForSync: true
        });
      }, 500);
    }
  });

  return (
    <div ref={containerRef} className="relative space-y-3">
      <input type="hidden" name="contentJson" value={contentJson} />
      <input type="hidden" name="contentText" value={contentText} />

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-2">
        <label className="mr-2 inline-flex h-8 items-center gap-2 rounded-md border border-border px-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={autoDetectionEnabled}
            onChange={(event) => setAutoDetectionEnabled(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Auto-detect
        </label>
        <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton label="Inline code" active={editor?.isActive("code")} onClick={() => editor?.chain().focus().toggleCode().run()}>
          <Code2 size={15} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Heading 3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={15} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton label="Checklist" active={editor?.isActive("taskList")} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
          <CheckSquare size={15} />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton label="Divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus size={15} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Code block" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <Braces size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Table"
          onClick={() =>
            editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <Table2 size={15} />
        </ToolbarButton>
      </div>

      {pasteSuggestion ? (
        <div
          className="absolute z-10 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm shadow-sm"
          style={{
            top: pasteSuggestion.top,
            left: pasteSuggestion.left
          }}
        >
          <span>
            Detected as {getDetectionLabel(pasteSuggestion.result)} (
            {Math.round(pasteSuggestion.result.confidence * 100)}% confidence). Format as code block?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
              onClick={() => {
                if (!editor) {
                  setPasteSuggestion(null);
                  return;
                }

                const codeBlock = editor.schema.nodes.codeBlock?.create(
                  createDetectedCodeBlock(
                    pasteSuggestion.text,
                    pasteSuggestion.result,
                    "suggestion_accepted"
                  ).attrs,
                  editor.schema.text(pasteSuggestion.text)
                );

                if (codeBlock) {
                  editor
                    .chain()
                    .focus()
                    .command(({ tr, dispatch }) => {
                      dispatch?.(
                        tr.replaceRangeWith(pasteSuggestion.from, pasteSuggestion.to, codeBlock)
                          .scrollIntoView()
                      );
                      return true;
                    })
                    .run();
                }
                setPasteSuggestion(null);
              }}
            >
              Format
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-background"
              onClick={() => setPasteSuggestion(null)}
            >
              Ignore
            </button>
          </div>
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-muted " +
        (active ? "bg-muted text-primary" : "text-muted-foreground")
      }
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-8 w-px bg-border" aria-hidden />;
}

function toTiptapContent(document: EditorDocument): JSONContent {
  return {
    type: "doc",
    content: document.content as JSONContent["content"]
  };
}

function serializeContent(content: JSONContent) {
  return JSON.stringify(toEditorDocument(content));
}

function toEditorDocument(content: JSONContent): EditorDocument {
  return {
    ...content,
    type: "doc",
    schemaVersion: 1
  } as EditorDocument;
}

function createDetectedCodeBlock(
  text: string,
  result: DetectionResult,
  source: "auto_detected" | "suggestion_accepted"
): JSONContent {
  return {
    type: "codeBlock",
    attrs: {
      language: result.language ?? "plaintext",
      detectedType: result.detectedType,
      showLineNumbers: true,
      wordWrap: result.detectedType === "json" || result.detectedType === "terminal",
      source,
      confidence: result.confidence
    },
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function insertDetectedCodeBlock(
  view: EditorView,
  text: string,
  result: DetectionResult,
  source: "auto_detected" | "suggestion_accepted"
) {
  const { state, dispatch } = view;
  const codeBlock = state.schema.nodes.codeBlock?.create(
    createDetectedCodeBlock(text, result, source).attrs,
    state.schema.text(text)
  );

  if (!codeBlock) {
    return;
  }

  dispatch(state.tr.replaceSelectionWith(codeBlock).scrollIntoView());
}

function getDetectionLabel(result: DetectionResult) {
  if (result.language && result.language !== "plaintext") {
    return result.language;
  }

  return result.detectedType === "code" ? "code" : result.detectedType;
}

function cacheEditorContent({
  noteId,
  workspaceId,
  title,
  updatedAt,
  contentJson,
  contentText,
  enqueueForSync
}: {
  noteId: string;
  workspaceId: string;
  title: string;
  updatedAt: string;
  contentJson: EditorDocument;
  contentText: string;
  enqueueForSync: boolean;
}) {
  const currentTitle =
    document.querySelector<HTMLInputElement>(`input[name="title"][data-note-id="${noteId}"]`)?.value ?? title;
  const note = {
    noteId,
    workspaceId,
    title: currentTitle,
    contentJson,
    contentText,
    updatedAt,
    localUpdatedAt: new Date().toISOString(),
    syncStatus: enqueueForSync ? "local_pending" : "synced"
  } as const;

  void putCachedNote(note)
    .then(() => {
      if (enqueueForSync) {
        return enqueueSyncOperation(createUpdateNoteOperation(note));
      }
      return undefined;
    })
    .catch(() => {
      // Local cache is best-effort and should not interrupt editing.
    });
}
