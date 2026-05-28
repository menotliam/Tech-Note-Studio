import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-border bg-background accent-primary transition",
        focusRingClasses,
        disabledControlClasses,
        className
      )}
      {...props}
    />
  );
});

