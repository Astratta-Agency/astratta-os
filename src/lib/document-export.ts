import { generateHTML, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TurndownService from "turndown";

const EXTENSIONS = [StarterKit, TaskList, TaskItem.configure({ nested: true })];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "documento";

function contentToHTML(content: JSONContent | null): string {
  if (!content || !Object.keys(content).length) return "";
  try {
    return generateHTML(content, EXTENSIONS);
  } catch {
    return "";
  }
}

function fullHTMLDocument(title: string, bodyHTML: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHTML(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.6; }
  h1, h2, h3 { line-height: 1.25; }
  blockquote { border-left: 3px solid #d1d5db; margin-left: 0; padding-left: 16px; color: #4b5563; }
  pre { background: #f3f4f6; padding: 12px 16px; border-radius: 8px; overflow-x: auto; }
  code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 0.92em; }
  pre code { background: none; padding: 0; }
  ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
  ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: baseline; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .doc-title { margin-bottom: 4px; }
  .doc-meta { color: #6b7280; font-size: 13px; margin-bottom: 28px; }
</style>
</head>
<body>
<h1 class="doc-title">${escapeHTML(title)}</h1>
<p class="doc-meta">Exportado de Astratta OS — ${new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</p>
${bodyHTML}
</body>
</html>`;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportHTML(title: string, content: JSONContent | null) {
  download(`${slugify(title)}.html`, fullHTMLDocument(title, contentToHTML(content)), "text/html");
}

export function exportMarkdown(title: string, content: JSONContent | null) {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  // Checklists de Tiptap → checkboxes de Markdown
  turndown.addRule("taskItem", {
    filter: (node) =>
      node.nodeName === "LI" && (node as HTMLElement).getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      return `- [${checked ? "x" : " "}] ${content.trim()}\n`;
    },
  });
  const md = `# ${title}\n\n${turndown.turndown(contentToHTML(content))}\n`;
  download(`${slugify(title)}.md`, md, "text/markdown");
}

export function exportCSV(title: string, content: JSONContent | null) {
  const rows: string[][] = [["#", "Tipo de bloque", "Contenido"]];
  const blockText = (node: JSONContent): string => {
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(blockText).join(node.type === "listItem" ? "" : " ");
  };
  const label: Record<string, string> = {
    heading: "Título",
    paragraph: "Párrafo",
    bulletList: "Lista",
    orderedList: "Lista numerada",
    taskList: "Checklist",
    blockquote: "Cita",
    codeBlock: "Código",
    horizontalRule: "Divisor",
  };
  (content?.content ?? []).forEach((node, i) => {
    rows.push([String(i + 1), label[node.type ?? ""] ?? node.type ?? "", blockText(node).trim()]);
  });
  const csv = rows
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  // BOM para que Excel abra acentos correctamente
  download(`${slugify(title)}.csv`, `\uFEFF${csv}`, "text/csv");
}

export function exportPDF(title: string, content: JSONContent | null) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(fullHTMLDocument(title, contentToHTML(content)));
  w.document.close();
  w.focus();
  // Espera a que cargue y abre el diálogo de impresión (Guardar como PDF)
  setTimeout(() => w.print(), 300);
  return true;
}
