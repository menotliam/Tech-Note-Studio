import { AlertTriangle } from "lucide-react";
import { type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title: string;
  description: string;
  action?: ButtonProps & { label: string };
  icon?: ReactNode;
  className?: string;
};

export function ErrorState({ title, description, action, icon, className }: ErrorStateProps) {
  return (
    <div className={cn("rounded-md border border-red-500/30 bg-red-500/5 px-5 py-4", className)}>
      <div className="flex gap-3">
        <div className="mt-0.5 text-red-400">{icon ?? <AlertTriangle size={18} />}</div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-red-100">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          {action ? <ErrorStateAction action={action} /> : null}
        </div>
      </div>
    </div>
  );
}

function ErrorStateAction({ action }: { action: ButtonProps & { label: string } }) {
  const { label, ...actionProps } = action;

  return (
    <Button className="mt-3" variant="outline" size="sm" {...actionProps}>
      {label}
    </Button>
  );
}
