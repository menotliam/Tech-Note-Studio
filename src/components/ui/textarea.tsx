import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground",
        focusRingClasses,
        disabledControlClasses,
        className
      )}
      {...props}
    />
  );
});

