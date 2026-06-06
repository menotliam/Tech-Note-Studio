"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { KeyRound, LogOut, User } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";

const menuWidth = 224;
const viewportPadding = 12;

export function ActivityUserMenu({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const initial = userEmail.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const narrowLayout = window.innerWidth < 1024;

      if (narrowLayout) {
        setMenuStyle({
          position: "fixed",
          right: Math.max(viewportPadding, window.innerWidth - rect.right),
          top: Math.min(rect.bottom + 8, window.innerHeight - viewportPadding),
          width: menuWidth
        });
        return;
      }

      setMenuStyle({
        position: "fixed",
        left: Math.min(rect.right + 8, window.innerWidth - menuWidth - viewportPadding),
        bottom: Math.max(viewportPadding, window.innerHeight - rect.bottom),
        width: menuWidth
      });
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-sm font-semibold text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:border-primary"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        title={userEmail}
        onClick={() => setOpen((value) => !value)}
      >
        {initial}
      </button>

      {open ? (
        <div
          className="z-[90] rounded-md border border-border bg-panel-strong p-2 shadow-2xl"
          role="menu"
          style={menuStyle}
        >
          <div className="mb-2 flex items-center gap-2 border-b border-border px-2 pb-2">
            <User size={15} className="text-primary" />
            <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
          </div>
          <button
            type="button"
            className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground opacity-70"
            role="menuitem"
            title="Deferred to the account slice"
          >
            <KeyRound size={15} />
            Reset password
          </button>
          <form action={logoutAction}>
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-muted hover:text-foreground"
              role="menuitem"
            >
              <LogOut size={15} />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
