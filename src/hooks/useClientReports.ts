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

export type ReportTopPost = {
  social_post_id?: string | null;
  caption_snapshot?: string;
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
  kpis: ReportKpi[];
  top_posts: ReportTopPost[];
  learnings: string | null;
  next_month_plan: string | null;
  recommendations: string | null;
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

function normalize(row: any): ClientReportRow {
  return {
    ...row,
    kpis: Array.isArray(row?.kpis) ? row.kpis : [],
    top_posts: Array.isArray(row?.top_posts) ? row.top_posts : [],
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
  kpis?: ReportKpi[];
  top_posts?: ReportTopPost[];
  learnings?: string | null;
  next_month_plan?: string | null;
  recommendations?: string | null;
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
        kpis: input.kpis ?? [],
        top_posts: input.top_posts ?? [],
        learnings: input.learnings ?? null,
        next_month_plan: input.next_month_plan ?? null,
        recommendations: input.recommendations ?? null,
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
      if (p.kpis !== undefined) patch.kpis = p.kpis;
      if (p.top_posts !== undefined) patch.top_posts = p.top_posts;
      if (p.learnings !== undefined) patch.learnings = p.learnings;
      if (p.next_month_plan !== undefined) patch.next_month_plan = p.next_month_plan;
      if (p.recommendations !== undefined) patch.recommendations = p.recommendations;
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
      const marginX = 48;
      const primary = hexToRgb(workspace.primary_color, [81, 64, 242]);
      const secondary = hexToRgb(workspace.secondary_color, [255, 117, 3]);

      // Header band
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.rect(0, 0, pageW, 88, "F");
      doc.setFillColor(secondary[0], secondary[1], secondary[2]);
      doc.rect(0, 88, pageW, 4, "F");

      // Optional logo
      if (workspace.logo_url) {
        const dataUrl = await loadImageDataUrl(workspace.logo_url);
        if (dataUrl) {
          try {
            doc.addImage(dataUrl, "PNG", marginX, 22, 44, 44);
          } catch {
            /* ignore image errors */
          }
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(workspace.name, marginX + 56, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Reporte mensual de performance", marginX + 56, 62);

      // Title block
      let y = 128;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(report.title, marginX, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(
        `${clientName}  ·  ${formatPeriod(report.period_month, report.period_year)}`,
        marginX,
        y,
      );
      y += 22;

      const ensureRoom = (needed: number) => {
        if (y + needed > pageH - 48) {
          doc.addPage();
          y = 56;
        }
      };

      const drawSectionTitle = (text: string) => {
        ensureRoom(28);
        y += 6;
        doc.setDrawColor(primary[0], primary[1], primary[2]);
        doc.setLineWidth(2);
        doc.line(marginX, y, marginX + 24, y);
        y += 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(20, 20, 20);
        doc.text(text, marginX, y);
        y += 14;
      };

      const drawParagraph = (text: string) => {
        if (!text) return;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(text, pageW - marginX * 2);
        for (const line of lines) {
          ensureRoom(16);
          doc.text(line, marginX, y);
          y += 15;
        }
        y += 6;
      };

      // Executive summary
      if (report.executive_summary?.trim()) {
        drawSectionTitle("Resumen ejecutivo");
        drawParagraph(report.executive_summary.trim());
      }

      // KPIs grid
      if (report.kpis?.length) {
        drawSectionTitle("KPIs del período");
        const cardW = (pageW - marginX * 2 - 12) / 2;
        const cardH = 58;
        for (let i = 0; i < report.kpis.length; i++) {
          const kpi = report.kpis[i];
          const col = i % 2;
          if (col === 0) ensureRoom(cardH + 8);
          const x = marginX + col * (cardW + 12);
          doc.setDrawColor(230, 230, 230);
          doc.setFillColor(250, 250, 252);
          doc.roundedRect(x, y, cardW, cardH, 6, 6, "FD");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text((kpi.label || "").slice(0, 60), x + 12, y + 18);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.setTextColor(20, 20, 20);
          const valueStr = `${kpi.value ?? ""}${kpi.unit ? ` ${kpi.unit}` : ""}`.trim();
          doc.text(valueStr || "—", x + 12, y + 40);
          if (kpi.previous_value) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text(`Anterior: ${kpi.previous_value}`, x + 12, y + 52);
          }
          if (col === 1 || i === report.kpis.length - 1) y += cardH + 10;
        }
      }

      // Top posts
      if (report.top_posts?.length) {
        drawSectionTitle("Top posts del mes");
        for (const tp of report.top_posts) {
          const text = tp.caption_snapshot || tp.note || "(sin descripción)";
          ensureRoom(20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(secondary[0], secondary[1], secondary[2]);
          doc.text("•", marginX, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(50, 50, 50);
          const lines = doc.splitTextToSize(text, pageW - marginX * 2 - 14);
          for (let li = 0; li < lines.length; li++) {
            if (li > 0) ensureRoom(16);
            doc.text(lines[li], marginX + 14, y);
            y += 15;
          }
          if (tp.note && tp.caption_snapshot) {
            const noteLines = doc.splitTextToSize(`Nota: ${tp.note}`, pageW - marginX * 2 - 14);
            doc.setFontSize(10);
            doc.setTextColor(120, 120, 120);
            for (const nl of noteLines) {
              ensureRoom(14);
              doc.text(nl, marginX + 14, y);
              y += 13;
            }
          }
          y += 4;
        }
      }

      if (report.learnings?.trim()) {
        drawSectionTitle("Aprendizajes");
        drawParagraph(report.learnings.trim());
      }
      if (report.next_month_plan?.trim()) {
        drawSectionTitle("Plan próximo mes");
        drawParagraph(report.next_month_plan.trim());
      }
      if (report.recommendations?.trim()) {
        drawSectionTitle("Recomendaciones");
        drawParagraph(report.recommendations.trim());
      }

      // Footer on last page
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `${workspace.name} · ${formatPeriod(report.period_month, report.period_year)}`,
          marginX,
          pageH - 24,
        );
        doc.text(`${p} / ${pageCount}`, pageW - marginX, pageH - 24, { align: "right" });
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
