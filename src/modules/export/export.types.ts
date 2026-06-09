export type ExportFormat = "pdf" | "docx";

export type ExportDocument = {
  title: string;
  blocks: ExportBlock[];
};

export type ExportBundle = {
  title: string;
  documents: ExportDocument[];
};

export type ExportImageAsset = {
  data: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  originalFilename: string | null;
};

export type ExportTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

export type ExportTextContent = {
  text: string;
  runs?: ExportTextRun[];
  alignment?: "left" | "center" | "right";
};

export type ExportListItem = ExportTextContent & {
  depth?: number;
  ordered?: boolean;
  marker?: string;
};

export type ExportBlock =
  | ({ type: "heading"; level: 1 | 2 | 3 } & ExportTextContent)
  | ({ type: "paragraph" } & ExportTextContent)
  | { type: "list"; ordered: boolean; items: ExportListItem[] }
  | { type: "checklist"; items: Array<ExportTextContent & { checked: boolean }> }
  | ({ type: "quote" } & ExportTextContent)
  | { type: "divider" }
  | { type: "code"; language: string; code: string }
  | {
      type: "image";
      src: string;
      alt: string;
      caption?: string;
      width?: number;
      alignment?: "left" | "center" | "right";
      fileId?: string;
      asset?: ExportImageAsset;
    }
  | { type: "table"; rows: ExportTextContent[][] };
