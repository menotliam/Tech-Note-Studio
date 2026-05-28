import { forwardRef, type ButtonHTMLAttributes } from "react";
import { defineVariants, disabledControlClasses, focusRingClasses } from "@/modules/ui/ui.variants";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const buttonClasses = defineVariants({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition",
    "active:translate-y-px",
    focusRingClasses,
    disabledControlClasses
  ].join(" "),
  variants: {
    variant: {
      primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      secondary: "border border-border bg-muted text-foreground hover:bg-muted/80",
      ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
      outline: "border border-border bg-transparent text-foreground hover:bg-muted",
      destructive: "bg-red-500 text-white hover:bg-red-500/90"
    },
    size: {
      sm: "h-8 px-2.5 text-xs",
      md: "h-9 px-3",
      lg: "h-10 px-4"
    }
  },
  defaults: {
    variant: "secondary",
    size: "md"
  }
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />;
});

