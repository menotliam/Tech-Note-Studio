"use client";

export function CloseNoteTabButton({ noteId }: { noteId: string }) {
  return (
    <button
      type="button"
      className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
      onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
        window.dispatchEvent(new CustomEvent("technote:close-tab", { detail: { noteId } }));
      }}
    >
      Close
    </button>
  );
}
