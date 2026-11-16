import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Type,
  Info,
  TriangleAlert,
  CircleCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { DOC_EXTENSIONS } from "@/lib/doc-extensions";

type Props = {
  initialContent: JSONContent | null;
  onChange: (content: JSONContent) => void;
  editable?: boolean;
  /** Gives the page access to the editor (e.g. for the table of contents). */
  onReady?: (editor: Editor | null) => void;
};

const AUTOSAVE_DEBOUNCE_MS = 1500;

// ------------------------------------------------------------ slash menu --

type SlashItem = {
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (e: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { label: "Texto", hint: "Párrafo normal", icon: Type, run: (e) => e.chain().focus().setParagraph().run() },
  { label: "Título 1", hint: "Sección grande", icon: Heading1, run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: "Título 2", hint: "Sección mediana", icon: Heading2, run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Título 3", hint: "Sección pequeña", icon: Heading3, run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: "Lista", hint: "Viñetas", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Lista numerada", hint: "1, 2, 3", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Checklist", hint: "Casillas para marcar", icon: ListChecks, run: (e) => e.chain().focus().toggleTaskList().run() },
  { label: "Aviso", hint: "Caja destacada 💡", icon: Lightbulb, run: (e) => e.chain().focus().toggleCallout("idea").run() },
  { label: "Aviso informativo", hint: "Caja azul ℹ️", icon: Info, run: (e) => e.chain().focus().toggleCallout("info").run() },
  { label: "Advertencia", hint: "Caja naranja ⚠️", icon: TriangleAlert, run: (e) => e.chain().focus().toggleCallout("warning").run() },
  { label: "Aviso de éxito", hint: "Caja verde ✅", icon: CircleCheck, run: (e) => e.chain().focus().toggleCallout("success").run() },
  { label: "Cita", hint: "Texto citado", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Código", hint: "Bloque de código", icon: Code, run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: "Divisor", hint: "Línea horizontal", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

type SlashState = { from: number; to: number; query: string; x: number; y: number };

/** Finds a "/query" typed right before the cursor (at line start or after a space). */
function readSlash(editor: Editor): SlashState | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name === "codeBlock") return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
  const m = /(?:^|\s)\/([\p{L}\d ]{0,24})$/u.exec(before);
  if (!m || m[1].endsWith("  ")) return null;
  const from = $from.pos - (m[1].length + 1);
  const coords = editor.view.coordsAtPos(from);
  return { from, to: $from.pos, query: m[1], x: coords.left, y: coords.bottom };
}

// --------------------------------------------------------------- editor --

export function DocumentEditor({ initialContent, onChange, editable = true, onReady }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [active, setActive] = useState(0);

  const items = useMemo(
    () => (slash ? SLASH_ITEMS.filter((it) => norm(it.label).includes(norm(slash.query.trim()))) : []),
    [slash],
  );

  // The editor's key handler is created once; refs give it the current menu.
  const menuRef = useRef({ slash, items, active });
  menuRef.current = { slash, items, active };

  const scheduleSave = useCallback(
    (content: JSONContent) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(content), AUTOSAVE_DEBOUNCE_MS);
    },
    [onChange],
  );

  const runItem = (editor: Editor, item: SlashItem) => {
    const s = menuRef.current.slash;
    if (!s) return;
    editor.chain().focus().deleteRange({ from: s.from, to: s.to }).run();
    item.run(editor);
    setSlash(null);
  };

  const editor = useEditor({
    editable,
    extensions: [
      ...DOC_EXTENSIONS,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Título" : "Escribe, o pulsa / para insertar un bloque…",
      }),
    ],
    content:
      initialContent && Object.keys(initialContent).length > 0
        ? initialContent
        : { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => {
      scheduleSave(editor.getJSON());
      const next = readSlash(editor);
      setSlash(next);
      if (!next) setActive(0);
    },
    onSelectionUpdate: ({ editor }) => {
      if (menuRef.current.slash && !readSlash(editor)) setSlash(null);
    },
    onBlur: () => setTimeout(() => setSlash(null), 150),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[50vh] py-4",
      },
      handleKeyDown: (_view, event) => {
        const { slash: s, items: list, active: idx } = menuRef.current;
        if (!s || list.length === 0) return false;
        if (event.key === "ArrowDown") {
          setActive((idx + 1) % list.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setActive((idx - 1 + list.length) % list.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (editorRef.current) runItem(editorRef.current, list[Math.min(idx, list.length - 1)]);
          return true;
        }
        if (event.key === "Escape") {
          setSlash(null);
          return true;
        }
        return false;
      },
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => setActive(0), [slash?.query]);

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

  const btn = (label: string, icon: React.ReactNode, isActive: boolean, action: () => void) => (
    <Toggle size="sm" aria-label={label} title={label} pressed={isActive} onPressedChange={action} className="h-8 w-8 p-0">
      {icon}
    </Toggle>
  );

  return (
    <div className="relative">
      {editable && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-0.5 border-b bg-background/95 px-1 py-1 backdrop-blur">
          {btn("Negrita", <Bold className="h-4 w-4" />, editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
          {btn("Cursiva", <Italic className="h-4 w-4" />, editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run())}
          {btn("Tachado", <Strikethrough className="h-4 w-4" />, editor.isActive("strike"), () =>
            editor.chain().focus().toggleStrike().run(),
          )}
          <Separator orientation="vertical" className="mx-1 h-5" />
          {btn("Título 1", <Heading1 className="h-4 w-4" />, editor.isActive("heading", { level: 1 }), () =>
            editor.chain().focus().toggleHeading({ level: 1 }).run(),
          )}
          {btn("Título 2", <Heading2 className="h-4 w-4" />, editor.isActive("heading", { level: 2 }), () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
          )}
          {btn("Título 3", <Heading3 className="h-4 w-4" />, editor.isActive("heading", { level: 3 }), () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
          )}
          <Separator orientation="vertical" className="mx-1 h-5" />
          {btn("Lista", <List className="h-4 w-4" />, editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
          {btn("Lista numerada", <ListOrdered className="h-4 w-4" />, editor.isActive("orderedList"), () =>
            editor.chain().focus().toggleOrderedList().run(),
          )}
          {btn("Checklist", <ListChecks className="h-4 w-4" />, editor.isActive("taskList"), () =>
            editor.chain().focus().toggleTaskList().run(),
          )}
          <Separator orientation="vertical" className="mx-1 h-5" />
          {btn("Aviso", <Lightbulb className="h-4 w-4" />, editor.isActive("callout"), () =>
            editor.chain().focus().toggleCallout("idea").run(),
          )}
          {btn("Cita", <Quote className="h-4 w-4" />, editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run())}
          {btn("Código", <Code className="h-4 w-4" />, editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run())}
          {btn("Divisor", <Minus className="h-4 w-4" />, false, () => editor.chain().focus().setHorizontalRule().run())}
          <span className="ml-auto hidden pr-1 text-[11px] text-muted-foreground sm:inline">Escribe / para más bloques</span>
        </div>
      )}

      <EditorContent editor={editor} />

      {slash && items.length > 0 && (
        <div
          role="listbox"
          aria-label="Insertar bloque"
          className="fixed z-50 max-h-72 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
          style={{ left: slash.x, top: slash.y + 6 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Bloques</div>
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => runItem(editor, it)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
                  i === active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-background">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{it.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{it.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
