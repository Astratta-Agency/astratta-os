import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

export type CalloutVariant = "info" | "idea" | "warning" | "success";

export const CALLOUT_EMOJI: Record<CalloutVariant, string> = {
  info: "ℹ️",
  idea: "💡",
  warning: "⚠️",
  success: "✅",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wraps the selection in a callout, or unwraps it if already inside one. */
      toggleCallout: (variant?: CalloutVariant) => ReturnType;
    };
  }
}

/** Colored box with an emoji, like ClickUp/Notion callouts. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "idea",
        parseHTML: (el) => (el.getAttribute("data-variant") as CalloutVariant) || "idea",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const variant = (node.attrs.variant as CalloutVariant) ?? "idea";
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": "", "data-emoji": CALLOUT_EMOJI[variant] }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleCallout:
        (variant = "idea") =>
        ({ commands, editor }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { variant }),
    };
  },
});

/** Extensions shared by the editor and the exporters, so both understand the same nodes. */
export const DOC_EXTENSIONS = [StarterKit, TaskList, TaskItem.configure({ nested: true }), Callout];
