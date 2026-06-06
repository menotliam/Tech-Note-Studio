import {
  Archive,
  FileSearch,
  FileText,
  FolderOpen,
  Layers3,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StateVisualKind =
  | "archive"
  | "editor"
  | "explorer"
  | "export"
  | "search"
  | "security"
  | "tag"
  | "template"
  | "trash";

const stateVisualIcons = {
  archive: Archive,
  editor: FileText,
  explorer: FolderOpen,
  export: Layers3,
  search: Search,
  security: ShieldCheck,
  tag: Tags,
  template: FileSearch,
  trash: Trash2
} satisfies Record<StateVisualKind, LucideIcon>;

export function StateVisual({ kind, className }: { kind: StateVisualKind; className?: string }) {
  const Icon = stateVisualIcons[kind];

  return (
    <div
      className={cn(
        "relative grid h-14 w-14 place-items-center rounded-md border border-border bg-surface shadow-sm",
        className
      )}
      aria-hidden="true"
    >
      <Icon size={24} className="relative z-10 text-muted-foreground" />
    </div>
  );
}
