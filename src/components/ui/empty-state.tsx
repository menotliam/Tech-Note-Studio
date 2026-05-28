import { type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ButtonProps & { label: string };
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-8 text-center", className)}>
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p>
      {action ? <EmptyStateAction action={action} /> : null}
    </div>
  );
}

function EmptyStateAction({ action }: { action: ButtonProps & { label: string } }) {
  const { label, ...actionProps } = action;

  return (
    <Button className="mt-4" variant="primary" {...actionProps}>
      {label}
    </Button>
  );
}
