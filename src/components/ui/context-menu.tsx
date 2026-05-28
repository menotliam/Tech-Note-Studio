import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function ContextMenuContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("fixed z-50 min-w-48 rounded-md border border-border bg-panel-strong p-1 text-sm shadow-2xl", className)}
      {...props}
    />
  );
}

export function ContextMenuItem({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md px-2 py-1.5 text-sm hover:bg-muted", className)} {...props} />;
}

