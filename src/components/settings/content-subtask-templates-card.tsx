import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  useContentTaskTemplates,
  useUpsertContentTaskTemplate,
  useDeleteContentTaskTemplate,
  SUBTASK_KEY_LABEL,
  CONTENT_ROLE_LABEL,
  POST_TYPE_OPTIONS,
  type ContentTaskTemplate,
  type ContentRoleKey,
  type ContentTaskPostType,
} from "@/hooks/useContentSubtasks";
import { TYPE_LABEL } from "@/lib/task-labels";
import type { TaskType } from "@/hooks/useTasks";

interface Props {
  workspaceId: string;
  isOwner: boolean;
}

const TASK_TYPES: TaskType[] = ["produccion", "revision", "aprobacion", "reunion", "admin"];

export function ContentSubtaskTemplatesCard({ workspaceId, isOwner }: Props) {
  const { data: templates = [], isLoading } = useContentTaskTemplates(workspaceId);
  const upsert = useUpsertContentTaskTemplate(workspaceId);
  const del = useDeleteContentTaskTemplate(workspaceId);

  const [editing, setEditing] = useState<Partial<ContentTaskTemplate> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContentTaskTemplate | null>(null);

  const handleToggleActive = async (t: ContentTaskTemplate) => {
    try {
      await upsert.mutateAsync({ id: t.id, patch: { is_active: !t.is_active } });
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const handleSave = async (draft: Partial<ContentTaskTemplate>) => {
    try {
      await upsert.mutateAsync({
        id: draft.id,
        patch: {
          post_type: draft.post_type ?? null,
          subtask_key: draft.subtask_key!,
          title: draft.title ?? "",
          task_type: (draft.task_type ?? "produccion") as TaskType,
          default_role: draft.default_role ?? null,
          offset_days: Number(draft.offset_days ?? 0),
          sort_order: Number(draft.sort_order ?? 0),
          is_active: draft.is_active ?? true,
        },
      });
      toast.success(draft.id ? "Plantilla actualizada" : "Plantilla creada");
      setEditing(null);
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Plantilla eliminada");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantillas de subtareas de contenido</CardTitle>
        <CardDescription>
          Cada publicación del calendario genera automáticamente estas subtareas al pasar a Borrador.
          La fecha límite se calcula restando "Offset" a la fecha programada del post.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : templates.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aún no hay plantillas.
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{t.title || "(sin título)"}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {SUBTASK_KEY_LABEL[t.subtask_key]}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.post_type
                        ? POST_TYPE_OPTIONS.find((p) => p.value === t.post_type)?.label ?? t.post_type
                        : "Todos los tipos"}
                    </Badge>
                    {!t.is_active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {TYPE_LABEL[t.task_type]} ·{" "}
                    {t.default_role ? CONTENT_ROLE_LABEL[t.default_role] : "Sin asignar"} ·{" "}
                    {t.offset_days === 0 ? "El día del post" : `${t.offset_days}d antes`}
                  </div>
                </div>
                {isOwner && (
                  <>
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={() => handleToggleActive(t)}
                      aria-label="Activo"
                    />
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setConfirmDelete(t)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && (
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setEditing({
                  subtask_key: "copywriting",
                  title: "",
                  task_type: "produccion",
                  default_role: null,
                  offset_days: 0,
                  sort_order: (templates[templates.length - 1]?.sort_order ?? 0) + 10,
                  is_active: true,
                  post_type: null,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar plantilla
            </Button>
          </div>
        )}
      </CardContent>

      {editing && (
        <TemplateDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          isPending={upsert.isPending}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{confirmDelete?.title || "(sin título)"}". Los posts existentes ya
              creados no se verán afectados; solo dejarán de generarse nuevas subtareas con esta
              plantilla.
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

function TemplateDialog({
  template,
  onClose,
  onSave,
  isPending,
}: {
  template: Partial<ContentTaskTemplate>;
  onClose: () => void;
  onSave: (t: Partial<ContentTaskTemplate>) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState<Partial<ContentTaskTemplate>>(template);
  useEffect(() => setDraft(template), [template]);

  const patch = (p: Partial<ContentTaskTemplate>) => setDraft((d) => ({ ...d, ...p }));
  const isNew = !template.id;
  const canSave = !!draft.title?.trim() && !!draft.subtask_key;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nueva plantilla" : "Editar plantilla"}</DialogTitle>
          <DialogDescription>
            Podés usar el placeholder <code className="rounded bg-muted px-1 text-xs">{`{{post_title}}`}</code>{" "}
            en el título — se reemplazará por el título del post al generar la subtarea.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              value={draft.title ?? ""}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Ej: Copywriting — {{post_title}}"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Identificador (subtask_key)</Label>
              <Select
                value={draft.subtask_key}
                onValueChange={(v) => patch({ subtask_key: v as ContentTaskTemplate["subtask_key"] })}
                disabled={!isNew}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBTASK_KEY_LABEL) as (keyof typeof SUBTASK_KEY_LABEL)[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SUBTASK_KEY_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isNew && (
                <p className="text-[11px] text-muted-foreground">
                  El identificador interno no se puede modificar.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de post</Label>
              <Select
                value={draft.post_type ?? "__all__"}
                onValueChange={(v) =>
                  patch({ post_type: v === "__all__" ? null : (v as ContentTaskPostType) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los tipos</SelectItem>
                  {POST_TYPE_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de tarea</Label>
              <Select
                value={draft.task_type ?? "produccion"}
                onValueChange={(v) => patch({ task_type: v as TaskType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Responsable default</Label>
              <Select
                value={draft.default_role ?? "__none__"}
                onValueChange={(v) =>
                  patch({ default_role: v === "__none__" ? null : (v as ContentRoleKey) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  <SelectItem value="content_creator">Content creator</SelectItem>
                  <SelectItem value="designer">Diseñador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Offset (días antes del post)</Label>
              <Input
                type="number"
                value={draft.offset_days ?? 0}
                onChange={(e) => patch({ offset_days: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">
                0 = mismo día del post. 3 = tres días antes de la fecha programada.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Orden</Label>
              <Input
                type="number"
                value={draft.sort_order ?? 0}
                onChange={(e) => patch({ sort_order: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Activa</Label>
              <p className="text-xs text-muted-foreground">
                Solo las plantillas activas generan subtareas al crear un borrador.
              </p>
            </div>
            <Switch
              checked={draft.is_active ?? true}
              onCheckedChange={(v) => patch({ is_active: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)} disabled={!canSave || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
