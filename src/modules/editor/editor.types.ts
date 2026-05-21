export type EditorTextNode = {
  type: "text";
  text?: string;
};

export type EditorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: Array<EditorNode | EditorTextNode>;
};

export type EditorDocument = {
  type: "doc";
  schemaVersion?: number;
  content?: EditorNode[];
};
