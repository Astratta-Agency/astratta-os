import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUpdateWorkspace,
  useWorkspaceDetail,
  type WorkspaceService,
} from "@/hooks/useWorkspaceSettings";

interface Props {
  workspaceId: string | undefined;
  isOwner: boolean;
}

function emptyService(): WorkspaceService {
  return {
    id: (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())),
    name: "",
    description: "",
    price: null,
    unit: "",
  };
}

export function WorkspaceServicesCard({ workspaceId, isOwner }: Props) {
  const { data: ws, isLoading } = useWorkspaceDetail(workspaceId);
  const update = useUpdateWorkspace(workspaceId);

  const [services, setServices] = useState<WorkspaceService[]>([]);
  const [initial, setInitial] = useState<string>("[]");

  useEffect(() => {
    if (ws) {
      setServices(ws.services ?? []);
      setInitial(JSON.stringify(ws.services ?? []));
    }
  }, [ws]);

  const isDirty = useMemo(() => JSON.stringify(services) !== initial, [services, initial]);

  const add = () => setServices((s) => [...s, emptyService()]);
  const remove = (id: string) => setServices((s) => s.filter((x) => x.id !== id));
  const patch = (id: string, p: Partial<WorkspaceService>) =>
    setServices((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const onSave = async () => {
    try {
      await update.mutateAsync({ services });
      setInitial(JSON.stringify(services));
      toast.success("Servicios actualizados");
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servicios que ofrece la agencia</CardTitle>
        <CardDescription>
          Catálogo interno que podés reutilizar en propuestas y facturas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <Label className="text-xs text-muted-foreground">Nombre</Label>
                  <Input
                    value={s.name}
                    disabled={!isOwner}
                    onChange={(e) => patch(s.id, { name: e.target.value })}
                    placeholder="Community management"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-xs text-muted-foreground">Descripción</Label>
                  <Input
                    value={s.description}
                    disabled={!isOwner}
                    onChange={(e) => patch(s.id, { description: e.target.value })}
                    placeholder="Ej: 12 posts/mes + stories"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Precio</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      className="pl-6"
                      value={s.price ?? ""}
                      disabled={!isOwner}
                      onChange={(e) =>
                        patch(s.id, {
                          price: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="A cotizar"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Unidad</Label>
                  <Input
                    value={s.unit}
                    disabled={!isOwner}
                    onChange={(e) => patch(s.id, { unit: e.target.value })}
                    placeholder="/mes"
                  />
                </div>
                <div className="flex items-end justify-end sm:col-span-1">
                  {isOwner && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(s.id)}
                      aria-label="Eliminar servicio"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between pt-1">
          {isOwner ? (
            <Button type="button" size="sm" variant="outline" onClick={add}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar servicio
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={onSave} disabled={!isOwner || !isDirty || update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
