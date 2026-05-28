import { forwardRef, type ButtonHTMLAttributes } from "react";
import { defineVariants, disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type IconButtonVariant = "ghost" | "outline" | "primary" | "destructive";
export type IconButtonSize = "sm" | "md" | "lg";

const iconButtonClasses = defineVariants({
  base: [
    "inline-flex shrink-0 items-center justify-center rounded-md transition active:translate-y-px",
    focusRingClasses,
    disabledControlClasses
  ].join(" "),
  variants: {
    variant: {
      ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
      outline: "border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "text-red-400 hover:bg-red-500/10 hover:text-red-300"
    },
    size: {
      sm: "h-7 w-7",
      md: "h-8 w-8",
      lg: "h-9 w-9"
    }
  },
  defaults: {
    variant: "ghost",
    size: "md"
  }
});

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={iconButtonClasses({ variant, size, className })} {...props} />;
});

