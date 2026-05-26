"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function EditorHeaderMenu({
  summary,
  children,
  ariaLabel
}: {
  summary: ReactNode;
  children: ReactNode;
  ariaLabel: string;
}) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      const menu = menuRef.current;

      if (!menu?.open || menu.contains(event.target as Node)) {
        return;
      }

      menu.open = false;
    }

    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;

      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
      }
    }

    document.addEventListener("pointerdown", closeMenu, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details ref={menuRef} className="relative">
      <summary aria-label={ariaLabel} className="list-none [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      {children}
    </details>
  );
}
