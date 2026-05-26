"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Keyboard, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { defaultEditorKeybindings } from "@/modules/keybindings/keybindings.defaults";
import { isSafeShortcut, normalizeKeyboardEvent } from "@/modules/keybindings/keybindings.normalize";
import { normalizeKeybindingPreferences, validateKeybindingPreferences } from "@/modules/keybindings/keybindings.schemas";
import { keybindingCommands } from "@/modules/keybindings/keybindings.registry";
import type { KeybindingPreferences } from "@/modules/keybindings/keybindings.types";
import {
  codeThemeValues,
  dashboardDefaultViewValues,
  editorFontFamilyValues,
  editorFontSizeValues,
  editorLineHeightValues,
  editorWidthValues
} from "@/modules/preferences/preferences.defaults";
import type { UserPreferences, UserPreferencesPatch } from "@/modules/preferences/preferences.types";
import {
  accentPresetDefinitions,
  getPreferenceStyle,
  gradientPresetDefinitions
} from "@/modules/preferences/preferences.ui";
import { syncThemePreference } from "@/modules/preferences/preferences.theme";
import { updateWorkspacePersonalizationAction } from "@/modules/workspace/workspace.actions";
import { workspaceIconValues } from "@/modules/workspace/workspace.schemas";
import type { WorkspaceSummary } from "@/modules/workspace/workspace.types";
import { PreferenceThemeApplier } from "./PreferenceThemeApplier";

type SettingsSection = "appearance" | "workspace" | "editor" | "keybindings" | "export" | "account" | "security" | "storage";
type SaveStatusValue = "idle" | "saving" | "saved" | "error";

const sections: Array<{ id: SettingsSection; label: string }> = [
  { id: "appearance", label: "Appearance" },
  { id: "workspace", label: "Workspace" },
  { id: "editor", label: "Editor" },
  { id: "keybindings", label: "Keybindings" },
  { id: "export", label: "Export" },
  { id: "account", label: "Account" },
  { id: "security", label: "Security/Activity" },
  { id: "storage", label: "Storage/Uploads" }
];

export function SettingsShell({
  initialPreferences,
  workspace,
  userEmail
}: {
  initialPreferences: UserPreferences;
  workspace: WorkspaceSummary;
  userEmail: string;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceSummary>(workspace);
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const [status, setStatus] = useState<SaveStatusValue>("idle");
  const style = useMemo(() => getPreferenceStyle(preferences), [preferences]);

  async function updatePreferences(patch: UserPreferencesPatch) {
    const nextPreferences = {
      ...preferences,
      appearance: { ...preferences.appearance, ...(patch.appearance ?? {}) },
      dashboard: { ...preferences.dashboard, ...(patch.dashboard ?? {}) },
      editor: { ...preferences.editor, ...(patch.editor ?? {}) },
      export: { ...preferences.export, ...(patch.export ?? {}) }
    };

    setPreferences(nextPreferences);
    if (patch.appearance?.theme) {
      syncThemePreference(patch.appearance.theme);
    }
    setStatus("saving");

    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = (await response.json()) as { preferences?: UserPreferences };

      if (!response.ok || !payload.preferences) {
        throw new Error("Could not save preferences.");
      }

      setPreferences(payload.preferences);
      setStatus("saved");
    } catch {
      setPreferences(preferences);
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground" style={style}>
      <PreferenceThemeApplier preferences={preferences} />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-panel p-4 lg:border-b-0 lg:border-r">
          <Link
            href="/"
            className="mb-5 inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="mb-6">
            <div className="h-10 w-10 rounded-md border border-border bg-[image:var(--accent-gradient)]" />
            <h1 className="mt-3 text-lg font-semibold">Settings</h1>
            <p className="truncate text-sm text-muted-foreground">{userEmail}</p>
          </div>

          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={
                  "flex w-full rounded-md px-3 py-2 text-left text-sm transition " +
                  (activeSection === section.id
                    ? "bg-muted font-medium text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 px-4 py-6 md:px-8 md:py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <h2 className="text-2xl font-semibold">{getSectionTitle(activeSection)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{getSectionSubtitle(activeSection)}</p>
            </div>
            <SaveStatus status={status} />
          </div>

          {activeSection === "appearance" ? (
            <AppearanceSettings preferences={preferences} updatePreferences={updatePreferences} />
          ) : null}
          {activeSection === "workspace" ? (
            <WorkspaceSettings workspace={workspaceDraft} setWorkspace={setWorkspaceDraft} setStatus={setStatus} />
          ) : null}
          {activeSection === "editor" ? (
            <EditorSettings preferences={preferences} updatePreferences={updatePreferences} />
          ) : null}
          {activeSection === "keybindings" ? (
            <KeybindingsSettings preferences={preferences} updatePreferences={updatePreferences} />
          ) : null}
          {activeSection === "export" ? (
            <ExportSettings preferences={preferences} updatePreferences={updatePreferences} />
          ) : null}
          {activeSection === "account" ? <ShallowPanel title="Signed in as" value={userEmail} /> : null}
          {activeSection === "security" ? (
            <ShallowPanel title="Security events" value="Security logging is active for protected workflows." />
          ) : null}
          {activeSection === "storage" ? (
            <ShallowPanel title="Upload limits" value="PNG, JPEG, and WebP images up to 10 MB." />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function WorkspaceSettings({
  workspace,
  setWorkspace,
  setStatus
}: {
  workspace: WorkspaceSummary;
  setWorkspace: (workspace: WorkspaceSummary) => void;
  setStatus: (status: SaveStatusValue) => void;
}) {
  function updateWorkspaceField<K extends keyof WorkspaceSummary>(key: K, value: WorkspaceSummary[K]) {
    setWorkspace({
      ...workspace,
      [key]: value
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const previousWorkspace = workspace;
    const nextWorkspace = getWorkspaceFromFormData(workspace, formData);

    setWorkspace(nextWorkspace);
    setStatus("saving");

    try {
      const savedWorkspace = await updateWorkspacePersonalizationAction(formData);
      setWorkspace(savedWorkspace);
      setStatus("saved");
    } catch {
      setWorkspace(previousWorkspace);
      setStatus("error");
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <SettingsPanel title="Identity">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-medium">Name</span>
            <input
              name="name"
              className="h-10 rounded-md border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
              value={workspace.name}
              maxLength={80}
              required
              onChange={(event) => updateWorkspaceField("name", event.target.value)}
            />
          </label>
          <FormSelectField
            label="Icon"
            name="icon"
            value={workspace.icon ?? ""}
            values={["", ...workspaceIconValues]}
            onChange={(value) =>
              updateWorkspaceField("icon", parseOptionalWorkspaceValue<NonNullable<WorkspaceSummary["icon"]>>(value))
            }
          />
          <FormSelectField
            label="Default layout"
            name="defaultLayout"
            value={workspace.defaultLayout}
            values={dashboardDefaultViewValues}
            onChange={(value) => updateWorkspaceField("defaultLayout", value as WorkspaceSummary["defaultLayout"])}
          />
        </div>
      </SettingsPanel>

      <SettingsPanel title="Workspace accent">
        <div className="grid gap-3 md:grid-cols-2">
          <FormSelectField
            label="Accent"
            name="accent"
            value={workspace.accent ?? ""}
            values={["", ...accentPresetDefinitions.map((preset) => preset.id)]}
            onChange={(value) =>
              updateWorkspaceField("accent", parseOptionalWorkspaceValue<NonNullable<WorkspaceSummary["accent"]>>(value))
            }
          />
          <FormSelectField
            label="Cover"
            name="cover"
            value={workspace.cover ?? ""}
            values={["", ...gradientPresetDefinitions.map((preset) => preset.id)]}
            onChange={(value) =>
              updateWorkspaceField("cover", parseOptionalWorkspaceValue<NonNullable<WorkspaceSummary["cover"]>>(value))
            }
          />
        </div>
      </SettingsPanel>

      <div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Save Workspace
        </button>
      </div>
    </form>
  );
}

function AppearanceSettings({
  preferences,
  updatePreferences
}: {
  preferences: UserPreferences;
  updatePreferences: (patch: UserPreferencesPatch) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <SettingsPanel title="Theme">
        <div className="grid grid-cols-3 gap-2">
          <ThemeButton
            label="System"
            icon={<Monitor size={16} />}
            active={preferences.appearance.theme === "system"}
            onClick={() => updatePreferences({ appearance: { theme: "system" } })}
          />
          <ThemeButton
            label="Dark"
            icon={<Moon size={16} />}
            active={preferences.appearance.theme === "dark"}
            onClick={() => updatePreferences({ appearance: { theme: "dark" } })}
          />
          <ThemeButton
            label="Light"
            icon={<Sun size={16} />}
            active={preferences.appearance.theme === "light"}
            onClick={() => updatePreferences({ appearance: { theme: "light" } })}
          />
        </div>
      </SettingsPanel>

      <SettingsPanel title="Accent">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {accentPresetDefinitions.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={
                "flex h-12 items-center gap-3 rounded-md border px-3 text-sm transition " +
                (preferences.appearance.accentPreset === preset.id
                  ? "border-primary bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground")
              }
              onClick={() => updatePreferences({ appearance: { accentPreset: preset.id } })}
            >
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: `hsl(${preset.primary})` }} />
              {preset.label}
            </button>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Gradient">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {gradientPresetDefinitions.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={
                "h-14 rounded-md border text-sm transition " +
                (preferences.appearance.gradientPreset === preset.id ? "border-primary" : "border-border")
              }
              style={{ background: preset.value }}
              aria-label={preset.label}
              title={preset.label}
              onClick={() => updatePreferences({ appearance: { gradientPreset: preset.id } })}
            />
          ))}
        </div>
      </SettingsPanel>
    </div>
  );
}

function EditorSettings({
  preferences,
  updatePreferences
}: {
  preferences: UserPreferences;
  updatePreferences: (patch: UserPreferencesPatch) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <SettingsPanel title="Layout">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Width"
            value={preferences.editor.width}
            values={editorWidthValues}
            onChange={(value) => updatePreferences({ editor: { width: value } })}
          />
          <SelectField
            label="Line height"
            value={preferences.editor.lineHeight}
            values={editorLineHeightValues}
            onChange={(value) => updatePreferences({ editor: { lineHeight: value } })}
          />
        </div>
      </SettingsPanel>

      <SettingsPanel title="Typography">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Font size"
            value={preferences.editor.fontSize}
            values={editorFontSizeValues}
            onChange={(value) => updatePreferences({ editor: { fontSize: value } })}
          />
          <SelectField
            label="Font family"
            value={preferences.editor.fontFamily}
            values={editorFontFamilyValues}
            onChange={(value) => updatePreferences({ editor: { fontFamily: value } })}
          />
        </div>
      </SettingsPanel>

      <SettingsPanel title="Code and input">
        <div className="grid gap-3">
          <SelectField
            label="Code theme"
            value={preferences.editor.codeTheme}
            values={codeThemeValues}
            onChange={(value) => updatePreferences({ editor: { codeTheme: value } })}
          />
          <ToggleField
            label="Line numbers"
            checked={preferences.editor.defaultLineNumbers}
            onChange={(checked) => updatePreferences({ editor: { defaultLineNumbers: checked } })}
          />
          <ToggleField
            label="Word wrap"
            checked={preferences.editor.defaultWordWrap}
            onChange={(checked) => updatePreferences({ editor: { defaultWordWrap: checked } })}
          />
          <ToggleField
            label="Auto-detection"
            checked={preferences.editor.autoDetectionEnabled}
            onChange={(checked) => updatePreferences({ editor: { autoDetectionEnabled: checked } })}
          />
          <ToggleField
            label="Markdown shortcuts"
            checked={preferences.editor.markdownShortcutsEnabled}
            onChange={(checked) => updatePreferences({ editor: { markdownShortcutsEnabled: checked } })}
          />
          <ToggleField
            label="Clipboard image paste"
            checked={preferences.editor.clipboardImagePasteEnabled}
            onChange={(checked) => updatePreferences({ editor: { clipboardImagePasteEnabled: checked } })}
          />
          <ToggleField
            label="Focus mode"
            checked={preferences.dashboard.focusModeEnabled}
            onChange={(checked) => updatePreferences({ dashboard: { focusModeEnabled: checked } })}
          />
        </div>
      </SettingsPanel>
    </div>
  );
}

function KeybindingsSettings({
  preferences,
  updatePreferences
}: {
  preferences: UserPreferences;
  updatePreferences: (patch: UserPreferencesPatch) => Promise<void>;
}) {
  const [draft, setDraft] = useState<KeybindingPreferences>(preferences.editor.keybindings);
  const [error, setError] = useState<string | null>(null);
  const [capturingCommandId, setCapturingCommandId] = useState<keyof KeybindingPreferences | null>(null);

  useEffect(() => {
    setDraft(preferences.editor.keybindings);
  }, [preferences.editor.keybindings]);

  function updateShortcut(commandId: keyof KeybindingPreferences, value: string) {
    setDraft({
      ...draft,
      [commandId]: value
    });
    setError(null);
  }

  function captureShortcut(commandId: keyof KeybindingPreferences, event: KeyboardEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setCapturingCommandId(null);
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      updateShortcut(commandId, "");
      setCapturingCommandId(null);
      return;
    }

    const shortcut = normalizeKeyboardEvent(event.nativeEvent);

    if (!shortcut) {
      return;
    }

    if (shortcut.split("+").length > 3) {
      setError("Use at most 3 keys in a shortcut.");
      return;
    }

    if (!isSafeShortcut(shortcut)) {
      setError(`${shortcut} is reserved by the browser. Choose another shortcut.`);
      return;
    }

    updateShortcut(commandId, shortcut);
    setCapturingCommandId(null);
  }

  async function saveKeybindings() {
    try {
      const normalizedDraft = normalizeKeybindingPreferences(draft);
      const validation = validateKeybindingPreferences(normalizedDraft);

      if (!validation.ok) {
        setError(validation.message);
        return;
      }

      setDraft(normalizedDraft);
      setError(null);
      await updatePreferences({ editor: { keybindings: normalizedDraft } });
    } catch {
      setError("Use shortcuts like Mod+S, Mod+Shift+F, or Alt+Enter.");
    }
  }

  async function resetKeybindings() {
    const defaults = { ...defaultEditorKeybindings };
    setDraft(defaults);
    setError(null);
    await updatePreferences({ editor: { keybindings: defaults } });
  }

  return (
    <div className="grid gap-5">
      <SettingsPanel title="Editor shortcuts">
        <div className="grid gap-3">
          {keybindingCommands
            .filter((command) => command.scope === "editor")
            .map((command) => (
              <label
                key={command.id}
                className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm md:grid-cols-[minmax(0,1fr)_220px]"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <Keyboard size={15} className="text-muted-foreground" />
                  {command.label}
                </span>
                <button
                  type="button"
                  className={
                    "h-9 rounded-md border bg-panel px-3 text-left font-mono text-sm outline-none transition focus:border-primary " +
                    (capturingCommandId === command.id ? "border-primary text-primary" : "border-border")
                  }
                  onClick={() => {
                    setCapturingCommandId(command.id);
                    setError(null);
                  }}
                  onBlur={() => {
                    setCapturingCommandId((currentCommandId) =>
                      currentCommandId === command.id ? null : currentCommandId
                    );
                  }}
                  onKeyDown={(event) => captureShortcut(command.id, event)}
                >
                  {capturingCommandId === command.id ? "Press shortcut" : draft[command.id] || "Unassigned"}
                </button>
              </label>
            ))}
        </div>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
            onClick={() => {
              void saveKeybindings();
            }}
          >
            <Check size={15} />
            Save Keybindings
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              void resetKeybindings();
            }}
          >
            <RotateCcw size={15} />
            Reset Defaults
          </button>
        </div>
      </SettingsPanel>
    </div>
  );
}

function ExportSettings({
  preferences,
  updatePreferences
}: {
  preferences: UserPreferences;
  updatePreferences: (patch: UserPreferencesPatch) => Promise<void>;
}) {
  return (
    <SettingsPanel title="Images">
      <ToggleField
        label="Image captions"
        checked={preferences.export.includeImageCaptions}
        onChange={(checked) => updatePreferences({ export: { includeImageCaptions: checked } })}
      />
    </SettingsPanel>
  );
}

function SettingsPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-panel-strong p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ThemeButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        "flex h-12 items-center justify-center gap-2 rounded-md border text-sm transition " +
        (active
          ? "border-primary bg-muted font-medium text-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:text-foreground")
      }
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function SelectField<T extends string>({
  label,
  value,
  values,
  onChange
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="h-10 rounded-md border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormSelectField<T extends string>({
  label,
  name,
  value,
  values,
  onChange
}: {
  label: string;
  name: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        className="h-10 rounded-md border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T)}
      >
        {values.map((option) => (
          <option key={option || "none"} value={option}>
            {option ? formatOption(option) : "Default"}
          </option>
        ))}
      </select>
    </label>
  );
}

function parseOptionalWorkspaceValue<T extends string>(value: FormDataEntryValue | string | null): T | null {
  return typeof value === "string" && value ? (value as T) : null;
}

function getWorkspaceFromFormData(workspace: WorkspaceSummary, formData: FormData): WorkspaceSummary {
  return {
    ...workspace,
    name: String(formData.get("name") ?? workspace.name).trim(),
    icon: parseOptionalWorkspaceValue<NonNullable<WorkspaceSummary["icon"]>>(formData.get("icon")),
    accent: parseOptionalWorkspaceValue<NonNullable<WorkspaceSummary["accent"]>>(formData.get("accent")),
    cover: parseOptionalWorkspaceValue<NonNullable<WorkspaceSummary["cover"]>>(formData.get("cover")),
    defaultLayout: String(formData.get("defaultLayout") ?? workspace.defaultLayout) as WorkspaceSummary["defaultLayout"]
  };
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-11 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function SaveStatus({ status }: { status: SaveStatusValue }) {
  if (status === "idle") {
    return null;
  }

  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
      {status === "saved" ? <Check size={15} className="text-primary" /> : null}
      {status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Could not save"}
    </div>
  );
}

function ShallowPanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-md border border-border bg-panel-strong p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{value}</p>
    </section>
  );
}

function getSectionTitle(section: SettingsSection) {
  return sections.find((item) => item.id === section)?.label ?? "Settings";
}

function getSectionSubtitle(section: SettingsSection) {
  switch (section) {
    case "appearance":
      return "Theme, accent, and gradient presets.";
    case "workspace":
      return "Workspace name, icon, cover, and default layout.";
    case "editor":
      return "Document width, typography, code, and input preferences.";
    case "keybindings":
      return "Custom shortcuts for editor commands.";
    case "export":
      return "Export behavior for generated documents.";
    case "account":
      return "Account identity.";
    case "security":
      return "Security and activity summary.";
    case "storage":
      return "Upload rules and limits.";
  }
}

function formatOption(value: string) {
  return value
    .split("-")
    .join(" ")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
