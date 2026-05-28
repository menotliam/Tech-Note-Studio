import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TooltipProps = HTMLAttributes<HTMLSpanElement> & {
  label: string;
  children: ReactNode;
};

export function Tooltip({ label, children, className, ...props }: TooltipProps) {
  return (
    <span className={cn("inline-flex", className)} title={label} {...props}>
      {children}
    </span>
  );
}

