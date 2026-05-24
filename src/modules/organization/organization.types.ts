export type FolderSummary = {
  id: string;
  name: string;
  parentId: string | null;
};

export type TagSummary = {
  id: string;
  name: string;
  color: string | null;
};
