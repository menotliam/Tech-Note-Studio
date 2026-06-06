"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject
} from "react";
import { useRouter } from "next/navigation";
import { Extension, type CommandProps } from "@tiptap/core";
import { EditorContent, type Editor, type JSONContent, useEditor } from "@tiptap/react";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
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
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Search,
  X,
  Table2
} from "lucide-react";
import { normalizeKeyboardEvent } from "@/modules/keybindings/keybindings.normalize";
import { resolveKeybindingCommand } from "@/modules/keybindings/keybindings.registry";
import type { KeybindingCommandId } from "@/modules/keybindings/keybindings.types";
import { extractPlainTextFromEditorJson } from "@/modules/editor/editor-text-extractor";
import { getPasteDetectionAction } from "@/modules/editor/editor-paste-detection";
import { ImageBlock } from "@/modules/editor/extensions/ImageBlock";
import { ListKeyboardShortcuts } from "@/modules/editor/extensions/ListKeyboardShortcuts";
import { TechnicalCodeBlock } from "@/modules/editor/extensions/TechnicalCodeBlock";
import type { EditorDocument } from "@/modules/editor/editor.types";
import type { DetectionResult } from "@/modules/detection/detection.types";
import { updateNoteAction } from "@/modules/notes/note.actions";
import { notificationCopy } from "@/modules/notifications/notification-copy";
import { notify } from "@/modules/notifications/notification.service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

type TextAlignment = "left" | "center" | "right";
type EditorContentNode = NonNullable<EditorDocument["content"]>[number];
type EditorContentChildren = EditorContentNode[];
type EditorFindMatch = { from: number; to: number };
type EditorFindHighlightState = {
  matches: EditorFindMatch[];
  activeIndex: number;
};

const imageCaretAnchor = "\u200B";
const internalImageDragType = "application/x-technote-image-position";
const pendingEditorScrollRestores = new Map<string, number>();
const editorFindHighlightPluginKey = new PluginKey<EditorFindHighlightState>("editorFindHighlight");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlignment: {
      setTextAlignment: (alignment: TextAlignment) => ReturnType;
    };
  }
}

const textAlignmentNodeTypes = new Set(["paragraph", "heading"]);

const TextAlignmentExtension = Extension.create({
  name: "textAlignment",

  addGlobalAttributes() {
    return [
      {
        types: Array.from(textAlignmentNodeTypes),
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => sanitizeTextAlignment(element.style.textAlign),
            renderHTML: (attributes) => {
              const textAlign = sanitizeTextAlignment(attributes.textAlign);

              return textAlign ? { style: `text-align: ${textAlign}` } : {};
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setTextAlignment:
        (alignment: TextAlignment) =>
        ({ state, dispatch }: CommandProps) => {
          const nextAlignment = sanitizeTextAlignment(alignment);

          if (!nextAlignment) {
            return false;
          }

          const transaction = state.tr;
          const { from, to, empty, $from } = state.selection;
          let changed = false;

          if (state.selection instanceof NodeSelection && state.selection.node.type.name === "image") {
            const parentTarget = getSelectionParentTextAlignmentTarget(state);

            if (parentTarget) {
              transaction.setNodeMarkup(parentTarget.position, undefined, {
                ...parentTarget.node.attrs,
                textAlign: nextAlignment
              });
              changed = true;
            }
          } else if (state.selection instanceof NodeSelection && textAlignmentNodeTypes.has(state.selection.node.type.name)) {
            transaction.setNodeMarkup(from, undefined, { ...state.selection.node.attrs, textAlign: nextAlignment });
            changed = true;
          } else if (empty) {
            const nearbyImage = getNearbyImageTextAlignmentTarget(state);

            if (nearbyImage) {
              transaction.setNodeMarkup(nearbyImage.position, undefined, {
                ...nearbyImage.node.attrs,
                textAlign: nextAlignment
              });
              changed = true;
            }

            for (let depth = $from.depth; depth >= 0; depth -= 1) {
              const node = $from.node(depth);

              if (!changed && textAlignmentNodeTypes.has(node.type.name)) {
                const position = depth === 0 ? 0 : $from.before(depth);
                transaction.setNodeMarkup(position, undefined, { ...node.attrs, textAlign: nextAlignment });
                changed = true;
                break;
              }
            }
          } else {
            state.doc.nodesBetween(from, to, (node, position) => {
              if (!textAlignmentNodeTypes.has(node.type.name)) {
                return true;
              }

              transaction.setNodeMarkup(position, undefined, { ...node.attrs, textAlign: nextAlignment });
              changed = true;
              return false;
            });
          }

          if (!changed) {
            return false;
          }

          dispatch?.(transaction.scrollIntoView());
          return true;
        }
    };
  }
});

const EditorFindHighlightExtension = Extension.create({
  name: "editorFindHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<EditorFindHighlightState>({
        key: editorFindHighlightPluginKey,
        state: {
          init() {
            return {
              matches: [],
              activeIndex: 0
            };
          },
          apply(transaction, previousState) {
            return transaction.getMeta(editorFindHighlightPluginKey) ?? previousState;
          }
        },
        props: {
          decorations(state) {
            const highlightState = editorFindHighlightPluginKey.getState(state);

            if (!highlightState?.matches.length) {
              return DecorationSet.empty;
            }

            return DecorationSet.create(
              state.doc,
              highlightState.matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class:
                    "editor-find-match " +
                    (index === highlightState.activeIndex ? "editor-find-match-active" : "")
                })
              )
            );
          }
        }
      })
    ];
  }
});

export function RichNoteEditor({
  noteId,
  workspaceId,
  title,
  updatedAt,
  initialContent,
  preferences,
  titleControl
}: RichNoteEditorProps) {
  const router = useRouter();
  const tiptapContent = useMemo(() => toTiptapContent(initialContent), [initialContent]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contentJson, setContentJson] = useState(() => serializeContent(tiptapContent));
  const [contentText, setContentText] = useState(() => extractPlainTextFromEditorJson(initialContent));
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(preferences.autoDetectionEnabled);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTextAlignment, setActiveTextAlignment] = useState<TextAlignment>("left");
  const [, refreshToolbarState] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatches, setFindMatches] = useState<EditorFindMatch[]>([]);
  const [activeFindIndex, setActiveFindIndex] = useState(0);
  const [pendingCloseNoteId, setPendingCloseNoteId] = useState<string | null>(null);
  const autoDetectionEnabledRef = useRef(autoDetectionEnabled);
  const saveCurrentNoteRef = useRef<(() => Promise<void>) | null>(null);
  const dirtyRef = useRef(false);
  const cacheWriteVersionRef = useRef(0);
  const savedCacheVersionRef = useRef(0);
  const cacheTimerRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const [pasteSuggestion, setPasteSuggestion] = useState<{
    text: string;
    from: number;
    to: number;
    top: number;
    left: number;
    result: DetectionResult;
  } | null>(null);

  useLayoutEffect(() => {
    const scrollTop = pendingEditorScrollRestores.get(noteId);

    if (scrollTop === undefined) {
      return;
    }

    const scrollContainer = containerRef.current?.closest<HTMLElement>("[data-editor-scroll-container]");

    if (!scrollContainer) {
      return;
    }

    pendingEditorScrollRestores.delete(noteId);
    restoreScrollPosition(scrollContainer, scrollTop);
  }, [noteId, updatedAt]);

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
    enableInputRules: preferences.markdownShortcutsEnabled,
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
      TextAlignmentExtension,
      EditorFindHighlightExtension,
      ListKeyboardShortcuts.configure({
        maxDepth: 4
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
      ImageBlock.configure({
        allowBase64: false,
        inline: true,
        noteId
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
            notify(notificationCopy.imageUploadOffline());
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

        if (isPlaintextCodeBlockClipboardPaste(event)) {
          event.preventDefault();
          view.dispatch(view.state.tr.insertText(pastedText).scrollIntoView());
          setPasteSuggestion(null);
          return true;
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
      },
      handleDrop(view, event) {
        if (!event.dataTransfer) {
          return false;
        }

        const movedImagePosition = getDraggedImagePosition(event.dataTransfer);

        if (typeof movedImagePosition === "number") {
          event.preventDefault();
          const droppedPosition = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          moveImageInEditor(view, movedImagePosition, droppedPosition);
          return true;
        }

        const droppedImages = getDataTransferImageFiles(event.dataTransfer);

        if (droppedImages.length === 0) {
          return false;
        }

        event.preventDefault();

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          notify(notificationCopy.imageUploadOffline());
          return true;
        }

        const droppedPosition = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        view.focus();

        void uploadImagesSequentially({
          files: droppedImages,
          noteId,
          view,
          insertAtSelection: true,
          position: droppedPosition
        });
        return true;
      },
      handleKeyDown(view, event) {
        const shortcut = normalizeKeyboardEvent(event);

        if (!shortcut) {
          return false;
        }

        const commandId = resolveKeybindingCommand(preferences.keybindings, "editor", shortcut);

        if (!commandId) {
          return false;
        }

        event.preventDefault();
        executeEditorKeybindingCommand({
          commandId,
          view,
          saveCurrentNoteRef,
          openFindPanel: () => {
            setFindOpen(true);
            window.requestAnimationFrame(() => findInputRef.current?.focus());
          }
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
          setActiveTextAlignment(getActiveTextAlignment(createdEditor.state));
          markNoteDirty(noteId, dirty);
        }
      });
    },
    onSelectionUpdate({ editor: updatedEditor }) {
      setActiveTextAlignment(getActiveTextAlignment(updatedEditor.state));
    },
    onTransaction({ editor: updatedEditor }) {
      setActiveTextAlignment(getActiveTextAlignment(updatedEditor.state));
      refreshToolbarState((version) => version + 1);
    },
    onUpdate({ editor: updatedEditor }) {
      const document = toEditorDocument(updatedEditor.getJSON());
      const text = updatedEditor.getText({ blockSeparator: "\n" });
      const cacheWriteVersion = cacheWriteVersionRef.current + 1;
      cacheWriteVersionRef.current = cacheWriteVersion;

      setContentJson(JSON.stringify(document));
      setContentText(text);
      setActiveTextAlignment(getActiveTextAlignment(updatedEditor.state));
      markNoteDirty(noteId, true);

      if (cacheTimerRef.current) {
        window.clearTimeout(cacheTimerRef.current);
      }

      cacheTimerRef.current = window.setTimeout(() => {
        if (cacheWriteVersion <= savedCacheVersionRef.current) {
          return;
        }

        void cacheEditorContent({
          noteId,
          workspaceId,
          title,
          updatedAt,
          contentJson: document,
          contentText: text,
          localPending: true,
          enqueueForSync: isOffline()
        }).then(() => {
          if (cacheWriteVersion <= savedCacheVersionRef.current) {
            void discardCachedNoteUpdate(noteId);
          }
        });
      }, 500);
    }
  });

  const saveCurrentNote = useCallback(async () => {
    if (cacheTimerRef.current) {
      window.clearTimeout(cacheTimerRef.current);
      cacheTimerRef.current = null;
    }

    dispatchNoteSaveStarted(noteId);

    const formData = new FormData();
    const currentTitle =
      document.querySelector<HTMLInputElement>(`input[name="title"][data-note-id="${noteId}"]`)?.value ?? title;
    const currentDocument = editor ? toEditorDocument(editor.getJSON()) : (JSON.parse(contentJson) as EditorDocument);

    formData.set("noteId", noteId);
    formData.set("title", currentTitle);
    formData.set("contentJson", JSON.stringify(currentDocument));

    try {
      await updateNoteAction(formData);
      savedCacheVersionRef.current = cacheWriteVersionRef.current;
      await discardCachedNoteUpdate(noteId);
      markNoteDirty(noteId, false);
      notify(notificationCopy.noteSaved());
      const scrollContainer = containerRef.current?.closest<HTMLElement>("[data-editor-scroll-container]");
      const scrollTop = scrollContainer?.scrollTop ?? null;
      if (scrollTop !== null) {
        pendingEditorScrollRestores.set(noteId, scrollTop);
      }
      router.refresh();
      if (scrollContainer && scrollTop !== null) {
        restoreScrollPosition(scrollContainer, scrollTop);
      }
    } catch (error) {
      notify(notificationCopy.noteSaveFailed());
      throw error;
    }
  }, [contentJson, editor, noteId, router, title]);

  useEffect(() => {
    saveCurrentNoteRef.current = saveCurrentNote;
  }, [saveCurrentNote]);

  useEffect(() => {
    const form = document.getElementById(`note-editor-form-${noteId}`);

    function handleSubmit(event: Event) {
      event.preventDefault();
      void saveCurrentNote().catch(() => {
        // The toast explains the failure; the editor keeps the local draft.
      });
    }

    form?.addEventListener("submit", handleSubmit);
    return () => form?.removeEventListener("submit", handleSubmit);
  }, [noteId, saveCurrentNote]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const matches = findQuery ? collectEditorFindMatches(editor, findQuery) : [];
    setFindMatches(matches);
    setActiveFindIndex((currentIndex) => Math.min(currentIndex, Math.max(matches.length - 1, 0)));
  }, [contentJson, editor, findQuery]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.view.dispatch(
      editor.state.tr.setMeta(editorFindHighlightPluginKey, {
        matches: findOpen ? findMatches : [],
        activeIndex: Math.min(activeFindIndex, Math.max(findMatches.length - 1, 0))
      } satisfies EditorFindHighlightState)
    );

    if (findOpen && findMatches.length > 0) {
      window.requestAnimationFrame(() => scrollActiveEditorFindMatchIntoView(editor));
    }
  }, [activeFindIndex, editor, findMatches, findOpen]);

  useEffect(() => {
    if (!findOpen) {
      return;
    }

    findInputRef.current?.focus();
  }, [findOpen]);

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
    try {
      await saveCurrentNote();
    } catch {
      return;
    }
    setPendingCloseNoteId(null);
    window.dispatchEvent(new CustomEvent("technote:close-tab", { detail: { noteId: noteIdToClose } }));
  }

  return (
    <div
      ref={containerRef}
      className="relative space-y-3"
      data-code-theme={preferences.codeTheme}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes(internalImageDragType)) {
          event.preventDefault();
          return;
        }

        const hasDraggedImage = Array.from(event.dataTransfer.items).some(
          (item) => item.kind === "file" && ["image/png", "image/jpeg", "image/webp"].includes(item.type)
        );

        if (hasDraggedImage) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="contentJson" value={contentJson} />

      <div className="sticky top-0 z-30 flex min-h-11 items-center gap-1 overflow-x-auto border-b border-border bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur">
        <label className="mr-1 inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-panel px-2 text-xs text-muted-foreground">
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
        <ToolbarButton label="Align left" active={activeTextAlignment === "left"} onClick={() => editor?.chain().focus().setTextAlignment("left").run()}>
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton label="Align center" active={activeTextAlignment === "center"} onClick={() => editor?.chain().focus().setTextAlignment("center").run()}>
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton label="Align right" active={activeTextAlignment === "right"} onClick={() => editor?.chain().focus().setTextAlignment("right").run()}>
          <AlignRight size={15} />
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
      {findOpen ? (
        <EditorFindPanel
          inputRef={findInputRef}
          query={findQuery}
          matchCount={findMatches.length}
          activeIndex={activeFindIndex}
          onQueryChange={(query) => {
            setFindQuery(query);
            setActiveFindIndex(0);
          }}
          onPrevious={() => setActiveFindIndex((activeFindIndex - 1 + findMatches.length) % findMatches.length)}
          onNext={() => setActiveFindIndex((activeFindIndex + 1) % findMatches.length)}
          onClose={() => {
            setFindOpen(false);
            setFindQuery("");
          }}
        />
      ) : null}
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
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unsaved changes</DialogTitle>
              <DialogDescription>This note has unsaved changes. Save before leaving?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingCloseNoteId(null)}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={continueWithoutSaving}>
                Don't Save
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void saveAndContinue();
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

function executeEditorKeybindingCommand({
  commandId,
  view,
  saveCurrentNoteRef,
  openFindPanel
}: {
  commandId: KeybindingCommandId;
  view: EditorView;
  saveCurrentNoteRef: MutableRefObject<(() => Promise<void>) | null>;
  openFindPanel: () => void;
}) {
  switch (commandId) {
    case "note.save":
      void saveCurrentNoteRef.current?.();
      return;
    case "editor.find":
      openFindPanel();
      return;
    case "editor.alignLeft":
      applyTextAlignment(view, "left");
      return;
    case "editor.alignCenter":
      applyTextAlignment(view, "center");
      return;
    case "editor.alignRight":
      applyTextAlignment(view, "right");
      return;
    case "editor.toggleFocusMode":
      dispatchToggleFocusMode();
      return;
    case "editor.insertCodeBlock":
      insertManualCodeBlock(view);
      return;
  }
}

function applyTextAlignment(view: EditorView, alignment: TextAlignment) {
  const { state, dispatch } = view;
  const nextAlignment = sanitizeTextAlignment(alignment);

  if (!nextAlignment) {
    return;
  }

  const transaction = state.tr;
  const { from, to, empty, $from } = state.selection;
  let changed = false;

  if (state.selection instanceof NodeSelection && state.selection.node.type.name === "image") {
    const parentTarget = getSelectionParentTextAlignmentTarget(state);

    if (parentTarget) {
      transaction.setNodeMarkup(parentTarget.position, undefined, {
        ...parentTarget.node.attrs,
        textAlign: nextAlignment
      });
      changed = true;
    }
  } else if (state.selection instanceof NodeSelection && textAlignmentNodeTypes.has(state.selection.node.type.name)) {
    transaction.setNodeMarkup(from, undefined, { ...state.selection.node.attrs, textAlign: nextAlignment });
    changed = true;
  } else if (empty) {
    const nearbyImage = getNearbyImageTextAlignmentTarget(state);

    if (nearbyImage) {
      transaction.setNodeMarkup(nearbyImage.position, undefined, {
        ...nearbyImage.node.attrs,
        textAlign: nextAlignment
      });
      changed = true;
    }

    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);

      if (!changed && textAlignmentNodeTypes.has(node.type.name)) {
        const position = depth === 0 ? 0 : $from.before(depth);
        transaction.setNodeMarkup(position, undefined, { ...node.attrs, textAlign: nextAlignment });
        changed = true;
        break;
      }
    }
  } else {
    state.doc.nodesBetween(from, to, (node, position) => {
      if (!textAlignmentNodeTypes.has(node.type.name)) {
        return true;
      }

      transaction.setNodeMarkup(position, undefined, { ...node.attrs, textAlign: nextAlignment });
      changed = true;
      return false;
    });
  }

  if (changed) {
    dispatch(transaction.scrollIntoView());
    view.focus();
  }
}

function insertManualCodeBlock(view: EditorView) {
  const { state, dispatch } = view;
  const selectedText = state.selection.empty ? "" : state.doc.textBetween(state.selection.from, state.selection.to, "\n");
  const insertPosition = state.selection.from;
  const codeBlock = state.schema.nodes.codeBlock?.create({
    language: "plaintext",
    detectedType: "plain_text",
    showLineNumbers: true,
    wordWrap: false,
    source: "manual",
    confidence: 1
  }, selectedText ? state.schema.text(selectedText) : undefined);

  if (!codeBlock) {
    return;
  }

  const transaction = state.tr.replaceSelectionWith(codeBlock);
  const codeBlockPosition = transaction.mapping.map(insertPosition, -1);
  const cursorPosition = Math.min(codeBlockPosition + 1 + selectedText.length, transaction.doc.content.size);
  dispatch(transaction.setSelection(TextSelection.create(transaction.doc, cursorPosition)).scrollIntoView());
  view.focus();
}

function dispatchToggleFocusMode() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("technote:toggle-focus-mode"));
}

function EditorFindPanel({
  inputRef,
  query,
  matchCount,
  activeIndex,
  onQueryChange,
  onPrevious,
  onNext,
  onClose
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  matchCount: number;
  activeIndex: number;
  onQueryChange: (query: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const hasMatches = matchCount > 0;

  return (
    <div className="sticky left-2 top-[49px] z-20 mt-2 inline-flex w-fit max-w-[calc(100%-1rem)] items-center gap-1 rounded-md border border-border bg-panel-strong px-2 py-1.5 shadow-2xl shadow-black/20">
      <Search size={15} className="text-muted-foreground" />
      <Input
        ref={inputRef}
        autoFocus
        className="h-7 w-44 px-2 text-sm"
        value={query}
        placeholder="Find in note"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && hasMatches) {
            event.preventDefault();
            if (event.shiftKey) {
              onPrevious();
              return;
            }

            onNext();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <span className="min-w-12 rounded bg-muted px-1.5 py-1 text-right text-xs tabular-nums text-muted-foreground">
        {query ? (hasMatches ? `${activeIndex + 1}/${matchCount}` : "0/0") : ""}
      </span>
      <ToolbarButton label="Previous match" active={false} onClick={hasMatches ? onPrevious : () => undefined}>
        <ChevronUp size={15} />
      </ToolbarButton>
      <ToolbarButton label="Next match" active={false} onClick={hasMatches ? onNext : () => undefined}>
        <ChevronDown size={15} />
      </ToolbarButton>
      <ToolbarButton label="Close find" active={false} onClick={onClose}>
        <X size={15} />
      </ToolbarButton>
    </div>
  );
}

function collectEditorFindMatches(editor: Editor, query: string): EditorFindMatch[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const matches: EditorFindMatch[] = [];

  editor.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) {
      return true;
    }

    const text = node.text.toLowerCase();
    let index = text.indexOf(normalizedQuery);

    while (index >= 0) {
      matches.push({
        from: position + index,
        to: position + index + normalizedQuery.length
      });
      index = text.indexOf(normalizedQuery, index + normalizedQuery.length);
    }

    return true;
  });

  return matches;
}

function scrollActiveEditorFindMatchIntoView(editor: Editor) {
  const activeMatch = editor.view.dom.querySelector(".editor-find-match-active");

  if (!(activeMatch instanceof HTMLElement)) {
    return;
  }

  activeMatch.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });
}

function isPlaintextCodeBlockClipboardPaste(event: ClipboardEvent) {
  const html = event.clipboardData?.getData("text/html") ?? "";

  if (!html.includes("data-language")) {
    return false;
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const codeBlocks = Array.from(document.querySelectorAll("[data-language]"));

  return codeBlocks.some(
    (codeBlock) =>
      codeBlock.getAttribute("data-language") === "plaintext" &&
      (codeBlock.hasAttribute("data-detected-type") ||
        codeBlock.hasAttribute("data-line-numbers") ||
        codeBlock.hasAttribute("data-word-wrap"))
  );
}

function dispatchNoteSaveStarted(noteId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("technote:note-save-start", { detail: { noteId } }));
}

function restoreScrollPosition(element: HTMLElement, scrollTop: number) {
  element.scrollTop = scrollTop;

  let frames = 0;
  function restoreNextFrame() {
    element.scrollTop = scrollTop;
    frames += 1;

    if (frames < 4) {
      window.requestAnimationFrame(restoreNextFrame);
    }
  }

  window.requestAnimationFrame(() => {
    restoreNextFrame();
  });

  window.setTimeout(() => {
    element.scrollTop = scrollTop;
  }, 120);
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
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-muted active:translate-y-px " +
        (active ? "bg-muted text-primary shadow-[inset_0_-2px_0_hsl(var(--primary))]" : "text-muted-foreground hover:text-foreground")
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

function sanitizeTextAlignment(value: unknown): TextAlignment | null {
  return value === "left" || value === "center" || value === "right" ? value : null;
}

function getActiveTextAlignment(state: EditorState): TextAlignment {
  const { selection } = state;

  if (selection instanceof NodeSelection && selection.node.type.name === "image") {
    const parentTarget = getSelectionParentTextAlignmentTarget(state);
    return sanitizeTextAlignment(parentTarget?.node.attrs.textAlign) ?? "left";
  }

  if (selection instanceof NodeSelection && textAlignmentNodeTypes.has(selection.node.type.name)) {
    return sanitizeTextAlignment(selection.node.attrs.textAlign) ?? "left";
  }

  const nearbyImage = getNearbyImageTextAlignmentTarget(state);

  if (nearbyImage) {
    return sanitizeTextAlignment(nearbyImage.node.attrs.textAlign) ?? "left";
  }

  const { $from } = selection;

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);

    if (textAlignmentNodeTypes.has(node.type.name)) {
      return sanitizeTextAlignment(node.attrs.textAlign) ?? "left";
    }
  }

  return "left";
}

function getSelectionParentTextAlignmentTarget(state: EditorState) {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);

    if (textAlignmentNodeTypes.has(node.type.name)) {
      return {
        node,
        position: depth === 0 ? 0 : $from.before(depth)
      };
    }
  }

  return null;
}

function getNearbyImageTextAlignmentTarget(state: EditorState) {
  const { $from } = state.selection;
  const nodeBefore = $from.nodeBefore;

  if (nodeBefore?.type.name === "image") {
    return getSelectionParentTextAlignmentTarget(state);
  }

  const nodeAfter = $from.nodeAfter;

  if (nodeAfter?.type.name === "image") {
    return getSelectionParentTextAlignmentTarget(state);
  }

  return null;
}

function toTiptapContent(document: EditorDocument): JSONContent {
  const normalizedDocument = addImageCaretAnchors(normalizeInlineImageDocument(document));

  return {
    type: "doc",
    content: normalizedDocument.content as JSONContent["content"]
  };
}

function serializeContent(content: JSONContent) {
  return JSON.stringify(toEditorDocument(content));
}

function toEditorDocument(content: JSONContent): EditorDocument {
  const document = stripImageCaretAnchors({
    ...content,
    type: "doc",
    schemaVersion: 1
  } as EditorDocument);

  return {
    ...document,
    schemaVersion: 1
  };
}

function normalizeInlineImageDocument(document: EditorDocument): EditorDocument {
  return {
    ...document,
    content: (document.content ?? []).map((node) =>
      node.type === "image"
        ? {
            type: "paragraph",
            content: [node]
          }
        : node
    )
  };
}

function addImageCaretAnchors(document: EditorDocument): EditorDocument {
  return {
    ...document,
    content: addImageCaretAnchorsToChildren(document.content ?? [])
  };
}

function addImageCaretAnchorsToChildren(children: EditorDocument["content"] = []): EditorContentChildren {
  return children.flatMap((node) => {
    if (node.type === "image") {
      return [createImageCaretAnchorNode(), node, createImageCaretAnchorNode()];
    }

    if ("content" in node && Array.isArray(node.content)) {
      return [
        {
          ...node,
          content: addImageCaretAnchorsToChildren(removeImageCaretAnchorNodes(node.content))
        }
      ];
    }

    return [node];
  });
}

function stripImageCaretAnchors(document: EditorDocument): EditorDocument {
  return {
    ...document,
    content: stripImageCaretAnchorsFromChildren(document.content ?? [])
  };
}

function stripImageCaretAnchorsFromChildren(children: EditorDocument["content"] = []): EditorContentChildren {
  return removeImageCaretAnchorNodes(children).map((node) => {
    if ("content" in node && Array.isArray(node.content)) {
      return {
        ...node,
        content: stripImageCaretAnchorsFromChildren(node.content)
      };
    }

    return node;
  });
}

function removeImageCaretAnchorNodes(children: NonNullable<EditorDocument["content"]>): EditorContentChildren {
  return children
    .map((node) => {
      if (node.type !== "text" || typeof node.text !== "string") {
        return node;
      }

      return {
        ...node,
        text: node.text.replaceAll(imageCaretAnchor, "")
      };
    })
    .filter((node) => node.type !== "text" || node.text);
}

function createImageCaretAnchorNode() {
  return {
    type: "text",
    text: imageCaretAnchor
  } as const;
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
  insertAtSelection,
  position
}: {
  files: File[];
  noteId: string;
  view: EditorView;
  insertAtSelection: boolean;
  position?: number;
}) {
  if (files.length === 0) {
    return;
  }

  if (isOffline()) {
    notify(notificationCopy.imageUploadOffline());
    return;
  }

  notify(notificationCopy.imageUploadStarted(files.length));

  let nextPosition = position;
  let successCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const result = await uploadImageFile(file, noteId);

    if (result.src) {
      successCount += 1;
      nextPosition = insertImageIntoEditor(view, {
        src: result.src,
        alt: result.alt ?? file.name,
        fileId: result.fileId,
        insertAtSelection,
        position: nextPosition
      });
    } else {
      failedCount += 1;
    }
  }

  notify(notificationCopy.imageUploadFinished(successCount, failedCount));
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
    const payload = (await response.json()) as { src?: string; alt?: string; fileId?: string };

    if (!response.ok || !payload.src) {
      return {};
    }

    return { src: payload.src, alt: payload.alt ?? file.name, fileId: payload.fileId };
  } catch {
    return {};
  }
}

function insertImageIntoEditor(
  view: EditorView,
  image: { src: string; alt: string; fileId?: string; insertAtSelection: boolean; position?: number }
) {
  const { state, dispatch } = view;
  const imageNode = state.schema.nodes.image?.create({
    src: image.src,
    alt: image.alt,
    title: "Add caption...",
    caption: "",
    width: 420,
    fileId: image.fileId
  });

  if (!imageNode) {
    return image.position;
  }
  const caretAnchorNode = state.schema.text(imageCaretAnchor);

  const { $from } = state.selection;
  const parent = $from.parent;
  const insertAfterCurrentBlock = $from.depth > 0 && (parent.type.name === "codeBlock" || parent.textContent.trim().length > 0);
  const rawPosition =
    typeof image.position === "number"
      ? image.position
      : image.insertAtSelection && insertAfterCurrentBlock
        ? $from.after($from.depth)
        : state.selection.to;
  const position = Math.max(0, Math.min(rawPosition, state.doc.content.size));

  try {
    return dispatchImageInsertion(view, imageNode, caretAnchorNode, position);
  } catch {
    try {
      return dispatchImageInsertion(view, imageNode, caretAnchorNode, view.state.doc.content.size);
    } catch {
      // Keep one failed insert from aborting the rest of a multi-image upload.
      return image.position;
    }
  }
}

function dispatchImageInsertion(
  view: EditorView,
  imageNode: ProseMirrorNode,
  caretAnchorNode: ProseMirrorNode,
  position: number
) {
  const { state, dispatch } = view;
  const safePosition = Math.max(0, Math.min(position, state.doc.content.size));
  const resolvedPosition = state.doc.resolve(safePosition);
  const canInsertInlineImage = resolvedPosition.parent.canReplaceWith(
    resolvedPosition.index(),
    resolvedPosition.index(),
    imageNode.type
  );

  if (!canInsertInlineImage) {
    const paragraphWithAnchor = state.schema.nodes.paragraph?.create(null, [
      caretAnchorNode,
      imageNode,
      state.schema.text(imageCaretAnchor)
    ]);

    if (!paragraphWithAnchor) {
      return safePosition;
    }

    const tr = state.tr.insert(safePosition, paragraphWithAnchor);
    const nextPosition = Math.min(safePosition + imageNode.nodeSize + caretAnchorNode.nodeSize + 1, tr.doc.content.size);
    dispatch(tr.setSelection(Selection.near(tr.doc.resolve(nextPosition))).scrollIntoView());
    return nextPosition;
  }

  const tr = state.tr.insert(safePosition, [caretAnchorNode, imageNode, state.schema.text(imageCaretAnchor)]);
  const nextPosition = Math.min(safePosition + imageNode.nodeSize + caretAnchorNode.nodeSize, tr.doc.content.size);

  dispatch(tr.setSelection(Selection.near(tr.doc.resolve(nextPosition))).scrollIntoView());
  return nextPosition;
}

function getDraggedImagePosition(dataTransfer: DataTransfer) {
  const rawPosition = dataTransfer.getData(internalImageDragType);

  if (!rawPosition) {
    return null;
  }

  const position = Number(rawPosition);
  return Number.isInteger(position) && position >= 0 ? position : null;
}

function moveImageInEditor(view: EditorView, sourcePosition: number, targetPosition: number | undefined) {
  const { state, dispatch } = view;
  const imageNode = state.doc.nodeAt(sourcePosition);

  if (!imageNode || imageNode.type.name !== "image") {
    return;
  }

  const sourceRange = getImageMoveDeleteRange(state, sourcePosition, imageNode);
  const rawTargetPosition = Math.max(0, Math.min(targetPosition ?? state.selection.to, state.doc.content.size));

  if (rawTargetPosition >= sourceRange.from && rawTargetPosition <= sourceRange.to) {
    return;
  }

  let transaction = state.tr.delete(sourceRange.from, sourceRange.to);
  const mappedTargetPosition = Math.max(
    0,
    Math.min(transaction.mapping.map(rawTargetPosition, -1), transaction.doc.content.size)
  );
  transaction = insertMovedImage(transaction, imageNode, mappedTargetPosition);

  dispatch(transaction.scrollIntoView());
  view.focus();
}

function getImageMoveDeleteRange(state: EditorState, imagePosition: number, imageNode: ProseMirrorNode) {
  let from = imagePosition;
  let to = imagePosition + imageNode.nodeSize;
  const beforeImage = state.doc.resolve(imagePosition).nodeBefore;
  const afterImage = state.doc.resolve(to).nodeAfter;

  if (beforeImage?.isText && beforeImage.text?.endsWith(imageCaretAnchor)) {
    from -= 1;
  }

  if (afterImage?.isText && afterImage.text?.startsWith(imageCaretAnchor)) {
    to += 1;
  }

  return {
    from: Math.max(0, from),
    to: Math.min(to, state.doc.content.size)
  };
}

function insertMovedImage(transaction: Transaction, imageNode: ProseMirrorNode, position: number) {
  const schema = transaction.doc.type.schema;
  const beforeAnchor = schema.text(imageCaretAnchor);
  const afterAnchor = schema.text(imageCaretAnchor);
  const safePosition = Math.max(0, Math.min(position, transaction.doc.content.size));
  const resolvedPosition = transaction.doc.resolve(safePosition);
  const canInsertInlineImage = resolvedPosition.parent.canReplaceWith(
    resolvedPosition.index(),
    resolvedPosition.index(),
    imageNode.type
  );

  if (!canInsertInlineImage) {
    const paragraph = schema.nodes.paragraph?.create(null, [beforeAnchor, imageNode, afterAnchor]);

    if (!paragraph) {
      return transaction;
    }

    const nextTransaction = transaction.insert(safePosition, paragraph);
    const nextPosition = Math.min(safePosition + beforeAnchor.nodeSize + imageNode.nodeSize + 1, nextTransaction.doc.content.size);
    return nextTransaction.setSelection(Selection.near(nextTransaction.doc.resolve(nextPosition)));
  }

  const fragment = Fragment.fromArray([beforeAnchor, imageNode, afterAnchor]);
  const nextTransaction = transaction.insert(safePosition, fragment);
  const nextPosition = Math.min(safePosition + beforeAnchor.nodeSize + imageNode.nodeSize, nextTransaction.doc.content.size);
  return nextTransaction.setSelection(Selection.near(nextTransaction.doc.resolve(nextPosition)));
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
      editor.commands.setContent(toTiptapContent(cachedNote.contentJson), { emitUpdate: false });
    }

    onContentLoaded(document, cachedNote.contentText, true);
    return;
  }

  const document = toEditorDocument(editor.getJSON());
  const text = editor.getText({ blockSeparator: "\n" });
  onContentLoaded(document, text, false);
  void cacheEditorContent({
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

  return putCachedNote(note)
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
