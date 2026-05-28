import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DialogProps = HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  children: ReactNode;
};

export function Dialog({ open = true, className, children, ...props }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="dialog" className={cn("w-full max-w-md rounded-md border border-border bg-panel-strong p-4 shadow-2xl", className)} {...props} />;
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-5 text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex flex-wrap justify-end gap-2", className)} {...props} />;
}

