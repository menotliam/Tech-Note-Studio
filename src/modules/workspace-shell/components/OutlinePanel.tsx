"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ListTree } from "lucide-react";
import type { OutlineItem } from "../workspace-shell.types";

export function OutlinePanel({ items }: { items: OutlineItem[] }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const panelElement = panelRef.current;

      if (!panelElement) {
        return;
      }

      setPosition((currentPosition) =>
        clampPosition(
          panelElement.closest("[data-outline-drag-bounds]"),
          panelElement,
          currentPosition,
          currentPosition
        )
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [collapsed, items.length]);

  return (
    <aside
      data-outline-card
      ref={panelRef}
      className="w-56"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div className="overflow-hidden rounded-md border border-border bg-panel-strong/95 shadow-2xl shadow-black/25 backdrop-blur">
        <div
          className="flex h-9 cursor-move select-none items-center gap-2 border-b border-border bg-muted/35 px-3 text-xs font-semibold uppercase text-muted-foreground"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragOffset({
              x: event.clientX - position.x,
              y: event.clientY - position.y
            });
          }}
          onPointerMove={(event) => {
            if (!dragOffset) {
              return;
            }

            const nextPosition = {
              x: event.clientX - dragOffset.x,
              y: event.clientY - dragOffset.y
            };
            const boundsElement = event.currentTarget.closest("[data-outline-drag-bounds]");
            const panelElement = event.currentTarget.closest("[data-outline-card]");

            setPosition((currentPosition) =>
              clampPosition(
                boundsElement,
                panelElement,
                currentPosition,
                nextPosition
              )
            );
          }}
          onPointerUp={() => setDragOffset(null)}
          onPointerCancel={() => setDragOffset(null)}
        >
          <ListTree size={14} />
          <span className="min-w-0 flex-1">Outline</span>
          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {items.length}
          </span>
          <button
            type="button"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? "Expand outline" : "Collapse outline"}
            title={collapsed ? "Expand outline" : "Collapse outline"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
        {!collapsed ? (
          <div className="max-h-56 overflow-y-auto p-2">
            {items.length > 0 ? (
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-muted hover:text-foreground"
                    style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
                    title={item.text}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("technote:outline-jump", { detail: { text: item.text } }));
                    }}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">No headings yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function clampPosition(
  boundsElement: Element | null,
  panelElement: Element | null,
  currentPosition: { x: number; y: number },
  nextPosition: { x: number; y: number }
) {
  if (!boundsElement || !panelElement) {
    return nextPosition;
  }

  const boundsRect = boundsElement.getBoundingClientRect();
  const panelRect = panelElement.getBoundingClientRect();
  const baseLeft = panelRect.left - currentPosition.x;
  const baseTop = panelRect.top - currentPosition.y;
  const minX = boundsRect.left - baseLeft;
  const maxX = boundsRect.right - baseLeft - panelRect.width;
  const minY = boundsRect.top - baseTop;
  const maxY = boundsRect.bottom - baseTop - panelRect.height;

  return {
    x: clamp(nextPosition.x, minX, maxX),
    y: clamp(nextPosition.y, minY, maxY)
  };
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
