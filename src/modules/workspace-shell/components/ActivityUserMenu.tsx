"use client";

import { useState } from "react";
import { KeyRound, LogOut, User } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";

export function ActivityUserMenu({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const initial = userEmail.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-sm font-semibold text-foreground transition hover:border-primary"
        aria-label="Account menu"
        title={userEmail}
        onClick={() => setOpen((value) => !value)}
      >
        {initial}
      </button>

      {open ? (
        <div className="absolute bottom-0 left-12 z-50 w-56 rounded-md border border-border bg-panel-strong p-2 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 border-b border-border px-2 pb-2">
            <User size={15} className="text-primary" />
            <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
          </div>
          <button
            type="button"
            className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground opacity-70"
            title="Deferred to the account slice"
          >
            <KeyRound size={15} />
            Reset password
          </button>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <LogOut size={15} />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
