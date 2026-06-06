import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StateVisual, type StateVisualKind } from "../state-visuals";

export type RichEmptyStateProps = {
  kind: StateVisualKind;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function RichEmptyState({
  kind,
  title,
  description,
  action,
  compact = false,
  className
}: RichEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-panel/55 text-center",
        compact ? "min-h-32 px-4 py-5" : "min-h-48 px-6 py-8",
        className
      )}
    >
      <StateVisual kind={kind} className={compact ? "h-11 w-11" : undefined} />
      <h3 className={cn("font-semibold text-foreground", compact ? "mt-3 text-xs" : "mt-4 text-sm")}>
        {title}
      </h3>
      <p className={cn("mt-1 max-w-sm leading-5 text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
