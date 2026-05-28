import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        "h-5 w-9 cursor-pointer appearance-none rounded-full border border-border bg-muted transition",
        "before:block before:h-4 before:w-4 before:translate-x-0 before:rounded-full before:bg-muted-foreground before:transition before:content-['']",
        "checked:border-primary checked:bg-primary/25 checked:before:translate-x-4 checked:before:bg-primary",
        focusRingClasses,
        disabledControlClasses,
        className
      )}
      {...props}
    />
  );
});
