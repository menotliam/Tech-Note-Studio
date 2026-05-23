export type EditorTextNode = {
  type: "text";
  text?: string;
  marks?: EditorMark[];
};

export type EditorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: Array<EditorNode | EditorTextNode>;
  marks?: EditorMark[];
};

export type EditorDocument = {
  type: "doc";
  schemaVersion?: number;
  content?: Array<EditorNode | EditorTextNode>;
};

export type EditorMark = {
  type: string;
  attrs?: Record<string, unknown>;
};
