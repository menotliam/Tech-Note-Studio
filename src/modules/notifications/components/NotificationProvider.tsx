"use client";

import { Toaster } from "sonner";

export function NotificationProvider() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-panel-strong text-foreground shadow-2xl shadow-black/25",
          title: "text-sm font-semibold text-foreground",
          description: "text-xs text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-foreground",
          closeButton: "border-border bg-panel text-muted-foreground"
        }
      }}
    />
  );
}

