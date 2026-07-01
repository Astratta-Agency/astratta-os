import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateDiagnostic,
  useDiagnostics,
  useUpdateDiagnostic,
  type DiagnosticRow,
  type DiagnosticSection,
  type LeadRow,
} from "@/hooks/useSales";

const DEFAULT_SECTIONS: DiagnosticSection[] = [
  { key: "social", title: "Presencia en redes sociales", score: null, notes: "" },
  { key: "seo", title: "SEO on-page", score: null, notes: "" },
  { key: "ux", title: "Velocidad y UX del sitio", score: null, notes: "" },
  { key: "content", title: "Estrategia de contenido actual", score: null, notes: "" },
  { key: "competition", title: "Análisis de competencia", score: null, notes: "" },
  { key: "opportunities", title: "Oportunidades identificadas", score: null, notes: "" },
];

function mergeSections(saved: DiagnosticSection[]): DiagnosticSection[] {
  const byKey = new Map(saved.map((s) => [s.key, s]));
  return DEFAULT_SECTIONS.map((d) => byKey.get(d.key) ?? d);
}

export function DiagnosticChecklist({
  lead,
  workspaceId,
}: {
  lead: LeadRow;
  workspaceId: string | undefined;
}) {
  const { data: diagnostics = [], isLoading } = useDiagnostics(lead.id);
  const existing = diagnostics[0] as DiagnosticRow | undefined;
  const create = useCreateDiagnostic(workspaceId);
  const update = useUpdateDiagnostic();

  const [sections, setSections] = useState<DiagnosticSection[]>(DEFAULT_SECTIONS);
  const [overallNotes, setOverallNotes] = useState("");

  useEffect(() => {
    if (existing) {
      setSections(mergeSections(existing.sections ?? []));
      setOverallNotes(existing.overall_notes ?? "");
    } else {
      setSections(DEFAULT_SECTIONS);
      setOverallNotes("");
    }
  }, [existing?.id]);

  const avg = useMemo(() => {
    const scored = sections.filter((s) => s.score != null).map((s) => Number(s.score));
    if (scored.length === 0) return null;
    return scored.reduce((a, b) => a + b, 0) / scored.length;
  }, [sections]);

  const updateSection = (i: number, patch: Partial<DiagnosticSection>) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const handleSave = async () => {
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          leadId: lead.id,
          patch: { sections, overall_notes: overallNotes || null },
        });
      } else {
        await create.mutateAsync({
          leadId: lead.id,
          sections,
          overall_notes: overallNotes || null,
        });
      }
      toast.success("Diagnóstico guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 48;

      // Header band
      doc.setFillColor(81, 64, 242); // #5140f2
      doc.rect(0, 0, pageW, 80, "F");
      doc.setFillColor(255, 117, 3); // #ff7503
      doc.rect(0, 80, pageW, 4, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Astratta Agency", marginX, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Diagnóstico / Auditoría", marginX, 62);

      // Meta
      doc.setTextColor(30, 30, 30);
      let y = 120;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(lead.company_name, marginX, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(
        `Contacto: ${lead.contact_name} · ${lead.contact_email}`,
        marginX,
        y,
      );
      y += 14;
      doc.text(`Fecha: ${format(new Date(), "d MMM yyyy")}`, marginX, y);
      if (avg != null) {
        y += 14;
        doc.setTextColor(81, 64, 242);
        doc.setFont("helvetica", "bold");
        doc.text(`Score promedio: ${avg.toFixed(1)} / 5`, marginX, y);
      }
      y += 24;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - 60) {
          doc.addPage();
          y = 60;
        }
      };

      for (const s of sections) {
        ensureSpace(80);
        doc.setDrawColor(255, 117, 3);
        doc.setLineWidth(2);
        doc.line(marginX, y - 4, marginX + 24, y - 4);
        doc.setTextColor(20, 20, 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(s.title, marginX, y + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(90, 90, 90);
        const scoreLabel = s.score != null ? `Score: ${s.score}/5` : "Sin score";
        doc.text(scoreLabel, pageW - marginX, y + 10, { align: "right" });
        y += 24;

        const notes = (s.notes || "—").trim();
        const wrapped = doc.splitTextToSize(notes, pageW - marginX * 2);
        ensureSpace(wrapped.length * 12 + 8);
        doc.setTextColor(50, 50, 50);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 12 + 14;
      }

      if (overallNotes.trim()) {
        ensureSpace(60);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(20, 20, 20);
        doc.text("Notas generales", marginX, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const wrapped = doc.splitTextToSize(overallNotes, pageW - marginX * 2);
        ensureSpace(wrapped.length * 12);
        doc.text(wrapped, marginX, y);
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(
          "astrattaagency.com",
          pageW - marginX,
          pageH - 24,
          { align: "right" },
        );
        doc.text(`Página ${p} de ${pageCount}`, marginX, pageH - 24);
      }

      const filename = `diagnostico-${lead.company_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
      doc.save(filename);

      // Persist pdf_generated_at
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          leadId: lead.id,
          patch: { pdf_generated_at: new Date().toISOString() },
        });
      } else {
        const created = await create.mutateAsync({
          leadId: lead.id,
          sections,
          overall_notes: overallNotes || null,
        });
        await update.mutateAsync({
          id: created.id,
          leadId: lead.id,
          patch: { pdf_generated_at: new Date().toISOString() },
        });
      }
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar el PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando diagnóstico…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {existing?.pdf_generated_at && (
        <p className="text-xs text-muted-foreground">
          Último PDF: {format(new Date(existing.pdf_generated_at), "d MMM yyyy, HH:mm")}
        </p>
      )}

      {sections.map((s, i) => (
        <Card key={s.key}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">{s.title}</h4>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Score</Label>
                <Select
                  value={s.score == null ? "none" : String(s.score)}
                  onValueChange={(v) =>
                    updateSection(i, { score: v === "none" ? null : Number(v) })
                  }
                >
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / 5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              rows={3}
              placeholder="Observaciones…"
              value={s.notes}
              onChange={(e) => updateSection(i, { notes: e.target.value })}
            />
          </CardContent>
        </Card>
      ))}

      <div>
        <Label className="text-xs text-muted-foreground">Notas generales</Label>
        <Textarea
          rows={3}
          value={overallNotes}
          onChange={(e) => setOverallNotes(e.target.value)}
          placeholder="Conclusiones y próximos pasos…"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={handleExportPDF}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
          {(create.isPending || update.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          <Save className="mr-2 h-4 w-4" />
          Guardar
        </Button>
      </div>
    </div>
  );
}
