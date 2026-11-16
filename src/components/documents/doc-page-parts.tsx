import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Doc } from "@/hooks/useDocuments";

export const DOC_EMOJIS = [
  "📄", "📝", "📌", "📎", "📚", "📖", "🗂️", "📁", "📊", "📈", "🎯", "🚀",
  "💡", "🧠", "✨", "⭐", "🔥", "✅", "⚠️", "❓", "🎬", "📸", "🎨", "🖌️",
  "📣", "💬", "🤝", "💼", "🏢", "🛒", "💰", "🧾", "🗓️", "⏰", "🔒", "🔑",
  "🌱", "🌎", "❤️", "🙌",
];

export const COVER_COLORS = [
  "#5140f2", "#ff7503", "#10b981", "#0ea5e9", "#f43f5e", "#a855f7",
  "#f59e0b", "#14b8a6", "#64748b", "#1f2937",
];

export function DocIcon({ doc, className }: { doc: Pick<Doc, "icon">; className?: string }) {
  return doc.icon ? (
    <span className={cn("leading-none", className)}>{doc.icon}</span>
  ) : (
    <FileText className={cn("h-4 w-4 text-muted-foreground", className)} />
  );
}

export function EmojiPicker({
  onPick,
  onClear,
  children,
}: {
  onPick: (emoji: string) => void;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="grid grid-cols-8 gap-1">
          {DOC_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Usar ${e}`}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Quitar icono
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CoverPicker({
  onPick,
  onClear,
  children,
}: {
  onPick: (color: string) => void;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <div className="grid grid-cols-5 gap-2">
          {COVER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Portada ${c}`}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="h-8 rounded-md ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1"
              style={{ background: `linear-gradient(135deg, ${c}, ${c}99)` }}
            />
          ))}
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Quitar portada
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------- page tree --

type Node = { doc: Doc; children: Node[] };

function buildTree(docs: Doc[], rootId: string): Node | null {
  const byParent = new Map<string, Doc[]>();
  for (const d of docs) {
    if (!d.parent_id) continue;
    const list = byParent.get(d.parent_id) ?? [];
    list.push(d);
    byParent.set(d.parent_id, list);
  }
  const root = docs.find((d) => d.id === rootId);
  if (!root) return null;
  const make = (d: Doc, depth: number): Node => ({
    doc: d,
    children:
      depth > 8
        ? []
        : (byParent.get(d.id) ?? [])
            .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
            .map((c) => make(c, depth + 1)),
  });
  return make(root, 0);
}

/** Top-most ancestor of a doc, following parent_id. */
export function rootOf(docs: Doc[], doc: Doc): Doc {
  const byId = new Map(docs.map((d) => [d.id, d]));
  let cur = doc;
  for (let i = 0; i < 10 && cur.parent_id && byId.has(cur.parent_id); i++) cur = byId.get(cur.parent_id)!;
  return cur;
}

/** Ancestors from the root down to (not including) the doc. */
export function ancestorsOf(docs: Doc[], doc: Doc): Doc[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const out: Doc[] = [];
  let cur = doc;
  for (let i = 0; i < 10 && cur.parent_id && byId.has(cur.parent_id); i++) {
    cur = byId.get(cur.parent_id)!;
    out.unshift(cur);
  }
  return out;
}

function TreeItem({ node, currentId, depth }: { node: Node; currentId: string; depth: number }) {
  const [open, setOpen] = useState(true);
  const has = node.children.length > 0;
  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-2 text-sm",
          node.doc.id === currentId ? "bg-muted font-medium" : "hover:bg-muted/60",
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <button
          type="button"
          aria-label={open ? "Contraer" : "Expandir"}
          onClick={() => setOpen((v) => !v)}
          className={cn("flex h-6 w-5 shrink-0 items-center justify-center text-muted-foreground", !has && "invisible")}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Link to={`/app/documentos/${node.doc.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
          <DocIcon doc={node.doc} className="shrink-0 text-sm" />
          <span className="truncate">{node.doc.title || "Sin título"}</span>
        </Link>
      </div>
      {open && node.children.map((c) => <TreeItem key={c.doc.id} node={c} currentId={currentId} depth={depth + 1} />)}
    </div>
  );
}

export function DocTree({
  docs,
  current,
  onAddPage,
  adding,
}: {
  docs: Doc[];
  current: Doc;
  onAddPage: () => void;
  adding: boolean;
}) {
  const root = useMemo(() => rootOf(docs, current), [docs, current]);
  const tree = useMemo(() => buildTree(docs, root.id), [docs, root.id]);
  return (
    <nav aria-label="Páginas" className="space-y-1">
      <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Páginas</div>
      {tree && <TreeItem node={tree} currentId={current.id} depth={0} />}
      <button
        type="button"
        onClick={onAddPage}
        disabled={adding}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar subpágina
      </button>
    </nav>
  );
}

// ------------------------------------------------------- table of contents --

type Heading = { level: number; text: string; pos: number };

export function DocToc({ editor }: { editor: Editor | null }) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!editor) return;
    const read = () => {
      const list: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading" && node.textContent.trim()) {
          list.push({ level: node.attrs.level as number, text: node.textContent, pos });
        }
      });
      setHeadings(list);
    };
    read();
    editor.on("update", read);
    return () => {
      editor.off("update", read);
    };
  }, [editor]);

  if (!editor || headings.length === 0) return null;

  const go = (pos: number) => {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ behavior: "smooth", block: "start" });
    editor.chain().setTextSelection(pos + 1).run();
  };

  return (
    <nav aria-label="Índice" className="space-y-0.5">
      <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En esta página</div>
      {headings.map((h, i) => (
        <button
          key={i}
          type="button"
          onClick={() => go(h.pos)}
          className="block w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
