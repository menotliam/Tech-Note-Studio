import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditorDocument } from "@/modules/editor/editor.types";
import type { TemplateDetail, TemplateSummary } from "./template.types";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  content_json: EditorDocument;
  schema_version: number;
};

function toTemplateSummary(row: TemplateRow): TemplateSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category ?? "general"
  };
}

function toTemplateDetail(row: TemplateRow): TemplateDetail {
  return {
    ...toTemplateSummary(row),
    contentJson: row.content_json,
    schemaVersion: row.schema_version
  };
}

export async function listSystemTemplates(supabase: SupabaseClient): Promise<TemplateSummary[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, category, content_json, schema_version")
    .eq("is_system_template", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as TemplateRow[]).map(toTemplateSummary);
}

export async function getReadableTemplateById(
  supabase: SupabaseClient,
  templateId: string
): Promise<TemplateDetail | null> {
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, category, content_json, schema_version")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toTemplateDetail(data as TemplateRow) : null;
}
