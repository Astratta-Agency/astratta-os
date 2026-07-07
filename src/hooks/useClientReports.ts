import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET } from "@/lib/storage";

export type ClientReportStatus = "draft" | "published";

export type ReportKpi = {
  label: string;
  value: string;
  previous_value?: string;
  unit?: string;
};

/** Stat destacada del resumen ejecutivo (fila de números grandes). */
export type ReportHeroStat = {
  label: string;
  value: string;
  detail?: string;
};

export type ReportMetric = {
  label: string;
  value: string;
};

/** Columna de la tabla comparativa de KPIs por plataforma. */
export type ReportPlatformKpis = {
  platform: string;
  metrics: ReportMetric[];
};

export type ReportHighlightStat = {
  value: string;
  label: string;
  detail?: string;
};

/** Highlight del período (campaña, pico, hito). */
export type ReportHighlight = {
  title?: string;
  description?: string;
  stats?: ReportHighlightStat[];
  footer_note?: string;
};

/** Bloque de audiencia (ej: Demografía / Geografía). */
export type ReportAudienceBlock = {
  title: string;
  body: string;
};

export type ReportTopPost = {
  social_post_id?: string | null;
  platform?: string;
  format?: string;
  /** Fecha legible de publicación, ej: "20 jun". */
  post_date?: string;
  caption_snapshot?: string;
  metrics?: ReportMetric[];
  note?: string;
};

export type ClientReportRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  created_by: string | null;
  title: string;
  period_month: number;
  period_year: number;
  status: ClientReportStatus;
  executive_summary: string | null;
  hero_stats: ReportHeroStat[];
  platform_kpis: ReportPlatformKpis[];
  highlight: ReportHighlight | null;
  kpis: ReportKpi[];
  top_posts: ReportTopPost[];
  audience: ReportAudienceBlock[];
  learnings: string | null;
  next_month_plan: string | null;
  recommendations: string | null;
  data_notes: string | null;
  pdf_storage_path: string | null;
  pdf_public_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatPeriod(month: number, year: number): string {
  const m = MONTHS_ES[Math.max(0, Math.min(11, month - 1))];
  return `${m} ${year}`;
}

/** Métricas estándar para la tabla de KPIs por plataforma. */
export const STANDARD_PLATFORM_METRICS = [
  "Visualizaciones",
  "Alcance",
  "Interacciones",
  "Tasa de engagement",
  "Clics al sitio web",
  "Publicaciones",
];

/** Divide un texto en ítems numerables (una línea = un ítem). */
export function splitItems(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:\d+[.)-]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

function normalize(row: any): ClientReportRow {
  return {
    ...row,
    kpis: Array.isArray(row?.kpis) ? row.kpis : [],
    top_posts: Array.isArray(row?.top_posts) ? row.top_posts : [],
    hero_stats: Array.isArray(row?.hero_stats) ? row.hero_stats : [],
    platform_kpis: Array.isArray(row?.platform_kpis) ? row.platform_kpis : [],
    audience: Array.isArray(row?.audience) ? row.audience : [],
    highlight:
      row?.highlight && typeof row.highlight === "object" ? row.highlight : null,
    data_notes: row?.data_notes ?? null,
  } as ClientReportRow;
}

// ---------------- Queries ----------------

export function useClientReports(clientId: string | undefined) {
  return useQuery<ClientReportRow[]>({
    queryKey: ["client-reports", clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_reports")
        .select("*")
        .eq("client_id", clientId)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) {
        console.error("useClientReports", error);
        return [];
      }
      return (data ?? []).map(normalize);
    },
  });
}

/** Portal-side: RLS filters to published only. Order desc. */
export function usePublishedClientReports(clientId: string | undefined) {
  return useQuery<ClientReportRow[]>({
    queryKey: ["client-reports-published", clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_reports")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "published")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) {
        console.error("usePublishedClientReports", error);
        return [];
      }
      return (data ?? []).map(normalize);
    },
  });
}

/** Approved / scheduled / published posts within a given month for the "Top posts" picker. */
export function useMonthPostsForClient(
  clientId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: ["month-posts-for-report", clientId, year, month],
    enabled: !!clientId,
    queryFn: async () => {
      const from = new Date(year, month - 1, 1).toISOString();
      const to = new Date(year, month, 1).toISOString();
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .select("id, title, caption, scheduled_for, status, channels, preview_url, media_urls")
        .eq("client_id", clientId)
        .in("status", ["approved", "scheduled", "published"])
        .gte("scheduled_for", from)
        .lt("scheduled_for", to)
        .order("scheduled_for", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });
}

// ---------------- Mutations ----------------

export type ClientReportInput = {
  workspace_id: string;
  client_id: string;
  title: string;
  period_month: number;
  period_year: number;
  executive_summary?: string | null;
  hero_stats?: ReportHeroStat[];
  platform_kpis?: ReportPlatformKpis[];
  highlight?: ReportHighlight | null;
  kpis?: ReportKpi[];
  top_posts?: ReportTopPost[];
  audience?: ReportAudienceBlock[];
  learnings?: string | null;
  next_month_plan?: string | null;
  recommendations?: string | null;
  data_notes?: string | null;
  status?: ClientReportStatus;
};

function isUniqueViolation(err: any) {
  return err?.code === "23505" || `${err?.message ?? ""}`.toLowerCase().includes("unique");
}

export function useCreateClientReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientReportInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const status = input.status ?? "draft";
      const payload: Record<string, any> = {
        workspace_id: input.workspace_id,
        client_id: input.client_id,
        created_by: userRes.user?.id ?? null,
        title: input.title.trim(),
        period_month: input.period_month,
        period_year: input.period_year,
        executive_summary: input.executive_summary ?? null,
        hero_stats: input.hero_stats ?? [],
        platform_kpis: input.platform_kpis ?? [],
        highlight: input.highlight ?? null,
        kpis: input.kpis ?? [],
        top_posts: input.top_posts ?? [],
        audience: input.audience ?? [],
        learnings: input.learnings ?? null,
        next_month_plan: input.next_month_plan ?? null,
        recommendations: input.recommendations ?? null,
        data_notes: input.data_notes ?? null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      };
      const { data, error } = await (supabase as any)
        .from("client_reports")
        .insert(payload)
        .select()
        .single();
      if (error) {
        if (isUniqueViolation(error)) {
          throw new Error(
            `Ya existe un reporte para ${formatPeriod(input.period_month, input.period_year)}. Edítalo en lugar de crear uno nuevo.`,
          );
        }
        throw error;
      }
      return normalize(data);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["client-reports", vars.client_id] });
      qc.invalidateQueries({ queryKey: ["client-reports-published", vars.client_id] });
    },
  });
}

export type ClientReportPatch = Partial<Omit<ClientReportInput, "workspace_id" | "client_id">> & {
  publish?: boolean;
};

export function useUpdateClientReport(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: ClientReportPatch }) => {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      const p = input.patch;
      if (p.title !== undefined) patch.title = p.title.trim();
      if (p.period_month !== undefined) patch.period_month = p.period_month;
      if (p.period_year !== undefined) patch.period_year = p.period_year;
      if (p.executive_summary !== undefined) patch.executive_summary = p.executive_summary;
      if (p.hero_stats !== undefined) patch.hero_stats = p.hero_stats;
      if (p.platform_kpis !== undefined) patch.platform_kpis = p.platform_kpis;
      if (p.highlight !== undefined) patch.highlight = p.highlight;
      if (p.kpis !== undefined) patch.kpis = p.kpis;
      if (p.top_posts !== undefined) patch.top_posts = p.top_posts;
      if (p.audience !== undefined) patch.audience = p.audience;
      if (p.learnings !== undefined) patch.learnings = p.learnings;
      if (p.next_month_plan !== undefined) patch.next_month_plan = p.next_month_plan;
      if (p.recommendations !== undefined) patch.recommendations = p.recommendations;
      if (p.data_notes !== undefined) patch.data_notes = p.data_notes;
      if (p.status !== undefined) {
        patch.status = p.status;
        if (p.status === "published") patch.published_at = new Date().toISOString();
      }
      if (p.publish === true) {
        patch.status = "published";
        patch.published_at = new Date().toISOString();
      }
      const { data, error } = await (supabase as any)
        .from("client_reports")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) {
        if (isUniqueViolation(error)) {
          throw new Error("Ya existe otro reporte para ese período.");
        }
        throw error;
      }
      return normalize(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-reports", clientId] });
      qc.invalidateQueries({ queryKey: ["client-reports-published", clientId] });
    },
  });
}

export function useDeleteClientReport(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (report: { id: string; pdf_storage_path: string | null }) => {
      if (report.pdf_storage_path) {
        try {
          await supabase.storage.from(BUCKET).remove([report.pdf_storage_path]);
        } catch {
          /* ignore */
        }
      }
      const { error } = await (supabase as any)
        .from("client_reports")
        .delete()
        .eq("id", report.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-reports", clientId] });
      qc.invalidateQueries({ queryKey: ["client-reports-published", clientId] });
    },
  });
}

// ---------------- PDF generation ----------------

type WorkspaceBranding = {
  name: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
};

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]) {
  if (!hex) return fallback;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return fallback;
  const num = parseInt(full, 16);
  if (isNaN(num)) return fallback;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255] as [number, number, number];
}

export function useGenerateClientReportPdf(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      report: ClientReportRow;
      clientName: string;
      workspace: WorkspaceBranding;
    }) => {
      const { report, clientName, workspace } = input;
      // Lazy-load jspdf to keep the main bundle lean.
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 52;
      const contentW = pageW - marginX * 2;
      const primary = hexToRgb(workspace.primary_color, [81, 64, 242]);
      const secondary = hexToRgb(workspace.secondary_color, [255, 117, 3]);
      const INK: [number, number, number] = [24, 24, 27];
      const MUTED: [number, number, number] = [113, 113, 122];
      const LINE: [number, number, number] = [228, 228, 231];

      const period = formatPeriod(report.period_month, report.period_year);
      const wordmark = `${workspace.name.toUpperCase()}.`;

      // ---------- Portada ----------
      let logoDataUrl: string | null = null;
      if (workspace.logo_url) logoDataUrl = await loadImageDataUrl(workspace.logo_url);

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, pageH, "F");

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", marginX, 72, 40, 40);
        } catch {
          /* ignore */
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text(wordmark, marginX + 52, 97);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text(wordmark, marginX, 96);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(38);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const titleLines = doc.splitTextToSize(report.title, contentW);
      let cy = 250;
      for (const line of titleLines) {
        doc.text(line, marginX, cy);
        cy += 44;
      }
      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.setLineWidth(3);
      doc.line(marginX, cy - 26, marginX + 64, cy - 26);
      cy += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(15);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(period, marginX, cy);
      cy += 26;
      doc.setFontSize(12);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(`Preparado para ${clientName}`, marginX, cy);

      // Meta row al pie de la portada
      const platforms = (report.platform_kpis ?? [])
        .map((p) => p.platform)
        .filter(Boolean)
        .join(" · ");
      const metaItems: Array<[string, string]> = [
        ["PERÍODO", period],
        ...(platforms ? ([["PLATAFORMAS", platforms]] as Array<[string, string]>) : []),
        ["CLIENTE", clientName],
        ["AGENCIA", workspace.name],
      ];
      const metaY = pageH - 130;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(1);
      doc.line(marginX, metaY - 22, pageW - marginX, metaY - 22);
      const metaColW = contentW / metaItems.length;
      metaItems.forEach(([label, value], i) => {
        const x = marginX + i * metaColW;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(label, x, metaY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        const vLines = doc.splitTextToSize(value, metaColW - 12);
        doc.text(vLines.slice(0, 3), x, metaY + 14);
      });

      // ---------- Helpers de contenido ----------
      doc.addPage();
      let y = 64;

      const ensureRoom = (needed: number) => {
        if (y + needed > pageH - 56) {
          doc.addPage();
          y = 64;
        }
      };

      let sectionNo = 0;
      const drawSectionHeader = (name: string, subtitle?: string) => {
        sectionNo += 1;
        ensureRoom(subtitle ? 64 : 44);
        y += sectionNo === 1 && y <= 64 ? 0 : 14;
        ensureRoom(subtitle ? 64 : 44);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(primary[0], primary[1], primary[2]);
        doc.text(`${String(sectionNo).padStart(2, "0")} — ${name.toUpperCase()}`, marginX, y);
        y += subtitle ? 22 : 16;
        if (subtitle) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(17);
          doc.setTextColor(INK[0], INK[1], INK[2]);
          doc.text(subtitle, marginX, y);
          y += 20;
        }
      };

      const drawParagraph = (text: string, size = 10, color = INK) => {
        if (!text) return;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, contentW);
        for (const line of lines) {
          ensureRoom(15);
          doc.text(line, marginX, y);
          y += size + 4;
        }
        y += 6;
      };

      const drawStatRow = (
        stats: Array<{ value: string; label: string; detail?: string }>,
        big = true,
      ) => {
        const items = stats.filter((s) => s.value || s.label).slice(0, 4);
        if (!items.length) return;
        const colW = contentW / items.length;
        ensureRoom(big ? 74 : 64);
        items.forEach((s, i) => {
          const x = marginX + i * colW;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(big ? 24 : 19);
          doc.setTextColor(INK[0], INK[1], INK[2]);
          doc.text(s.value || "—", x, y + (big ? 22 : 18));
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(primary[0], primary[1], primary[2]);
          doc.text((s.label || "").toUpperCase().slice(0, 40), x, y + (big ? 36 : 31));
          if (s.detail) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
            const dLines = doc.splitTextToSize(s.detail, colW - 12);
            doc.text(dLines.slice(0, 2), x, y + (big ? 48 : 43));
          }
        });
        y += big ? 74 : 62;
      };

      const drawNumberedList = (items: string[]) => {
        items.forEach((item, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(primary[0], primary[1], primary[2]);
          const num = String(idx + 1).padStart(2, "0");
          const lines = doc.splitTextToSize(item, contentW - 28);
          ensureRoom(lines.length * 14 + 8);
          doc.text(num, marginX, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(INK[0], INK[1], INK[2]);
          for (const line of lines) {
            ensureRoom(15);
            doc.text(line, marginX + 28, y);
            y += 14;
          }
          y += 6;
        });
      };

      const drawTable = (
        headers: string[],
        rows: string[][],
        widths: number[],
      ) => {
        const rowH = 18;
        const drawHeaderRow = () => {
          doc.setFillColor(246, 246, 248);
          doc.rect(marginX, y - 12, contentW, rowH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
          let x = marginX + 6;
          headers.forEach((h, i) => {
            doc.text(h.toUpperCase(), x, y);
            x += widths[i];
          });
          y += rowH;
        };
        ensureRoom(rowH * 2);
        drawHeaderRow();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        for (const row of rows) {
          // altura según celda más alta
          const cellLines = row.map((c, i) =>
            doc.splitTextToSize(c ?? "", widths[i] - 12),
          );
          const h = Math.max(...cellLines.map((l) => l.length)) * 11 + 8;
          if (y + h > pageH - 56) {
            doc.addPage();
            y = 64;
            drawHeaderRow();
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
          }
          let x = marginX + 6;
          cellLines.forEach((lines, i) => {
            doc.setTextColor(i === 0 ? INK[0] : 60, i === 0 ? INK[1] : 60, i === 0 ? INK[2] : 66);
            doc.text(lines, x, y);
            x += widths[i];
          });
          y += h;
          doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
          doc.setLineWidth(0.5);
          doc.line(marginX, y - 11, pageW - marginX, y - 11);
        }
        y += 8;
      };

      // ---------- 0x — Resumen ejecutivo ----------
      const hasSummary =
        !!report.executive_summary?.trim() ||
        (report.hero_stats?.length ?? 0) > 0 ||
        (report.platform_kpis?.length ?? 0) > 0 ||
        (report.kpis?.length ?? 0) > 0;

      if (hasSummary) {
        drawSectionHeader("Resumen ejecutivo");
        if (report.hero_stats?.length) drawStatRow(report.hero_stats, true);

        if (report.platform_kpis?.length) {
          const metricLabels: string[] = [];
          for (const p of report.platform_kpis) {
            for (const m of p.metrics ?? []) {
              if (m.label && !metricLabels.includes(m.label)) metricLabels.push(m.label);
            }
          }
          if (metricLabels.length) {
            const firstW = contentW * 0.3;
            const colW = (contentW - firstW) / report.platform_kpis.length;
            drawTable(
              ["KPI", ...report.platform_kpis.map((p) => p.platform || "—")],
              metricLabels.map((label) => [
                label,
                ...report.platform_kpis.map(
                  (p) => (p.metrics ?? []).find((m) => m.label === label)?.value ?? "—",
                ),
              ]),
              [firstW, ...report.platform_kpis.map(() => colW)],
            );
          }
        }

        // KPIs simples (compatibilidad con reportes viejos)
        if (report.kpis?.length && !report.platform_kpis?.length) {
          drawStatRow(
            report.kpis.map((k) => ({
              value: `${k.value ?? ""}${k.unit ? ` ${k.unit}` : ""}`.trim(),
              label: k.label,
              detail: k.previous_value ? `Anterior: ${k.previous_value}` : undefined,
            })),
            false,
          );
        }

        if (report.executive_summary?.trim()) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(INK[0], INK[1], INK[2]);
          ensureRoom(16);
          doc.text("Lectura rápida:", marginX, y);
          y += 14;
          drawParagraph(report.executive_summary.trim());
        }
      }

      // ---------- Highlight del período ----------
      const hl = report.highlight;
      if (hl && (hl.title || hl.description || hl.stats?.length)) {
        drawSectionHeader("Highlight del período", hl.title || undefined);
        if (hl.description?.trim()) drawParagraph(hl.description.trim());
        if (hl.stats?.length) drawStatRow(hl.stats, false);
        if (hl.footer_note?.trim()) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
          const lines = doc.splitTextToSize(hl.footer_note.trim(), contentW);
          for (const line of lines) {
            ensureRoom(14);
            doc.text(line, marginX, y);
            y += 13;
          }
          y += 6;
        }
      }

      // ---------- Top posts ----------
      if (report.top_posts?.length) {
        drawSectionHeader("Top posts del período", "Lo que mejor funcionó.");
        const byPlatform = new Map<string, ReportTopPost[]>();
        for (const tp of report.top_posts) {
          const key = tp.platform?.trim() || "General";
          if (!byPlatform.has(key)) byPlatform.set(key, []);
          byPlatform.get(key)!.push(tp);
        }
        for (const [platform, posts] of byPlatform) {
          ensureRoom(40);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(secondary[0], secondary[1], secondary[2]);
          doc.text(platform.toUpperCase(), marginX, y);
          y += 16;
          drawTable(
            ["#", "Post", "Formato", "Fecha", "Métricas"],
            posts.map((p, i) => [
              String(i + 1),
              p.caption_snapshot ?? "",
              p.format ?? "—",
              p.post_date ?? "—",
              (p.metrics ?? [])
                .filter((m) => m.label || m.value)
                .map((m) => `${m.label}: ${m.value}`)
                .join(" · ") || "—",
            ]),
            [
              contentW * 0.05,
              contentW * 0.42,
              contentW * 0.13,
              contentW * 0.12,
              contentW * 0.28,
            ],
          );
          const notes = posts.filter((p) => p.note?.trim());
          for (const p of notes) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8.5);
            doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
            const lines = doc.splitTextToSize(p.note!.trim(), contentW);
            for (const line of lines) {
              ensureRoom(13);
              doc.text(line, marginX, y);
              y += 12;
            }
            y += 4;
          }
          y += 6;
        }
      }

      // ---------- Audiencia ----------
      if (report.audience?.length) {
        drawSectionHeader("Audiencia", "Quién está viendo.");
        for (const block of report.audience) {
          if (!block.title && !block.body) continue;
          ensureRoom(30);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(primary[0], primary[1], primary[2]);
          doc.text((block.title || "").toUpperCase(), marginX, y);
          y += 14;
          drawParagraph(block.body || "");
        }
      }

      // ---------- Aprendizajes ----------
      const learningItems = splitItems(report.learnings);
      if (learningItems.length) {
        drawSectionHeader("Aprendizajes", "Lo que el período nos enseñó.");
        drawNumberedList(learningItems);
      }

      // ---------- Plan de acción ----------
      const planItems = splitItems(report.next_month_plan);
      const recoItems = splitItems(report.recommendations);
      if (planItems.length || recoItems.length) {
        drawSectionHeader("Plan de acción", "Recomendaciones para el próximo período.");
        if (planItems.length) drawNumberedList(planItems);
        if (recoItems.length) {
          if (planItems.length) {
            ensureRoom(24);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(primary[0], primary[1], primary[2]);
            doc.text("RECOMENDACIONES ADICIONALES", marginX, y);
            y += 14;
          }
          drawNumberedList(recoItems);
        }
      }

      // ---------- Notas de producción y datos ----------
      if (report.data_notes?.trim()) {
        ensureRoom(52);
        y += 8;
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(1);
        doc.line(marginX, y - 4, pageW - marginX, y - 4);
        y += 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text("NOTAS DE PRODUCCIÓN Y DATOS", marginX, y);
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(report.data_notes.trim(), contentW);
        for (const line of lines) {
          ensureRoom(12);
          doc.text(line, marginX, y);
          y += 11;
        }
        y += 8;
      }

      // Cierre
      ensureRoom(40);
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(wordmark, marginX, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(
        `Documento preparado por ${workspace.name} para ${clientName} — ${period}`,
        marginX,
        y,
      );

      // Footer en todas las páginas menos la portada
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 2; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 166);
        doc.text(
          `${workspace.name.toUpperCase()} — ${clientName.toUpperCase()}`,
          marginX,
          pageH - 28,
        );
        doc.text(`${p} / ${pageCount}`, pageW - marginX, pageH - 28, { align: "right" });
      }

      const blob = doc.output("blob");
      const storagePath = `${report.workspace_id}/${report.client_id}/reports/${report.id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "application/pdf",
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      const { data: updated, error: updErr } = await (supabase as any)
        .from("client_reports")
        .update({
          pdf_storage_path: storagePath,
          pdf_public_url: pub.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id)
        .select()
        .single();
      if (updErr) throw updErr;
      return normalize(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-reports", clientId] });
      qc.invalidateQueries({ queryKey: ["client-reports-published", clientId] });
    },
  });
}
