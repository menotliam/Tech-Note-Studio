import { type DetailsHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DropdownMenu({ className, ...props }: DetailsHTMLAttributes<HTMLDetailsElement>) {
  return <details className={cn("relative inline-block", className)} {...props} />;
}

export function DropdownMenuTrigger({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <summary className={cn("list-none [&::-webkit-details-marker]:hidden", className)} {...props} />;
}

export function DropdownMenuContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("absolute right-0 z-50 mt-1 min-w-44 rounded-md border border-border bg-panel-strong p-1 shadow-2xl", className)}
      {...props}
    />
  );
}

