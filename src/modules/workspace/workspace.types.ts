import type { AccentPreset, DashboardDefaultView, GradientPreset } from "@/modules/preferences/preferences.types";
import type { workspaceIconValues } from "./workspace.schemas";

export type WorkspaceIcon = (typeof workspaceIconValues)[number];

export type WorkspaceSummary = {
  id: string;
  name: string;
  icon: WorkspaceIcon | null;
  accent: AccentPreset | null;
  cover: GradientPreset | null;
  defaultLayout: DashboardDefaultView;
};
