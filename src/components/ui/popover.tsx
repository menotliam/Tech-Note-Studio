import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Popover({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative inline-block", className)} {...props} />;
}

export function PopoverContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("absolute right-0 z-50 mt-1 min-w-56 rounded-md border border-border bg-panel-strong p-3 shadow-2xl", className)}
      {...props}
    />
  );
}

