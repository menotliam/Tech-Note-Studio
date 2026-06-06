export type WorkspaceLifecycleView = "active" | "archive" | "trash";

export const stateCopy = {
  editorEmpty(view: WorkspaceLifecycleView) {
    if (view === "archive") {
      return {
        title: "Archive is ready",
        description: "Select an archived note from Explorer to review or restore it."
      };
    }

    if (view === "trash") {
      return {
        title: "Trash review",
        description: "Select a trashed note to inspect it before restoring or deleting forever."
      };
    }

    return {
      title: "Select or create a note",
      description: "Pick a note from Explorer or start a fresh technical note."
    };
  },
  explorerEmpty(view: WorkspaceLifecycleView) {
    if (view === "archive") {
      return {
        title: "Nothing archived",
        description: "Archived notes and folders will appear here when you move them out of the active workspace."
      };
    }

    if (view === "trash") {
      return {
        title: "Trash is empty",
        description: "Deleted notes and folders will appear here for review before permanent cleanup."
      };
    }

    return {
      title: "Workspace is empty",
      description: "Create a note or folder to begin organizing technical material."
    };
  },
  searchIdle() {
    return {
      title: "Search your notes",
      description: "Type a note title, tag name, or folder name to search the current workspace."
    };
  },
  searchEmpty(query: string) {
    return {
      title: "No matching items",
      description: `No note title, tag, or folder matched "${query}". Try a shorter term or check another workspace view.`
    };
  },
  templatesEmpty() {
    return {
      title: "No templates available",
      description: "System templates will appear here when they are configured for this workspace."
    };
  },
  tagsEmpty() {
    return {
      title: "No tags yet",
      description: "Create tags to group notes by language, topic, course, or troubleshooting area."
    };
  },
  tagNoNotes(tagName: string) {
    return {
      title: "No notes use this tag",
      description: `${tagName} is ready, but it has not been applied to any notes yet.`
    };
  },
  tagSelectPrompt() {
    return {
      title: "Select a tag",
      description: "Choose a tag to inspect the notes currently attached to it."
    };
  },
  exportEmpty() {
    return {
      title: "No notes to export",
      description: "Create or restore notes before building a PDF or DOCX export packet."
    };
  },
  exportCartEmpty() {
    return {
      title: "Build an export packet",
      description: "Select one or more notes below; the export order will appear here."
    };
  }
} as const;
