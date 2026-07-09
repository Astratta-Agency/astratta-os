import { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Code,
} from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";

type Props = {
  initialContent: JSONContent | null;
  onChange: (content: JSONContent) => void;
  editable?: boolean;
};

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function DocumentEditor({ initialContent, onChange, editable = true }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (content: JSONContent) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(content), AUTOSAVE_DEBOUNCE_MS);
    },
    [onChange],
  );

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Escribe aquí… usa la barra para dar formato",
      }),
    ],
    content:
      initialContent && Object.keys(initialContent).length > 0
        ? initialContent
        : { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => scheduleSave(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[50vh] px-1 py-4",
      },
    },
  });

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (editor) onChange(editor.getJSON());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  const btn = (
    label: string,
    icon: React.ReactNode,
    active: boolean,
    action: () => void,
  ) => (
    <Toggle size="sm" aria-label={label} pressed={active} onPressedChange={action}>
      {icon}
    </Toggle>
  );

  return (
    <div className="rounded-md border bg-card">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
          {btn("Negrita", <Bold className="h-4 w-4" />, editor.isActive("bold"), () =>
            editor.chain().focus().toggleBold().run(),
          )}
          {btn("Cursiva", <Italic className="h-4 w-4" />, editor.isActive("italic"), () =>
            editor.chain().focus().toggleItalic().run(),
          )}
          {btn(
            "Tachado",
            <Strikethrough className="h-4 w-4" />,
            editor.isActive("strike"),
            () => editor.chain().focus().toggleStrike().run(),
          )}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {btn(
            "Título 1",
            <Heading1 className="h-4 w-4" />,
            editor.isActive("heading", { level: 1 }),
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          )}
          {btn(
            "Título 2",
            <Heading2 className="h-4 w-4" />,
            editor.isActive("heading", { level: 2 }),
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          )}
          {btn(
            "Título 3",
            <Heading3 className="h-4 w-4" />,
            editor.isActive("heading", { level: 3 }),
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          )}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {btn("Lista", <List className="h-4 w-4" />, editor.isActive("bulletList"), () =>
            editor.chain().focus().toggleBulletList().run(),
          )}
          {btn(
            "Lista numerada",
            <ListOrdered className="h-4 w-4" />,
            editor.isActive("orderedList"),
            () => editor.chain().focus().toggleOrderedList().run(),
          )}
          {btn(
            "Checklist",
            <ListChecks className="h-4 w-4" />,
            editor.isActive("taskList"),
            () => editor.chain().focus().toggleTaskList().run(),
          )}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {btn("Cita", <Quote className="h-4 w-4" />, editor.isActive("blockquote"), () =>
            editor.chain().focus().toggleBlockquote().run(),
          )}
          {btn("Código", <Code className="h-4 w-4" />, editor.isActive("codeBlock"), () =>
            editor.chain().focus().toggleCodeBlock().run(),
          )}
          {btn("Divisor", <Minus className="h-4 w-4" />, false, () =>
            editor.chain().focus().setHorizontalRule().run(),
          )}
        </div>
      )}
      <div className="px-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
