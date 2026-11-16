import type { JSONContent } from "@tiptap/react";
import type { DocumentType } from "@/hooks/useDocuments";

const h = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const p = (text?: string): JSONContent => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const bullets = (...items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const tasks = (...items: string[]): JSONContent => ({
  type: "taskList",
  content: items.map((t) => ({ type: "taskItem", attrs: { checked: false }, content: [p(t)] })),
});
const callout = (variant: string, text: string): JSONContent => ({
  type: "callout",
  attrs: { variant },
  content: [p(text)],
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

export type DocTemplate = {
  key: string;
  label: string;
  description: string;
  icon: string;
  type: DocumentType;
  title: string;
  content: JSONContent;
};

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: "brief",
    label: "Brief de contenido",
    description: "Objetivo, audiencia y mensajes de una pieza",
    icon: "🎯",
    type: "idea",
    title: "Brief de contenido",
    content: doc(
      callout("idea", "Completa este brief antes de producir. Compártelo con el cliente si hace falta aprobación."),
      h(2, "Objetivo"),
      p("¿Qué queremos lograr con esta pieza?"),
      h(2, "Audiencia"),
      p("¿A quién le hablamos? Dolor principal, deseo, objeciones."),
      h(2, "Mensaje clave"),
      p(),
      h(2, "Formato y canales"),
      bullets("Formato: reel / carrusel / post", "Canales:", "Fecha de publicación:"),
      h(2, "Llamado a la acción"),
      p(),
      h(2, "Referencias"),
      bullets(""),
    ),
  },
  {
    key: "script",
    label: "Guion de reel",
    description: "Gancho, desarrollo y cierre en tomas",
    icon: "🎬",
    type: "script",
    title: "Guion de reel",
    content: doc(
      h(2, "Gancho (0–3 s)"),
      p("La frase o imagen que detiene el scroll."),
      h(2, "Desarrollo"),
      bullets("Toma 1:", "Toma 2:", "Toma 3:"),
      h(2, "Cierre y CTA"),
      p(),
      h(2, "Texto en pantalla"),
      p(),
      h(2, "Caption"),
      p(),
      callout("info", "Duración objetivo: 15–30 s. Graba en vertical 9:16."),
    ),
  },
  {
    key: "report",
    label: "Reporte mensual",
    description: "Resultados, aprendizajes y próximos pasos",
    icon: "📊",
    type: "kpi_plan",
    title: "Reporte mensual",
    content: doc(
      h(2, "Resumen"),
      callout("success", "Lo más importante del mes en 2–3 líneas."),
      h(2, "KPIs"),
      bullets("Alcance:", "Interacciones:", "Seguidores nuevos:", "Leads / ventas:"),
      h(2, "Lo que funcionó"),
      bullets(""),
      h(2, "Lo que no funcionó"),
      bullets(""),
      h(2, "Próximos pasos"),
      tasks("", ""),
    ),
  },
  {
    key: "sop",
    label: "Procedimiento (SOP)",
    description: "Pasos estándar para un proceso del equipo",
    icon: "📋",
    type: "nota",
    title: "Procedimiento",
    content: doc(
      h(2, "Propósito"),
      p("¿Para qué sirve este proceso y cuándo se usa?"),
      h(2, "Responsable"),
      p(),
      h(2, "Pasos"),
      { type: "orderedList", content: ["", "", ""].map((t) => ({ type: "listItem", content: [p(t)] })) },
      callout("warning", "Errores comunes a evitar."),
      h(2, "Checklist final"),
      tasks("", ""),
    ),
  },
  {
    key: "meeting",
    label: "Notas de reunión",
    description: "Agenda, decisiones y tareas",
    icon: "🤝",
    type: "nota",
    title: "Notas de reunión",
    content: doc(
      bullets("Fecha:", "Asistentes:"),
      h(2, "Agenda"),
      bullets(""),
      h(2, "Notas"),
      p(),
      h(2, "Decisiones"),
      bullets(""),
      h(2, "Tareas"),
      tasks(""),
    ),
  },
];
