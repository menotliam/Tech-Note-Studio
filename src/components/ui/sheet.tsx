import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SheetProps = HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  children: ReactNode;
};

export function Sheet({ open = true, className, children, ...props }: SheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={cn("fixed inset-0 z-[100] flex justify-end bg-black/45", className)} {...props}>
      {children}
    </div>
  );
}

export function SheetContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-full w-full max-w-md border-l border-border bg-panel-strong p-4 shadow-2xl", className)} {...props} />;
}

