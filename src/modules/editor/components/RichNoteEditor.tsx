"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { EditorContent, type Editor, type JSONContent, useEditor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
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
  Image as ImageIcon,
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
import { updateNoteAction } from "@/modules/notes/note.actions";
import {
  createUpdateNoteOperation,
  discardCachedNoteUpdate,
  enqueueSyncOperation,
  getCachedNote,
  putCachedNote
} from "@/modules/offline-sync/indexeddb.client";
import type { EditorPreferences } from "@/modules/preferences/preferences.types";

type RichNoteEditorProps = {
  noteId: string;
  workspaceId: string;
  title: string;
  updatedAt: string;
  initialContent: EditorDocument;
  preferences: EditorPreferences;
  titleControl?: ReactNode;
};

export function RichNoteEditor({
  noteId,
  workspaceId,
  title,
  updatedAt,
  initialContent,
  preferences,
  titleControl
}: RichNoteEditorProps) {
  const tiptapContent = useMemo(() => toTiptapContent(initialContent), [initialContent]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contentJson, setContentJson] = useState(() => serializeContent(tiptapContent));
  const [contentText, setContentText] = useState(() => extractPlainTextFromEditorJson(initialContent));
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(preferences.autoDetectionEnabled);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingCloseNoteId, setPendingCloseNoteId] = useState<string | null>(null);
  const autoDetectionEnabledRef = useRef(autoDetectionEnabled);
  const dirtyRef = useRef(false);
  const cacheTimerRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
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
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    return () => {
      if (cacheTimerRef.current) {
        window.clearTimeout(cacheTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    function handleBeforeCloseTab(event: Event) {
      const detail = (event as CustomEvent<{ noteId?: string }>).detail;

      if (!dirtyRef.current || detail?.noteId !== noteId) {
        return;
      }

      event.preventDefault();
      setPendingCloseNoteId(noteId);
    }

    window.addEventListener("technote:before-close-tab", handleBeforeCloseTab);
    return () => window.removeEventListener("technote:before-close-tab", handleBeforeCloseTab);
  }, [noteId]);

  useEffect(() => {
    const form = document.getElementById(`note-editor-form-${noteId}`);

    function handleSubmit() {
      markNoteDirty(noteId, false);
    }

    form?.addEventListener("submit", handleSubmit);
    return () => form?.removeEventListener("submit", handleSubmit);
  }, [noteId]);

  useEffect(() => {
    function handleDirty(event: Event) {
      const detail = (event as CustomEvent<{ noteId: string; dirty: boolean }>).detail;

      if (detail?.noteId === noteId) {
        setIsDirty(detail.dirty);
      }
    }

    window.addEventListener("technote:note-dirty", handleDirty);
    return () => window.removeEventListener("technote:note-dirty", handleDirty);
  }, [noteId]);

  useEffect(() => {
    function handleOutlineJump(event: Event) {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;

      if (!text || !containerRef.current) {
        return;
      }

      const headings = Array.from(containerRef.current.querySelectorAll("h1, h2, h3"));
      const heading = headings.find((candidate) => candidate.textContent?.trim() === text);
      heading?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    window.addEventListener("technote:outline-jump", handleOutlineJump);
    return () => window.removeEventListener("technote:outline-jump", handleOutlineJump);
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
      TiptapImage.configure({
        allowBase64: false
      })
    ],
    content: tiptapContent,
    editorProps: {
      attributes: {
        class:
          "min-h-[58vh] px-5 py-4 outline-none " +
          getEditorTypographyClass(preferences)
      },
      handlePaste(view, event) {
        const pastedImages = getClipboardDataImageFiles(event);

        if (pastedImages.length > 0) {
          if (!preferences.clipboardImagePasteEnabled) {
            return false;
          }

          event.preventDefault();

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return true;
          }

          void resolveClipboardImageFiles(pastedImages).then((files) =>
            uploadImagesSequentially({
              files,
              noteId,
              view,
              insertAtSelection: true
            })
          );
          return true;
        }

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
      void hydrateEditorFromCache({
        editor: createdEditor,
        noteId,
        workspaceId,
        title,
        updatedAt,
        onContentLoaded: (document, text, dirty) => {
          setContentJson(JSON.stringify(document));
          setContentText(text);
          markNoteDirty(noteId, dirty);
        }
      });
    },
    onUpdate({ editor: updatedEditor }) {
      const document = toEditorDocument(updatedEditor.getJSON());
      const text = updatedEditor.getText({ blockSeparator: "\n" });
      setContentJson(JSON.stringify(document));
      setContentText(text);
      markNoteDirty(noteId, true);

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
          localPending: true,
          enqueueForSync: isOffline()
        });
      }, 500);
    }
  });

  function handleDroppedImages(event: DragEvent<HTMLDivElement>) {
    const droppedImages = getDataTransferImageFiles(event.dataTransfer);

    if (!editor || droppedImages.length === 0) {
      return;
    }

    event.preventDefault();
    editor.commands.focus();

    void uploadImagesSequentially({
      files: droppedImages,
      noteId,
      view: editor.view,
      insertAtSelection: true
    });
  }

  async function saveCurrentNote() {
    if (cacheTimerRef.current) {
      window.clearTimeout(cacheTimerRef.current);
      cacheTimerRef.current = null;
    }

    const formData = new FormData();
    const currentTitle =
      document.querySelector<HTMLInputElement>(`input[name="title"][data-note-id="${noteId}"]`)?.value ?? title;
    const currentDocument = editor ? toEditorDocument(editor.getJSON()) : (JSON.parse(contentJson) as EditorDocument);
    const currentText = editor?.getText({ blockSeparator: "\n" }) ?? contentText;

    formData.set("noteId", noteId);
    formData.set("title", currentTitle);
    formData.set("contentJson", JSON.stringify(currentDocument));
    formData.set("contentText", currentText);

    await updateNoteAction(formData);
    await discardCachedNoteUpdate(noteId);
    markNoteDirty(noteId, false);
  }

  async function continueWithoutSaving() {
    if (!pendingCloseNoteId) {
      return;
    }

    const noteIdToClose = pendingCloseNoteId;
    if (cacheTimerRef.current) {
      window.clearTimeout(cacheTimerRef.current);
      cacheTimerRef.current = null;
    }

    await discardCachedNoteUpdate(noteIdToClose);
    markNoteDirty(noteId, false);
    setPendingCloseNoteId(null);
    window.dispatchEvent(new CustomEvent("technote:close-tab", { detail: { noteId: noteIdToClose } }));
  }

  async function saveAndContinue() {
    if (!pendingCloseNoteId) {
      return;
    }

    const noteIdToClose = pendingCloseNoteId;
    await saveCurrentNote();
    setPendingCloseNoteId(null);
    window.dispatchEvent(new CustomEvent("technote:close-tab", { detail: { noteId: noteIdToClose } }));
  }

  return (
    <div
      ref={containerRef}
      className="relative space-y-3"
      data-code-theme={preferences.codeTheme}
      onDragOver={(event) => {
        const hasDraggedImage = Array.from(event.dataTransfer.items).some(
          (item) => item.kind === "file" && ["image/png", "image/jpeg", "image/webp"].includes(item.type)
        );

        if (hasDraggedImage) {
          event.preventDefault();
        }
      }}
      onDrop={handleDroppedImages}
    >
      <input type="hidden" name="contentJson" value={contentJson} />
      <input type="hidden" name="contentText" value={contentText} />

      <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-border bg-background/95 p-2 backdrop-blur">
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
        <ToolbarButton
          label="Upload image"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon size={15} />
        </ToolbarButton>
      </div>
      {titleControl ? <div className="px-5 pt-5">{titleControl}</div> : null}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = getImageFiles(Array.from(event.target.files ?? []));
          event.target.value = "";

          if (editor && files.length > 0) {
            void uploadImagesSequentially({
              files,
              noteId,
              view: editor.view,
              insertAtSelection: false
            });
          }
        }}
      />

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
      {pendingCloseNoteId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-md border border-border bg-panel-strong p-4 shadow-2xl">
            <h2 className="text-base font-semibold">Unsaved changes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This note has unsaved changes. Save before leaving?
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => setPendingCloseNoteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={continueWithoutSaving}
              >
                Don't Save
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                onClick={() => {
                  void saveAndContinue();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function markNoteDirty(noteId: string, dirty: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("technote:note-dirty", { detail: { noteId, dirty } }));
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

function getEditorTypographyClass(preferences: EditorPreferences) {
  const fontFamilyClass =
    preferences.fontFamily === "mono"
      ? "font-mono"
      : preferences.fontFamily === "serif"
        ? "font-serif"
        : "font-sans";
  const lineHeightClass =
    preferences.lineHeight === "compact"
      ? "leading-6"
      : preferences.lineHeight === "spacious"
        ? "leading-8"
        : "leading-7";

  return `${fontFamilyClass} ${lineHeightClass}`;
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

async function uploadImagesSequentially({
  files,
  noteId,
  view,
  insertAtSelection
}: {
  files: File[];
  noteId: string;
  view: EditorView;
  insertAtSelection: boolean;
}) {
  for (const file of files) {
    const result = await uploadImageFile(file, noteId);

    if (result.src) {
      insertImageIntoEditor(view, {
        src: result.src,
        alt: result.alt ?? file.name,
        insertAtSelection
      });
    }
  }
}

async function uploadImageFile(file: File, noteId: string) {
  try {
    const formData = new FormData();
    formData.set("noteId", noteId);
    formData.set("file", file);
    const response = await fetch("/api/upload/image", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as { src?: string; alt?: string };

    if (!response.ok || !payload.src) {
      return {};
    }

    return { src: payload.src, alt: payload.alt ?? file.name };
  } catch {
    return {};
  }
}

function insertImageIntoEditor(
  view: EditorView,
  image: { src: string; alt: string; insertAtSelection: boolean }
) {
  const { state, dispatch } = view;
  const imageNode = state.schema.nodes.image?.create({
    src: image.src,
    alt: image.alt,
    title: "Add caption..."
  });

  if (!imageNode) {
    return;
  }

  const { $from } = state.selection;
  const parent = $from.parent;
  const insertAfterCurrentBlock = $from.depth > 0 && (parent.type.name === "codeBlock" || parent.textContent.trim().length > 0);
  const rawPosition = image.insertAtSelection && insertAfterCurrentBlock ? $from.after($from.depth) : state.selection.to;
  const position = Math.max(0, Math.min(rawPosition, state.doc.content.size));

  try {
    dispatchImageInsertion(view, imageNode, position);
  } catch {
    try {
      dispatchImageInsertion(view, imageNode, view.state.doc.content.size);
    } catch {
      // Keep one failed insert from aborting the rest of a multi-image upload.
    }
  }
}

function dispatchImageInsertion(view: EditorView, imageNode: ProseMirrorNode, position: number) {
  const { state, dispatch } = view;
  const safePosition = Math.max(0, Math.min(position, state.doc.content.size));
  const tr = state.tr.insert(safePosition, imageNode);
  const nextPosition = Math.min(safePosition + imageNode.nodeSize, tr.doc.content.size);

  dispatch(tr.setSelection(Selection.near(tr.doc.resolve(nextPosition))).scrollIntoView());
}

function getClipboardDataImageFiles(event: ClipboardEvent) {
  const itemFiles = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return getImageFiles(itemFiles.length > 0 ? itemFiles : Array.from(event.clipboardData?.files ?? []));
}

async function resolveClipboardImageFiles(fallbackFiles: File[]) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return fallbackFiles;
  }

  try {
    const clipboardItems = await navigator.clipboard.read();
    const clipboardFiles = (
      await Promise.all(
        clipboardItems.flatMap((item) =>
          item.types
            .filter((type) => ["image/png", "image/jpeg", "image/webp"].includes(type))
            .map(async (type) => {
              const blob = await item.getType(type);
              const extension = type.split("/")[1] ?? "png";
              return new File([blob], `clipboard-image.${extension}`, { type });
            })
        )
      )
    ).filter((file): file is File => Boolean(file));

    return clipboardFiles.length > fallbackFiles.length ? clipboardFiles : fallbackFiles;
  } catch {
    return fallbackFiles;
  }
}

function getDataTransferImageFiles(dataTransfer: DataTransfer) {
  const itemFiles = Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return getImageFiles(itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files));
}

function getImageFiles(files: File[]) {
  return files.filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type));
}

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function hydrateEditorFromCache({
  editor,
  noteId,
  workspaceId,
  title,
  updatedAt,
  onContentLoaded
}: {
  editor: Editor;
  noteId: string;
  workspaceId: string;
  title: string;
  updatedAt: string;
  onContentLoaded: (document: EditorDocument, text: string, dirty: boolean) => void;
}) {
  const cachedNote = await getCachedNote(noteId);

  if (cachedNote?.syncStatus === "local_pending") {
    const document = cachedNote.contentJson ?? toEditorDocument(editor.getJSON());

    if (cachedNote.contentJson) {
      editor.commands.setContent(toTiptapContent(cachedNote.contentJson), false);
    }

    onContentLoaded(document, cachedNote.contentText, true);
    return;
  }

  const document = toEditorDocument(editor.getJSON());
  const text = editor.getText({ blockSeparator: "\n" });
  onContentLoaded(document, text, false);
  cacheEditorContent({
    noteId,
    workspaceId,
    title,
    updatedAt,
    contentJson: document,
    contentText: text,
    localPending: false,
    enqueueForSync: false
  });
}

function cacheEditorContent({
  noteId,
  workspaceId,
  title,
  updatedAt,
  contentJson,
  contentText,
  localPending,
  enqueueForSync
}: {
  noteId: string;
  workspaceId: string;
  title: string;
  updatedAt: string;
  contentJson: EditorDocument;
  contentText: string;
  localPending: boolean;
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
    syncStatus: localPending ? "local_pending" : "synced"
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
