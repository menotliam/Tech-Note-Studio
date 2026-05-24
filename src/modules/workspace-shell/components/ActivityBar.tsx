"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  FolderTree,
  Maximize2,
  Minimize2,
  Search,
  Settings,
  Tags,
  Upload
} from "lucide-react";
import { ThemeQuickSwitch } from "@/modules/preferences/components/ThemeQuickSwitch";
import type { UserPreferences } from "@/modules/preferences/preferences.types";
import { getAccentPresetDefinition, getGradientPresetDefinition } from "@/modules/preferences/preferences.ui";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { ActivityUserMenu } from "./ActivityUserMenu";
import type { WorkspaceActivity } from "../workspace-shell.types";

const activities: Array<{
  id: WorkspaceActivity;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: "explorer", label: "Notes Explorer", icon: FolderTree },
  { id: "search", label: "Search", icon: Search },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "tags", label: "Tags", icon: Tags },
  { id: "export", label: "Export Cart", icon: Upload },
  { id: "settings", label: "Settings", icon: Settings }
];

export function ActivityBar({
  preferences,
  workspace,
  userEmail,
  initialActivity = "explorer"
}: {
  preferences: UserPreferences;
  workspace: WorkspaceSummary;
  userEmail: string;
  initialActivity?: WorkspaceActivity;
}) {
  const [activeActivity, setActiveActivity] = useState<WorkspaceActivity>(initialActivity);
  const [focusMode, setFocusMode] = useState(preferences.dashboard.focusModeEnabled);
  const workspaceAccent = workspace.accent ? getAccentPresetDefinition(workspace.accent) : null;
  const workspaceCover = workspace.cover ? getGradientPresetDefinition(workspace.cover) : null;

  function setWorkspaceAttribute(name: string, value: string) {
    document.querySelector("[data-ide-shell]")?.setAttribute(name, value);
  }

  function updateActivity(activity: WorkspaceActivity) {
    setActiveActivity(activity);
    setWorkspaceAttribute("data-active-activity", activity);
    setWorkspaceAttribute("data-explorer-collapsed", "false");
  }

  function updateFocusMode(nextFocusMode: boolean) {
    setFocusMode(nextFocusMode);
    setWorkspaceAttribute("data-focus-mode", String(nextFocusMode));
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboard: { focusModeEnabled: nextFocusMode } })
    });
  }

  return (
    <div className="flex h-full w-14 flex-col items-center border-r border-border bg-panel-strong py-3">
      <div
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[image:var(--accent-gradient)] text-xs font-bold text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.25)]"
        style={{
          background: workspaceCover?.value,
          borderColor: workspaceAccent ? `hsl(${workspaceAccent.primary})` : undefined
        }}
        title={workspace.name}
      >
        {getWorkspaceIconLabel(workspace)}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const active = activeActivity === activity.id;

          if (activity.id === "settings") {
            return (
              <Link
                key={activity.id}
                href="/settings"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={activity.label}
                title={activity.label}
              >
                <Icon size={19} />
              </Link>
            );
          }

          return (
            <button
              key={activity.id}
              type="button"
              className={
                "relative inline-flex h-10 w-10 items-center justify-center rounded-md transition " +
                (active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
              aria-label={activity.label}
              title={activity.label}
              onClick={() => updateActivity(activity.id)}
            >
              {active ? (
                <motion.span
                  layoutId="activity-active"
                  className="absolute inset-0 rounded-md bg-muted shadow-[inset_3px_0_0_hsl(var(--primary))]"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
              <Icon size={19} className="relative" />
            </button>
          );
        })}
        <button
          type="button"
          className={
            "inline-flex h-10 w-10 items-center justify-center rounded-md transition " +
            (focusMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")
          }
          aria-label="Toggle focus mode"
          title="Focus mode"
          onClick={() => updateFocusMode(!focusMode)}
        >
          {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <ThemeQuickSwitch initialTheme={preferences.appearance.theme} />
        <ActivityUserMenu userEmail={userEmail} />
      </div>
    </div>
  );
}

function getWorkspaceIconLabel(workspace: WorkspaceSummary) {
  if (workspace.icon) {
    return workspace.icon.charAt(0).toUpperCase();
  }

  return workspace.name.trim().charAt(0).toUpperCase() || "W";
}
