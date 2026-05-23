import type { EditorDocument } from "@/modules/editor/editor.types";

export type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  category: string;
};

export type TemplateDetail = TemplateSummary & {
  contentJson: EditorDocument;
  schemaVersion: number;
};
