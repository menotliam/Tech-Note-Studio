import { type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { focusRingClasses } from "@/modules/ui/ui.variants";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-3", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-md border border-border bg-muted p-0.5", className)} {...props} />;
}

export type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function TabsTrigger({ active, className, type = "button", ...props }: TabsTriggerProps) {
  return (
    <button
      type={type}
      data-active={active ? "true" : undefined}
      className={cn(
        "rounded px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm",
        focusRingClasses,
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

