import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground",
        focusRingClasses,
        disabledControlClasses,
        className
      )}
      {...props}
    />
  );
});

