import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  formatPeriod,
  useCreateClientReport,
  useMonthPostsForClient,
  useUpdateClientReport,
  type ClientReportRow,
  type ReportKpi,
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
  const [kpis, setKpis] = useState<ReportKpi[]>([]);
  const [topPosts, setTopPosts] = useState<ReportTopPost[]>([]);
  const [learnings, setLearnings] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [recommendations, setRecommendations] = useState("");

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
      setKpis(report.kpis ?? []);
      setTopPosts(report.top_posts ?? []);
      setLearnings(report.learnings ?? "");
      setNextPlan(report.next_month_plan ?? "");
      setRecommendations(report.recommendations ?? "");
    } else {
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      setTitle(`Reporte ${MONTHS[m - 1]} ${y}`);
      setMonth(m);
      setYear(y);
      setSummary("");
      setKpis([]);
      setTopPosts([]);
      setLearnings("");
      setNextPlan("");
      setRecommendations("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, report?.id]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (asPublished: boolean) => {
    if (!title.trim()) {
      toast({ title: "El título es requerido", variant: "destructive" });
      return;
    }
    try {
      if (editing && report) {
        await update.mutateAsync({
          id: report.id,
          patch: {
            title,
            period_month: month,
            period_year: year,
            executive_summary: summary || null,
            kpis,
            top_posts: topPosts,
            learnings: learnings || null,
            next_month_plan: nextPlan || null,
            recommendations: recommendations || null,
            status: asPublished ? "published" : report.status,
          },
        });
      } else {
        await create.mutateAsync({
          workspace_id: workspaceId,
          client_id: clientId,
          title,
          period_month: month,
          period_year: year,
          executive_summary: summary || null,
          kpis,
          top_posts: topPosts,
          learnings: learnings || null,
          next_month_plan: nextPlan || null,
          recommendations: recommendations || null,
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

  const addKpi = () =>
    setKpis((prev) => [...prev, { label: "", value: "", previous_value: "", unit: "" }]);
  const updateKpi = (i: number, patch: Partial<ReportKpi>) =>
    setKpis((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  const removeKpi = (i: number) => setKpis((prev) => prev.filter((_, idx) => idx !== i));

  const addPostFromExisting = (postId: string) => {
    const p = (monthPosts.data ?? []).find((x: any) => x.id === postId);
    if (!p) return;
    setTopPosts((prev) => [
      ...prev,
      {
        social_post_id: p.id,
        caption_snapshot: (p.caption ?? p.title ?? "").slice(0, 500),
        note: "",
      },
    ]);
  };
  const addFreeNote = () =>
    setTopPosts((prev) => [...prev, { social_post_id: null, caption_snapshot: "", note: "" }]);
  const updatePost = (i: number, patch: Partial<ReportTopPost>) =>
    setTopPosts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePost = (i: number) =>
    setTopPosts((prev) => prev.filter((_, idx) => idx !== i));

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar reporte" : "Nuevo reporte"}</DialogTitle>
          <DialogDescription>
            {clientName} · {formatPeriod(month, year)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Título + período */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Reporte Julio 2026"
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

          {/* Resumen ejecutivo */}
          <div className="space-y-2">
            <Label>Resumen ejecutivo</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Resumen del período, hallazgos clave y contexto."
            />
          </div>

          {/* KPIs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>KPIs</Label>
              <Button type="button" size="sm" variant="outline" onClick={addKpi}>
                <Plus className="h-4 w-4" /> Agregar KPI
              </Button>
            </div>
            {kpis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aún no hay KPIs. Agregá al menos uno con métrica clave del mes.
              </p>
            ) : (
              <div className="space-y-2">
                {kpis.map((k, i) => (
                  <Card key={i} className="border-dashed">
                    <CardContent className="grid grid-cols-1 gap-2 p-3 md:grid-cols-12">
                      <Input
                        className="md:col-span-4"
                        placeholder="Etiqueta (ej: Alcance IG)"
                        value={k.label}
                        onChange={(e) => updateKpi(i, { label: e.target.value })}
                      />
                      <Input
                        className="md:col-span-3"
                        placeholder="Valor"
                        value={k.value}
                        onChange={(e) => updateKpi(i, { value: e.target.value })}
                      />
                      <Input
                        className="md:col-span-3"
                        placeholder="Valor anterior"
                        value={k.previous_value ?? ""}
                        onChange={(e) => updateKpi(i, { previous_value: e.target.value })}
                      />
                      <Input
                        className="md:col-span-1"
                        placeholder="Unidad"
                        value={k.unit ?? ""}
                        onChange={(e) => updateKpi(i, { unit: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="md:col-span-1 text-destructive"
                        onClick={() => removeKpi(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Top posts */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Top posts del mes</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select onValueChange={(v) => addPostFromExisting(v)} value="">
                  <SelectTrigger className="h-9 w-[260px]">
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
                  <Plus className="h-4 w-4" /> Nota libre
                </Button>
              </div>
            </div>
            {topPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Podés seleccionar publicaciones existentes o escribir una nota libre.
              </p>
            ) : (
              <div className="space-y-2">
                {topPosts.map((p, i) => (
                  <Card key={i} className="border-dashed">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Textarea
                          className="flex-1"
                          rows={2}
                          placeholder="Caption / descripción del post"
                          value={p.caption_snapshot ?? ""}
                          onChange={(e) => updatePost(i, { caption_snapshot: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removePost(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Nota (opcional) — por qué es un top post"
                        value={p.note ?? ""}
                        onChange={(e) => updatePost(i, { note: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Aprendizajes / plan / recomendaciones */}
          <div className="space-y-2">
            <Label>Aprendizajes</Label>
            <Textarea rows={3} value={learnings} onChange={(e) => setLearnings(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Plan próximo mes</Label>
            <Textarea rows={3} value={nextPlan} onChange={(e) => setNextPlan(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Recomendaciones</Label>
            <Textarea
              rows={3}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
            />
          </div>
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
