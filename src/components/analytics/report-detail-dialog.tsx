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
  splitItems,
  type ClientReportRow,
  type ReportTopPost,
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

  // Numeración dinámica de secciones, como en la plantilla PDF.
  let sectionNo = 0;
  const Section = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => {
    sectionNo += 1;
    return (
      <section className="space-y-3">
        <div>
          <h3
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {String(sectionNo).padStart(2, "0")} — {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-lg font-semibold text-foreground">{subtitle}</p>
          )}
        </div>
        <div className="text-sm text-foreground">{children}</div>
      </section>
    );
  };

  const StatRow = ({
    stats,
    big,
  }: {
    stats: Array<{ value: string; label: string; detail?: string }>;
    big?: boolean;
  }) => (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
    >
      {stats.slice(0, 4).map((s, i) => (
        <div key={i}>
          <div className={big ? "text-3xl font-bold text-foreground" : "text-2xl font-bold text-foreground"}>
            {s.value || "—"}
          </div>
          <div
            className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {s.label}
          </div>
          {s.detail && (
            <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
          )}
        </div>
      ))}
    </div>
  );

  const NumberedList = ({ items }: { items: string[] }) => (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: accent }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );

  // Tabla comparativa de KPIs por plataforma
  const platformKpis = report.platform_kpis ?? [];
  const metricLabels: string[] = [];
  for (const p of platformKpis) {
    for (const m of p.metrics ?? []) {
      if (m.label && !metricLabels.includes(m.label)) metricLabels.push(m.label);
    }
  }

  // Top posts agrupados por plataforma
  const topPostsByPlatform = new Map<string, ReportTopPost[]>();
  for (const tp of report.top_posts ?? []) {
    const key = tp.platform?.trim() || "General";
    if (!topPostsByPlatform.has(key)) topPostsByPlatform.set(key, []);
    topPostsByPlatform.get(key)!.push(tp);
  }

  const learningItems = splitItems(report.learnings);
  const planItems = splitItems(report.next_month_plan);
  const recoItems = splitItems(report.recommendations);

  const hasSummarySection =
    !!report.executive_summary ||
    (report.hero_stats?.length ?? 0) > 0 ||
    platformKpis.length > 0 ||
    (report.kpis?.length ?? 0) > 0;

  const hl = report.highlight;
  const hasHighlight = !!(hl && (hl.title || hl.description || hl.stats?.length));

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

        <div className="space-y-8">
          {hasSummarySection && (
            <Section title="Resumen ejecutivo">
              <div className="space-y-4">
                {(report.hero_stats?.length ?? 0) > 0 && (
                  <StatRow stats={report.hero_stats} big />
                )}

                {platformKpis.length > 0 && metricLabels.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            KPI
                          </th>
                          {platformKpis.map((p, i) => (
                            <th
                              key={i}
                              className="p-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {p.platform}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metricLabels.map((label, li) => (
                          <tr key={li} className="border-t border-border">
                            <td className="p-2 font-medium text-foreground">{label}</td>
                            {platformKpis.map((p, pi) => (
                              <td key={pi} className="p-2 text-muted-foreground">
                                {(p.metrics ?? []).find((m) => m.label === label)?.value ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* KPIs simples (compatibilidad con reportes anteriores) */}
                {(report.kpis?.length ?? 0) > 0 && platformKpis.length === 0 && (
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
                              {k.unit ? (
                                <span className="ml-1 text-base font-medium text-muted-foreground">
                                  {k.unit}
                                </span>
                              ) : null}
                            </div>
                            {k.previous_value ? (
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span>Anterior: {k.previous_value}</span>
                                {delta !== null && (
                                  <span
                                    className={
                                      up
                                        ? "flex items-center gap-1 text-emerald-600"
                                        : "flex items-center gap-1 text-red-600"
                                    }
                                  >
                                    {up ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3" />
                                    )}
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
                )}

                {report.executive_summary && (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    <span className="font-semibold">Lectura rápida: </span>
                    {report.executive_summary}
                  </p>
                )}
              </div>
            </Section>
          )}

          {hasHighlight && hl && (
            <Section title="Highlight del período" subtitle={hl.title || undefined}>
              <div className="space-y-4">
                {hl.description && (
                  <p className="whitespace-pre-wrap leading-relaxed">{hl.description}</p>
                )}
                {(hl.stats?.length ?? 0) > 0 && <StatRow stats={hl.stats!} />}
                {hl.footer_note && (
                  <p className="text-sm italic text-muted-foreground">{hl.footer_note}</p>
                )}
              </div>
            </Section>
          )}

          {topPostsByPlatform.size > 0 && (
            <Section title="Top posts del período" subtitle="Lo que mejor funcionó.">
              <div className="space-y-5">
                {[...topPostsByPlatform.entries()].map(([platform, posts]) => (
                  <div key={platform} className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wide text-foreground">
                      {platform}
                    </div>
                    <ul className="space-y-2">
                      {posts.map((p, i) => (
                        <li key={i} className="rounded-md border border-border p-3">
                          <div className="flex items-start gap-2">
                            <span
                              className="text-sm font-bold tabular-nums"
                              style={{ color: accent }}
                            >
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              {p.caption_snapshot && (
                                <p className="whitespace-pre-wrap text-sm font-medium text-foreground">
                                  {p.caption_snapshot}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                {p.format && <span>{p.format}</span>}
                                {p.post_date && <span>{p.post_date}</span>}
                                {(p.metrics ?? [])
                                  .filter((m) => m.label || m.value)
                                  .map((m, mi) => (
                                    <span key={mi}>
                                      <span className="font-medium text-foreground">
                                        {m.value}
                                      </span>{" "}
                                      {m.label.toLowerCase()}
                                    </span>
                                  ))}
                              </div>
                              {p.note && (
                                <p className="mt-1 text-xs italic text-muted-foreground">
                                  {p.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {(report.audience?.length ?? 0) > 0 && (
            <Section title="Audiencia" subtitle="Quién está viendo.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {report.audience.map((a, i) => (
                  <div key={i} className="space-y-1">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: accent }}
                    >
                      {a.title}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {learningItems.length > 0 && (
            <Section title="Aprendizajes" subtitle="Lo que el período nos enseñó.">
              <NumberedList items={learningItems} />
            </Section>
          )}

          {(planItems.length > 0 || recoItems.length > 0) && (
            <Section title="Plan de acción" subtitle="Recomendaciones para el próximo período.">
              <div className="space-y-4">
                {planItems.length > 0 && <NumberedList items={planItems} />}
                {recoItems.length > 0 && (
                  <div className="space-y-2">
                    {planItems.length > 0 && (
                      <div
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: accent }}
                      >
                        Recomendaciones adicionales
                      </div>
                    )}
                    <NumberedList items={recoItems} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {report.data_notes && (
            <section className="space-y-2 border-t border-border pt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Notas de producción y datos
              </h4>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {report.data_notes}
              </p>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
