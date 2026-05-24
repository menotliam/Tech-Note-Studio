import { z } from "zod";
import {
  accentPresetValues,
  dashboardDefaultViewValues,
  defaultUserPreferences,
  gradientPresetValues
} from "@/modules/preferences/preferences.defaults";

export const workspaceIconValues = ["terminal", "book", "database", "sparkles", "code"] as const;

export const workspaceNameSchema = z.string().trim().min(1).max(80);

export const workspacePersonalizationSchema = z.object({
  name: workspaceNameSchema,
  icon: z.enum(workspaceIconValues).nullable(),
  accent: z.enum(accentPresetValues).nullable(),
  cover: z.enum(gradientPresetValues).nullable(),
  defaultLayout: z.enum(dashboardDefaultViewValues).default(defaultUserPreferences.dashboard.defaultView)
});

export function parseNullableWorkspaceFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? value : null;
}
