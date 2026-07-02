import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Globe, Instagram, Target, Palette, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUpdateWorkspace,
  useWorkspaceDetail,
  SERVICE_PRICE_TYPE_LABEL,
  SERVICE_PRICE_TYPE_SUFFIX,
  type WorkspaceService,
  type ServicePriceType,
} from "@/hooks/useWorkspaceSettings";
import { PROJECT_TYPES, PROJECT_TYPE_LABEL } from "@/components/projects/project-meta";
import type { ProjectType } from "@/integrations/supabase/database.types";
import { formatMoney } from "@/lib/money";

interface Props {
  workspaceId: string | undefined;
  isOwner: boolean;
}

const CATEGORY_ICON: Record<ProjectType, React.ComponentType<{ className?: string }>> = {
  web_dev: Globe,
  social_media: Instagram,
  paid_ads: Target,
  graphic_design: Palette,
  branding: Sparkles,
  audit: Search,
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
}

function emptyService(): WorkspaceService {
  return {
    id: newId(),
    category: "social_media",
    name: "",
    description: "",
    target_audience: "",
    not_included: "",
    expected_result: "",
    price: null,
    price_type: "one_time",
  };
}

export function WorkspaceServicesCard({ workspaceId, isOwner }: Props) {
  const { data: ws, isLoading } = useWorkspaceDetail(workspaceId);
  const update = useUpdateWorkspace(workspaceId);

  const [services, setServices] = useState<WorkspaceService[]>([]);
  const [editing, setEditing] = useState<WorkspaceService | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WorkspaceService | null>(null);

  useEffect(() => {
    if (ws) setServices(ws.services ?? []);
  }, [ws]);

  const grouped = useMemo(() => {
    const map = new Map<ProjectType, WorkspaceService[]>();
    for (const s of services) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return map;
  }, [services]);

  const persist = async (next: WorkspaceService[]) => {
    try {
      await update.mutateAsync({ services: next });
      setServices(next);
      toast.success("Servicios actualizados");
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  const handleSaveService = (svc: WorkspaceService) => {
    const exists = services.some((s) => s.id === svc.id);
    const next = exists ? services.map((s) => (s.id === svc.id ? svc : s)) : [...services, svc];
    persist(next);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    persist(services.filter((s) => s.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servicios que ofrece la agencia</CardTitle>
        <CardDescription>
          Catálogo interno agrupado por categoría, reutilizable en propuestas y facturas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : services.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aún no hay servicios cargados.
          </div>
        ) : (
          PROJECT_TYPES.map((cat) => {
            const list = grouped.get(cat) ?? [];
            if (list.length === 0) return null;
            const Icon = CATEGORY_ICON[cat];
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">{PROJECT_TYPE_LABEL[cat]}</h4>
                  <span className="text-xs text-muted-foreground">({list.length})</span>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((s) => (
                    <li key={s.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.name || "(sin nombre)"}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {s.price != null ? (
                              <>
                                {formatMoney(s.price)}
                                <span className="ml-0.5">{SERVICE_PRICE_TYPE_SUFFIX[s.price_type]}</span>
                              </>
                            ) : (
                              <span>Precio a cotizar</span>
                            )}
                          </p>
                          {s.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                          )}
                        </div>
                        {isOwner && (
                          <div className="flex flex-col gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setConfirmDelete(s)}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}

        {isOwner && (
          <div className="pt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(emptyService())}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Agregar servicio
            </Button>
          </div>
        )}
      </CardContent>

      {editing && (
        <ServiceDialog
          service={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveService}
          isPending={update.isPending}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{confirmDelete?.name || "(sin nombre)"}" del catálogo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// -------- Dialog --------

function ServiceDialog({
  service,
  onClose,
  onSave,
  isPending,
}: {
  service: WorkspaceService;
  onClose: () => void;
  onSave: (s: WorkspaceService) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState<WorkspaceService>(service);
  useEffect(() => setDraft(service), [service]);

  const patch = (p: Partial<WorkspaceService>) => setDraft((d) => ({ ...d, ...p }));

  const canSave = draft.name.trim().length > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service.name ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          <DialogDescription>
            Definí los detalles del servicio para reutilizarlo en propuestas y facturas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={draft.category}
                onValueChange={(v) => patch({ category: v as ProjectType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{PROJECT_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Ej: Social Presence"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Qué incluye</Label>
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Alcance del servicio, entregables incluidos..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Público objetivo</Label>
            <Textarea
              rows={2}
              value={draft.target_audience}
              onChange={(e) => patch({ target_audience: e.target.value })}
              placeholder="A quién está dirigido este servicio..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Qué no incluye</Label>
            <Textarea
              rows={2}
              value={draft.not_included}
              onChange={(e) => patch({ not_included: e.target.value })}
              placeholder="Aclaraciones sobre lo que queda fuera del alcance..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Resultado esperado</Label>
            <Textarea
              rows={2}
              value={draft.expected_result}
              onChange={(e) => patch({ expected_result: e.target.value })}
              placeholder="Qué resultado busca obtener el cliente..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Precio</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  className="pl-6"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    patch({ price: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  placeholder="A cotizar"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de precio</Label>
              <Select
                value={draft.price_type}
                onValueChange={(v) => patch({ price_type: v as ServicePriceType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SERVICE_PRICE_TYPE_LABEL) as ServicePriceType[]).map((t) => (
                    <SelectItem key={t} value={t}>{SERVICE_PRICE_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.price != null && (
            <div className="text-xs text-muted-foreground">
              Previsualización: <Badge variant="secondary">{formatMoney(draft.price)}{SERVICE_PRICE_TYPE_SUFFIX[draft.price_type]}</Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(draft)} disabled={!canSave || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
