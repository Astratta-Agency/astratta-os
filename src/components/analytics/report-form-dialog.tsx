import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  STANDARD_PLATFORM_METRICS,
  formatPeriod,
  useCreateClientReport,
  useMonthPostsForClient,
  useUpdateClientReport,
  type ClientReportRow,
  type ReportAudienceBlock,
  type ReportHeroStat,
  type ReportHighlight,
  type ReportMetric,
  type ReportPlatformKpis,
  type ReportTopPost,
} from "@/hooks/useClientReports";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  clientId: string;
  clientName: string;
  /** If present → edit; otherwise → create. */
  report?: ClientReportRow | null;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DEFAULT_PLATFORMS = ["TikTok", "Instagram", "Facebook"];

const EMPTY_HIGHLIGHT: ReportHighlight = {
  title: "",
  description: "",
  stats: [],
  footer_note: "",
};

/** Encabezado de sección numerada, como en la plantilla del reporte. */
function SectionHeader({
  num,
  title,
  hint,
  action,
}: {
  num: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-t border-border pt-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          {num} — {title}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function ReportFormDialog({
  open,
  onOpenChange,
  workspaceId,
  clientId,
  clientName,
  report,
}: Props) {
  const now = new Date();
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [summary, setSummary] = useState("");
  const [heroStats, setHeroStats] = useState<ReportHeroStat[]>([]);
  const [platformKpis, setPlatformKpis] = useState<ReportPlatformKpis[]>([]);
  const [highlight, setHighlight] = useState<ReportHighlight>(EMPTY_HIGHLIGHT);
  const [topPosts, setTopPosts] = useState<ReportTopPost[]>([]);
  const [audience, setAudience] = useState<ReportAudienceBlock[]>([]);
  const [learnings, setLearnings] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [dataNotes, setDataNotes] = useState("");

  const create = useCreateClientReport();
  const update = useUpdateClientReport(clientId);
  const monthPosts = useMonthPostsForClient(clientId, year, month);

  const editing = !!report;

  useEffect(() => {
    if (!open) return;
    if (report) {
      setTitle(report.title);
      setMonth(report.period_month);
      setYear(report.period_year);
      setSummary(report.executive_summary ?? "");
      setHeroStats(report.hero_stats ?? []);
      setPlatformKpis(report.platform_kpis ?? []);
      setHighlight(report.highlight ?? EMPTY_HIGHLIGHT);
      setTopPosts(report.top_posts ?? []);
      setAudience(report.audience ?? []);
      setLearnings(report.learnings ?? "");
      setNextPlan(report.next_month_plan ?? "");
      setRecommendations(report.recommendations ?? "");
      setDataNotes(report.data_notes ?? "");
    } else {
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      setTitle(`Reporte ${MONTHS[m - 1]} ${y}`);
      setMonth(m);
      setYear(y);
      setSummary("");
      setHeroStats([]);
      setPlatformKpis([]);
      setHighlight(EMPTY_HIGHLIGHT);
      setTopPosts([]);
      setAudience([]);
      setLearnings("");
      setNextPlan("");
      setRecommendations("");
      setDataNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, report?.id]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanHighlight = (): ReportHighlight | null => {
    const stats = (highlight.stats ?? []).filter((s) => s.value || s.label);
    const h: ReportHighlight = {
      title: highlight.title?.trim() || undefined,
      description: highlight.description?.trim() || undefined,
      stats: stats.length ? stats : undefined,
      footer_note: highlight.footer_note?.trim() || undefined,
    };
    return h.title || h.description || h.stats?.length || h.footer_note ? h : null;
  };

  const save = async (asPublished: boolean) => {
    if (!title.trim()) {
      toast({ title: "El título es requerido", variant: "destructive" });
      return;
    }
    const payload = {
      title,
      period_month: month,
      period_year: year,
      executive_summary: summary || null,
      hero_stats: heroStats.filter((s) => s.label || s.value),
      platform_kpis: platformKpis
        .filter((p) => p.platform.trim())
        .map((p) => ({
          ...p,
          metrics: p.metrics.filter((m) => m.label || m.value),
        })),
      highlight: cleanHighlight(),
      top_posts: topPosts,
      audience: audience.filter((a) => a.title || a.body),
      learnings: learnings || null,
      next_month_plan: nextPlan || null,
      recommendations: recommendations || null,
      data_notes: dataNotes || null,
    };
    try {
      if (editing && report) {
        await update.mutateAsync({
          id: report.id,
          patch: { ...payload, status: asPublished ? "published" : report.status },
        });
      } else {
        await create.mutateAsync({
          workspace_id: workspaceId,
          client_id: clientId,
          ...payload,
          status: asPublished ? "published" : "draft",
        });
      }
      toast({
        title: asPublished ? "Reporte publicado" : "Reporte guardado como borrador",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  // ---- Hero stats ----
  const addHeroStat = () =>
    setHeroStats((prev) => [...prev, { label: "", value: "", detail: "" }]);
  const updateHeroStat = (i: number, patch: Partial<ReportHeroStat>) =>
    setHeroStats((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeHeroStat = (i: number) =>
    setHeroStats((prev) => prev.filter((_, idx) => idx !== i));

  // ---- Platform KPIs ----
  const addPlatform = (name = "") =>
    setPlatformKpis((prev) => [...prev, { platform: name, metrics: [] }]);
  const seedPlatforms = () =>
    setPlatformKpis(
      DEFAULT_PLATFORMS.map((p) => ({
        platform: p,
        metrics: STANDARD_PLATFORM_METRICS.map((label) => ({ label, value: "" })),
      })),
    );
  const updatePlatform = (i: number, patch: Partial<ReportPlatformKpis>) =>
    setPlatformKpis((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePlatform = (i: number) =>
    setPlatformKpis((prev) => prev.filter((_, idx) => idx !== i));
  const addPlatformMetric = (i: number) =>
    updatePlatform(i, {
      metrics: [...platformKpis[i].metrics, { label: "", value: "" }],
    });
  const updatePlatformMetric = (i: number, mi: number, patch: Partial<ReportMetric>) =>
    updatePlatform(i, {
      metrics: platformKpis[i].metrics.map((m, idx) =>
        idx === mi ? { ...m, ...patch } : m,
      ),
    });
  const removePlatformMetric = (i: number, mi: number) =>
    updatePlatform(i, {
      metrics: platformKpis[i].metrics.filter((_, idx) => idx !== mi),
    });

  // ---- Highlight stats ----
  const addHighlightStat = () =>
    setHighlight((h) => ({
      ...h,
      stats: [...(h.stats ?? []), { value: "", label: "", detail: "" }],
    }));
  const updateHighlightStat = (i: number, patch: Partial<NonNullable<ReportHighlight["stats"]>[number]>) =>
    setHighlight((h) => ({
      ...h,
      stats: (h.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  const removeHighlightStat = (i: number) =>
    setHighlight((h) => ({
      ...h,
      stats: (h.stats ?? []).filter((_, idx) => idx !== i),
    }));

  // ---- Top posts ----
  const addPostFromExisting = (postId: string) => {
    const p = (monthPosts.data ?? []).find((x: any) => x.id === postId);
    if (!p) return;
    setTopPosts((prev) => [
      ...prev,
      {
        social_post_id: p.id,
        platform: Array.isArray(p.channels) ? p.channels[0] ?? "" : "",
        format: "",
        post_date: p.scheduled_for
          ? new Date(p.scheduled_for).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })
          : "",
        caption_snapshot: (p.caption ?? p.title ?? "").slice(0, 500),
        metrics: [],
        note: "",
      },
    ]);
  };
  const addFreeNote = () =>
    setTopPosts((prev) => [
      ...prev,
      {
        social_post_id: null,
        platform: "",
        format: "",
        post_date: "",
        caption_snapshot: "",
        metrics: [],
        note: "",
      },
    ]);
  const updatePost = (i: number, patch: Partial<ReportTopPost>) =>
    setTopPosts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePost = (i: number) =>
    setTopPosts((prev) => prev.filter((_, idx) => idx !== i));
  const addPostMetric = (i: number) =>
    updatePost(i, { metrics: [...(topPosts[i].metrics ?? []), { label: "", value: "" }] });
  const updatePostMetric = (i: number, mi: number, patch: Partial<ReportMetric>) =>
    updatePost(i, {
      metrics: (topPosts[i].metrics ?? []).map((m, idx) =>
        idx === mi ? { ...m, ...patch } : m,
      ),
    });
  const removePostMetric = (i: number, mi: number) =>
    updatePost(i, {
      metrics: (topPosts[i].metrics ?? []).filter((_, idx) => idx !== mi),
    });

  // ---- Audiencia ----
  const addAudienceBlock = (title = "") =>
    setAudience((prev) => [...prev, { title, body: "" }]);
  const updateAudienceBlock = (i: number, patch: Partial<ReportAudienceBlock>) =>
    setAudience((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const removeAudienceBlock = (i: number) =>
    setAudience((prev) => prev.filter((_, idx) => idx !== i));

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar reporte" : "Nuevo reporte"}</DialogTitle>
          <DialogDescription>
            {clientName} · {formatPeriod(month, year)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Título + período */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Reporte de Redes Sociales — Julio 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={m} value={String(idx + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 01 — Resumen ejecutivo */}
          <SectionHeader
            num="01"
            title="Resumen ejecutivo"
            hint="Números grandes del período, tabla de KPIs por plataforma y lectura rápida."
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Stats destacadas (máx. 4)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addHeroStat}
                disabled={heroStats.length >= 4}
              >
                <Plus className="h-4 w-4" /> Agregar stat
              </Button>
            </div>
            {heroStats.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ej: 11,183 Visualizaciones · 314 Interacciones · 49 Clics al sitio · +39 Seguidores.
              </p>
            ) : (
              <div className="space-y-2">
                {heroStats.map((s, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <Input
                      className="md:col-span-3"
                      placeholder="Valor (ej: 11,183)"
                      value={s.value}
                      onChange={(e) => updateHeroStat(i, { value: e.target.value })}
                    />
                    <Input
                      className="md:col-span-4"
                      placeholder="Etiqueta (ej: Visualizaciones)"
                      value={s.label}
                      onChange={(e) => updateHeroStat(i, { label: e.target.value })}
                    />
                    <Input
                      className="md:col-span-4"
                      placeholder="Detalle (ej: total ecosistema)"
                      value={s.detail ?? ""}
                      onChange={(e) => updateHeroStat(i, { detail: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive md:col-span-1"
                      onClick={() => removeHeroStat(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>KPIs por plataforma</Label>
              <div className="flex gap-2">
                {platformKpis.length === 0 && (
                  <Button type="button" size="sm" variant="outline" onClick={seedPlatforms}>
                    <Sparkles className="h-4 w-4" /> TikTok · IG · FB estándar
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => addPlatform()}>
                  <Plus className="h-4 w-4" /> Plataforma
                </Button>
              </div>
            </div>
            {platformKpis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Se muestra como tabla comparativa (KPI × plataforma) en el reporte y el PDF.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {platformKpis.map((p, i) => (
                  <Card key={i} className="border-dashed">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Plataforma (ej: TikTok)"
                          value={p.platform}
                          onChange={(e) => updatePlatform(i, { platform: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          onClick={() => removePlatform(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {p.metrics.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-2">
                          <Input
                            className="flex-1"
                            placeholder="KPI (ej: Visualizaciones)"
                            value={m.label}
                            onChange={(e) =>
                              updatePlatformMetric(i, mi, { label: e.target.value })
                            }
                          />
                          <Input
                            className="w-32"
                            placeholder="Valor"
                            value={m.value}
                            onChange={(e) =>
                              updatePlatformMetric(i, mi, { value: e.target.value })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive"
                            onClick={() => removePlatformMetric(i, mi)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => addPlatformMetric(i)}
                      >
                        <Plus className="h-4 w-4" /> KPI
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Lectura rápida</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="El rol de cada plataforma en 3–5 líneas. Ej: TikTok es el motor de alcance y conversión; Instagram es el canal de comunidad; Facebook depende de los reels."
            />
          </div>

          {/* 02 — Highlight del período */}
          <SectionHeader
            num="02"
            title="Highlight del período"
            hint="La campaña, pico o hito más importante del período."
          />
          <div className="grid grid-cols-1 gap-2">
            <Input
              placeholder="Título (ej: Campaña Día del Padre)"
              value={highlight.title ?? ""}
              onChange={(e) => setHighlight((h) => ({ ...h, title: e.target.value }))}
            />
            <Textarea
              rows={3}
              placeholder="Qué pasó y por qué importa. Ej: la semana del 15–21 de junio fue el pico absoluto del período…"
              value={highlight.description ?? ""}
              onChange={(e) => setHighlight((h) => ({ ...h, description: e.target.value }))}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Stats del highlight (máx. 4)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addHighlightStat}
                disabled={(highlight.stats?.length ?? 0) >= 4}
              >
                <Plus className="h-4 w-4" /> Stat
              </Button>
            </div>
            {(highlight.stats ?? []).map((s, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <Input
                  className="md:col-span-3"
                  placeholder="Valor (ej: 944)"
                  value={s.value}
                  onChange={(e) => updateHighlightStat(i, { value: e.target.value })}
                />
                <Input
                  className="md:col-span-4"
                  placeholder="Etiqueta (ej: Views · Reel top FB)"
                  value={s.label}
                  onChange={(e) => updateHighlightStat(i, { label: e.target.value })}
                />
                <Input
                  className="md:col-span-4"
                  placeholder="Detalle (opcional)"
                  value={s.detail ?? ""}
                  onChange={(e) => updateHighlightStat(i, { detail: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive md:col-span-1"
                  onClick={() => removeHighlightStat(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Input
              placeholder="Nota de cierre (ej: las views venden intención; los CTAs claros convierten)"
              value={highlight.footer_note ?? ""}
              onChange={(e) => setHighlight((h) => ({ ...h, footer_note: e.target.value }))}
            />
          </div>

          {/* 03 — Top posts */}
          <SectionHeader
            num="03"
            title="Top posts del período"
            hint="Se agrupan por plataforma en el reporte. Incluye formato, fecha y métricas."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Select onValueChange={(v) => addPostFromExisting(v)} value="">
                  <SelectTrigger className="h-9 w-[240px]">
                    <SelectValue
                      placeholder={
                        (monthPosts.data ?? []).length === 0
                          ? "Sin posts publicados este mes"
                          : "Agregar post existente"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(monthPosts.data ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {(p.caption ?? p.title ?? "Post").slice(0, 60)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={addFreeNote}>
                  <Plus className="h-4 w-4" /> Manual
                </Button>
              </div>
            }
          />
          {topPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Seleccioná publicaciones existentes o agregá posts manualmente con sus métricas.
            </p>
          ) : (
            <div className="space-y-2">
              {topPosts.map((p, i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="space-y-2 p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                      <Input
                        className="md:col-span-4"
                        placeholder="Plataforma (ej: TikTok)"
                        value={p.platform ?? ""}
                        onChange={(e) => updatePost(i, { platform: e.target.value })}
                      />
                      <Input
                        className="md:col-span-4"
                        placeholder="Formato (Reel, Carrusel, Video…)"
                        value={p.format ?? ""}
                        onChange={(e) => updatePost(i, { format: e.target.value })}
                      />
                      <Input
                        className="md:col-span-3"
                        placeholder="Fecha (ej: 20 jun)"
                        value={p.post_date ?? ""}
                        onChange={(e) => updatePost(i, { post_date: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive md:col-span-1"
                        onClick={() => removePost(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder='Título / caption del post (ej: "El regalo que tu papá REALMENTE necesita")'
                      value={p.caption_snapshot ?? ""}
                      onChange={(e) => updatePost(i, { caption_snapshot: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {(p.metrics ?? []).map((m, mi) => (
                        <div key={mi} className="flex items-center gap-1">
                          <Input
                            className="h-8 w-28"
                            placeholder="Métrica"
                            value={m.label}
                            onChange={(e) => updatePostMetric(i, mi, { label: e.target.value })}
                          />
                          <Input
                            className="h-8 w-20"
                            placeholder="Valor"
                            value={m.value}
                            onChange={(e) => updatePostMetric(i, mi, { value: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removePostMetric(i, mi)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => addPostMetric(i)}
                      >
                        <Plus className="h-4 w-4" /> Métrica
                      </Button>
                    </div>
                    <Input
                      placeholder="Nota (opcional) — por qué es un top post o qué valida"
                      value={p.note ?? ""}
                      onChange={(e) => updatePost(i, { note: e.target.value })}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 04 — Audiencia */}
          <SectionHeader
            num="04"
            title="Audiencia"
            hint="Quién está viendo: demografía, geografía, alertas."
            action={
              <div className="flex gap-2">
                {audience.length === 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addAudienceBlock("Demografía");
                      addAudienceBlock("Geografía");
                    }}
                  >
                    <Sparkles className="h-4 w-4" /> Demografía + Geografía
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => addAudienceBlock()}>
                  <Plus className="h-4 w-4" /> Bloque
                </Button>
              </div>
            }
          />
          {audience.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Opcional. Ej: "Dominan mujeres 35–64…" / "Parte del alcance no está en el mercado local…".
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {audience.map((a, i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Título (ej: Geografía — alerta)"
                        value={a.title}
                        onChange={(e) => updateAudienceBlock(i, { title: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        onClick={() => removeAudienceBlock(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Qué dicen los datos y qué implica para el cliente."
                      value={a.body}
                      onChange={(e) => updateAudienceBlock(i, { body: e.target.value })}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 05 — Aprendizajes */}
          <SectionHeader
            num="05"
            title="Aprendizajes"
            hint="Un aprendizaje por línea — se numeran automáticamente (01, 02, 03…)."
          />
          <Textarea
            rows={5}
            value={learnings}
            onChange={(e) => setLearnings(e.target.value)}
            placeholder={"Cada plataforma tiene un formato ganador distinto.\nLas campañas con nombre propio funcionan.\nViews ≠ conversión: los CTAs claros mueven la aguja."}
          />

          {/* 06 — Plan de acción */}
          <SectionHeader
            num="06"
            title="Plan de acción"
            hint="Una acción por línea — se numeran automáticamente. Sé específico: qué, cuánto y cuándo."
          />
          <Textarea
            rows={5}
            value={nextPlan}
            onChange={(e) => setNextPlan(e.target.value)}
            placeholder={"Subir frecuencia en TikTok a 2–3 videos/semana, publicando 7:00–9:00 PM.\nCTA doble (link en bio + teléfono) en el 100% de las piezas."}
          />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Recomendaciones adicionales (opcional, una por línea)
            </Label>
            <Textarea
              rows={3}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Pedidos al cliente, pendientes para el próximo reporte, etc."
            />
          </div>

          {/* Notas de datos */}
          <SectionHeader
            num="07"
            title="Notas de producción y datos"
            hint="Fuentes, exports procesados y limitaciones de los datos. Aparece en letra pequeña al final."
          />
          <Textarea
            rows={3}
            value={dataNotes}
            onChange={(e) => setDataNotes(e.target.value)}
            placeholder="Ej: exports procesados, días sin dato, métricas subestimadas, si el desempeño es 100% orgánico…"
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
              Guardar borrador
            </Button>
            <Button onClick={() => save(true)} disabled={busy}>
              {editing && report?.status === "published" ? "Guardar cambios" : "Publicar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
