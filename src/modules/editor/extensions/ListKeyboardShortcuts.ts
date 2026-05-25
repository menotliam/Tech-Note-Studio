import { Extension, type Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";

type ListKeyboardShortcutsOptions = {
  maxDepth: number;
};

export const ListKeyboardShortcuts = Extension.create<ListKeyboardShortcutsOptions>({
  name: "listKeyboardShortcuts",
  priority: 1000,

  addOptions() {
    return {
      maxDepth: 4
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!isInListItem(this.editor)) {
          return insertHorizontalTabAtSelection(this.editor);
        }

        if (getListDepth(this.editor.state.selection.$from) >= this.options.maxDepth) {
          return true;
        }

        if (this.editor.isActive("taskItem")) {
          return this.editor.commands.sinkListItem("taskItem");
        }

        return this.editor.commands.sinkListItem("listItem");
      },
      "Shift-Tab": () => {
        if (!isInListItem(this.editor)) {
          deleteHorizontalTabBeforeSelection(this.editor);
          return true;
        }

        if (this.editor.isActive("taskItem")) {
          return this.editor.commands.liftListItem("taskItem");
        }

        return this.editor.commands.liftListItem("listItem");
      }
    };
  }
});

function isInListItem(editor: Editor) {
  return editor.isActive("listItem") || editor.isActive("taskItem");
}

function getListDepth($from: ResolvedPos) {
  let depth = 0;

  for (let index = 0; index <= $from.depth; index += 1) {
    const nodeName = $from.node(index).type.name;

    if (nodeName === "listItem" || nodeName === "taskItem") {
      depth += 1;
    }
  }

  return depth;
}

function deleteHorizontalTabBeforeSelection(editor: Editor) {
  const { state, view } = editor;
  const { selection } = state;

  if (!selection.empty) {
    return false;
  }

  const from = selection.from;
  const previousCharacter = state.doc.textBetween(Math.max(0, from - 1), from, "\n", "\n");

  if (previousCharacter !== "\t") {
    return false;
  }

  view.dispatch(state.tr.delete(from - 1, from).scrollIntoView());
  return true;
}

function insertHorizontalTabAtSelection(editor: Editor) {
  const { selection } = editor.state;

  if (!selection.empty || !selection.$from.parent.inlineContent) {
    return true;
  }

  editor.commands.insertContent("\t");
  return true;
}
