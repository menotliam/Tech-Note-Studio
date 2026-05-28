import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="range"
      className={cn(
        "h-5 w-full cursor-pointer accent-primary",
        focusRingClasses,
        disabledControlClasses,
        className
      )}
      {...props}
    />
  );
});

