import { Download, TrendingDown, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatPeriod,
  type ClientReportRow,
} from "@/hooks/useClientReports";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  report: ClientReportRow | null;
  clientName: string;
  /** When true, use portal branding colors. */
  portalStyle?: boolean;
}

function trendDelta(current: string, previous?: string) {
  const c = parseFloat(current.replace(/[^0-9.-]/g, ""));
  const p = previous ? parseFloat(previous.replace(/[^0-9.-]/g, "")) : NaN;
  if (isNaN(c) || isNaN(p) || p === 0) return null;
  const diff = ((c - p) / Math.abs(p)) * 100;
  return diff;
}

export function ReportDetailDialog({
  open,
  onOpenChange,
  report,
  clientName,
  portalStyle,
}: Props) {
  if (!report) return null;
  const accent = portalStyle ? "var(--portal-primary)" : "hsl(var(--primary))";

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {title}
      </h3>
      <div className="text-sm text-foreground">{children}</div>
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {report.title}
            <Badge variant={report.status === "published" ? "default" : "secondary"}>
              {report.status === "published" ? "Publicado" : "Borrador"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {clientName} · {formatPeriod(report.period_month, report.period_year)}
          </DialogDescription>
        </DialogHeader>

        {report.pdf_public_url && (
          <div>
            <Button
              asChild
              size="sm"
              style={portalStyle ? { backgroundColor: accent, color: "white" } : undefined}
            >
              <a href={report.pdf_public_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" /> Descargar PDF
              </a>
            </Button>
          </div>
        )}

        <div className="space-y-6">
          {report.executive_summary && (
            <Section title="Resumen ejecutivo">
              <p className="whitespace-pre-wrap leading-relaxed">{report.executive_summary}</p>
            </Section>
          )}

          {report.kpis?.length > 0 && (
            <Section title="KPIs del período">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {report.kpis.map((k, i) => {
                  const delta = trendDelta(k.value, k.previous_value);
                  const up = delta !== null && delta >= 0;
                  return (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {k.label || "—"}
                        </div>
                        <div className="mt-1 text-2xl font-bold text-foreground">
                          {k.value || "—"}
                          {k.unit ? <span className="ml-1 text-base font-medium text-muted-foreground">{k.unit}</span> : null}
                        </div>
                        {k.previous_value ? (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Anterior: {k.previous_value}</span>
                            {delta !== null && (
                              <span
                                className={
                                  up ? "flex items-center gap-1 text-emerald-600" : "flex items-center gap-1 text-red-600"
                                }
                              >
                                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {delta.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          {report.top_posts?.length > 0 && (
            <Section title="Top posts del mes">
              <ul className="space-y-2">
                {report.top_posts.map((p, i) => (
                  <li key={i} className="rounded-md border border-border p-3">
                    {p.caption_snapshot && (
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {p.caption_snapshot}
                      </p>
                    )}
                    {p.note && (
                      <p className="mt-1 text-xs text-muted-foreground">Nota: {p.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {report.learnings && (
            <Section title="Aprendizajes">
              <p className="whitespace-pre-wrap leading-relaxed">{report.learnings}</p>
            </Section>
          )}
          {report.next_month_plan && (
            <Section title="Plan próximo mes">
              <p className="whitespace-pre-wrap leading-relaxed">{report.next_month_plan}</p>
            </Section>
          )}
          {report.recommendations && (
            <Section title="Recomendaciones">
              <p className="whitespace-pre-wrap leading-relaxed">{report.recommendations}</p>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
