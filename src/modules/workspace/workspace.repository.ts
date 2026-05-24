import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accentPresetValues,
  dashboardDefaultViewValues,
  defaultUserPreferences,
  gradientPresetValues
} from "@/modules/preferences/preferences.defaults";
import type { AccentPreset, DashboardDefaultView, GradientPreset } from "@/modules/preferences/preferences.types";
import { workspaceIconValues } from "./workspace.schemas";
import type { WorkspaceIcon, WorkspaceSummary } from "./workspace.types";

type WorkspaceRow = {
  id: string;
  name: string;
  icon: string | null;
  accent: string | null;
  cover: string | null;
  default_layout: string | null;
};

export async function getWorkspaceSummary(
  supabase: SupabaseClient,
  ownerId: string,
  workspaceId: string
): Promise<WorkspaceSummary> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, icon, accent, cover, default_layout")
    .eq("owner_id", ownerId)
    .eq("id", workspaceId)
    .single();

  if (error) {
    throw error;
  }

  return toWorkspaceSummary(data as WorkspaceRow);
}

function toWorkspaceSummary(row: WorkspaceRow): WorkspaceSummary {
  return {
    id: row.id,
    name: row.name,
    icon: parseWorkspaceIcon(row.icon),
    accent: parseAccent(row.accent),
    cover: parseCover(row.cover),
    defaultLayout: parseDefaultLayout(row.default_layout)
  };
}

function parseWorkspaceIcon(value: string | null): WorkspaceIcon | null {
  return workspaceIconValues.includes(value as WorkspaceIcon) ? (value as WorkspaceIcon) : null;
}

function parseAccent(value: string | null): AccentPreset | null {
  return accentPresetValues.includes(value as AccentPreset) ? (value as AccentPreset) : null;
}

function parseCover(value: string | null): GradientPreset | null {
  return gradientPresetValues.includes(value as GradientPreset) ? (value as GradientPreset) : null;
}

function parseDefaultLayout(value: string | null): DashboardDefaultView {
  return dashboardDefaultViewValues.includes(value as DashboardDefaultView)
    ? (value as DashboardDefaultView)
    : defaultUserPreferences.dashboard.defaultView;
}
