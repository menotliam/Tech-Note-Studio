import TiptapImage from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { GripVertical, ImagePlus } from "lucide-react";
import { useRef, useState, type DragEvent, type PointerEvent } from "react";

const internalImageDragType = "application/x-technote-image-position";

type ImageBlockOptions = {
  noteId: string;
  allowBase64: boolean;
  inline: boolean;
  HTMLAttributes: Record<string, unknown>;
};

export const ImageBlock = TiptapImage.extend<ImageBlockOptions>({
  draggable: false,

  addOptions() {
    return {
      ...this.parent?.(),
      allowBase64: false,
      noteId: "",
      inline: true,
      HTMLAttributes: {}
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: ""
      },
      width: {
        default: 420,
        parseHTML: (element) => Number(element.getAttribute("data-width")) || 420,
        renderHTML: (attrs) => ({ "data-width": attrs.width })
      },
      fileId: {
        default: null
      }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  }
});

function ImageBlockView({ node, updateAttributes, selected, extension, getPos }: NodeViewProps) {
  const attrs = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    caption?: string;
    width?: number | "small" | "medium" | "full";
  };
  const width = getPixelWidth(attrs.width);
  const noteId = (extension.options as ImageBlockOptions).noteId;
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [resizingCorner, setResizingCorner] = useState<ResizeCorner | null>(null);

  return (
    <NodeViewWrapper
      as="span"
      className="group relative !my-2 inline-flex max-w-full flex-col gap-2 align-bottom leading-none"
      style={{ width: `${width}px` }}
      data-image-block
      draggable={false}
    >
      <span
        ref={contentRef}
        className={
          "relative block w-full rounded-md bg-panel p-2 transition " +
          (selected ? " ring-2 ring-primary" : "")
        }
      >
        <img
          src={attrs.src}
          alt={attrs.alt ?? ""}
          draggable={false}
          className="block max-h-[70vh] w-full rounded object-contain"
        />
        <div className="absolute right-2 top-2 hidden flex-wrap items-center gap-1 rounded-md border border-border bg-background/95 p-1 shadow-xl backdrop-blur group-hover:flex">
          <button
            type="button"
            draggable
            className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            title="Move image"
            aria-label="Move image"
            onDragStart={(event) => {
              startImageDrag({
                event,
                getPos,
                dragPreview: contentRef.current
              });
            }}
          >
            <GripVertical size={14} />
          </button>
          <label className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Replace image">
            <ImagePlus size={14} />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";

                if (file && noteId) {
                  void replaceImage(file, noteId, updateAttributes);
                }
              }}
            />
          </label>
        </div>
        <input
          className="mt-2 w-full rounded border border-transparent bg-transparent px-2 py-1 text-center text-sm text-muted-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-border focus:border-primary"
          value={attrs.caption ?? ""}
          placeholder={attrs.title || "Add caption..."}
          onChange={(event) => updateAttributes({ caption: event.target.value })}
        />
      </span>
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((corner) => (
        <button
          key={corner}
          type="button"
          className={
            "absolute hidden h-3 w-3 rounded-full border border-background bg-primary shadow group-hover:block " +
            getResizeHandleClass(corner) +
            (resizingCorner === corner ? " block" : "")
          }
          onPointerDown={(event) => {
            startResize({
              event,
              corner,
              wrapper: contentRef.current,
              initialWidth: width,
              updateAttributes,
              setResizingCorner
            });
          }}
          aria-label="Resize image"
          title="Resize image"
        />
      ))}
    </NodeViewWrapper>
  );
}

type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

function getPixelWidth(width: number | string | undefined) {
  if (typeof width === "number" && Number.isFinite(width)) {
    return Math.round(Math.min(Math.max(width, 160), 960));
  }

  if (width === "small") {
    return 288;
  }

  if (width === "full") {
    return 960;
  }

  return 420;
}

function getResizeHandleClass(corner: ResizeCorner) {
  if (corner === "top-left") {
    return "-left-1.5 -top-1.5 cursor-nwse-resize";
  }

  if (corner === "top-right") {
    return "-right-1.5 -top-1.5 cursor-nesw-resize";
  }

  if (corner === "bottom-left") {
    return "-bottom-1.5 -left-1.5 cursor-nesw-resize";
  }

  return "-bottom-1.5 -right-1.5 cursor-nwse-resize";
}

function startResize({
  event,
  corner,
  wrapper,
  initialWidth,
  updateAttributes,
  setResizingCorner
}: {
  event: PointerEvent<HTMLButtonElement>;
  corner: ResizeCorner;
  wrapper: HTMLElement | null;
  initialWidth: number;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  setResizingCorner: (corner: ResizeCorner | null) => void;
}) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  setResizingCorner(corner);

  const startX = event.clientX;
  const editorWidth = wrapper?.closest(".ProseMirror")?.getBoundingClientRect().width ?? 960;
  const maxWidth = Math.max(160, Math.floor(editorWidth));
  const direction = corner.endsWith("left") ? -1 : 1;

  function handlePointerMove(moveEvent: globalThis.PointerEvent) {
    const deltaX = (moveEvent.clientX - startX) * direction;
    const nextWidth = Math.round(Math.min(Math.max(initialWidth + deltaX, 160), maxWidth));
    updateAttributes({ width: nextWidth });
  }

  function handlePointerUp() {
    setResizingCorner(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp, { once: true });
}

function startImageDrag({
  event,
  getPos,
  dragPreview
}: {
  event: DragEvent<HTMLButtonElement>;
  getPos: NodeViewProps["getPos"];
  dragPreview: HTMLElement | null;
}) {
  const position = typeof getPos === "function" ? getPos() : null;

  if (typeof position !== "number") {
    event.preventDefault();
    return;
  }

  event.stopPropagation();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(internalImageDragType, String(position));

  if (dragPreview) {
    event.dataTransfer.setDragImage(dragPreview, Math.min(dragPreview.clientWidth / 2, 120), 24);
  }
}

async function replaceImage(
  file: File,
  noteId: string,
  updateAttributes: (attrs: Record<string, unknown>) => void
) {
  const formData = new FormData();
  formData.set("noteId", noteId);
  formData.set("file", file);
  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: formData
  });
  const payload = (await response.json()) as { src?: string; alt?: string };

  if (response.ok && payload.src) {
    updateAttributes({
      src: payload.src,
      alt: payload.alt ?? file.name
    });
  }
}
