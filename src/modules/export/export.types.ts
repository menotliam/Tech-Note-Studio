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

export type ExportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "checklist"; items: Array<{ checked: boolean; text: string }> }
  | { type: "quote"; text: string }
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
  | { type: "table"; rows: string[][] };
