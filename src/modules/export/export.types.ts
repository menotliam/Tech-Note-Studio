export type ExportFormat = "pdf" | "docx";

export type ExportDocument = {
  title: string;
  blocks: ExportBlock[];
};

export type ExportBundle = {
  title: string;
  documents: ExportDocument[];
};

export type ExportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "checklist"; items: Array<{ checked: boolean; text: string }> }
  | { type: "quote"; text: string }
  | { type: "divider" }
  | { type: "code"; language: string; code: string }
  | { type: "table"; rows: string[][] };
