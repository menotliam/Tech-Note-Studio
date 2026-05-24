"use client";

import { useEffect, useState } from "react";

export function NoteSaveStatus({
  noteId,
  className = ""
}: {
  noteId: string;
  className?: string;
}) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(false);

    function handleDirty(event: Event) {
      const detail = (event as CustomEvent<{ noteId: string; dirty: boolean }>).detail;

      if (detail?.noteId === noteId) {
        setDirty(detail.dirty);
      }
    }

    window.addEventListener("technote:note-dirty", handleDirty);
    return () => window.removeEventListener("technote:note-dirty", handleDirty);
  }, [noteId]);

  return (
    <span className={className} data-save-status={dirty ? "unsaved" : "saved"}>
      {dirty ? "Unsaved" : "Saved"}
    </span>
  );
}
