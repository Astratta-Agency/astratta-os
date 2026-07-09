import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABEL,
} from "@/components/projects/project-meta";
import { PRIORITY_CLASS, PRIORITY_LABEL, TYPE_LABEL } from "@/lib/task-labels";
import type { ProjectType } from "@/integrations/supabase/database.types";
import {
  useDeleteTemplateTask,
  useProjectTemplateTasks,
  useProjectTemplates,
  useReorderTemplateTask,
  useUpdateProjectTemplate,
  type ProjectTemplate,
  type ProjectTemplateTask,
} from "@/hooks/useProjectTemplates";
import { TemplateTaskDialog } from "./template-task-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | undefined;
}

export function ProjectTemplatesSheet({ open, onOpenChange, workspaceId }: Props) {
  const { data: templates = [], isLoading } = useProjectTemplates(workspaceId);
  const [selectedType, setSelectedType] = useState<ProjectType>("web_dev");

  const template = useMemo(
    () => templates.find((t) => t.project_type === selectedType) ?? null,
    [templates, selectedType],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Plantillas de onboarding</SheetTitle>
          <SheetDescription>
            Al crear un proyecto, estas tareas se generan automáticamente según su tipo. Las fechas
            límite se calculan sumando los días indicados a la fecha de inicio del proyecto.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-wrap gap-2">
          {PROJECT_TYPES.map((t) => {
            const tpl = templates.find((x) => x.project_type === t);
            const active = t === selectedType;
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
              >
                {PROJECT_TYPE_LABEL[t]}
                {tpl && !tpl.is_active ? (
                  <span className={cn("ml-1.5", active ? "opacity-80" : "text-muted-foreground")}>
                    · off
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <Separator className="my-6" />

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : template ? (
          <TemplateEditor template={template} />
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay plantilla para este tipo.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TemplateEditor({ template }: { template: ProjectTemplate }) {
  const { data: tasks = [], isLoading } = useProjectTemplateTasks(template.id);
  const update = useUpdateProjectTemplate();
  const reorder = useReorderTemplateTask();
  const remove = useDeleteTemplateTask();

  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(template.name);
    setDescription(template.description ?? "");
    setDirty(false);
  }, [template.id, template.name, template.description]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTemplateTask | null>(null);
  const [parentTask, setParentTask] = useState<ProjectTemplateTask | null>(null);

  const parents = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ProjectTemplateTask[]>();
    for (const t of tasks) {
      if (!t.parent_id) continue;
      const arr = map.get(t.parent_id) ?? [];
      arr.push(t);
      map.set(t.parent_id, arr);
    }
    return map;
  }, [tasks]);

  const openCreate = () => {
    setEditingTask(null);
    setParentTask(null);
    setDialogOpen(true);
  };
  const openCreateSub = (parent: ProjectTemplateTask) => {
    setEditingTask(null);
    setParentTask(parent);
    setDialogOpen(true);
  };
  const openEdit = (t: ProjectTemplateTask) => {
    setEditingTask(t);
    setParentTask(null);
    setDialogOpen(true);
  };

  const saveMeta = async () => {
    if (!name.trim()) return;
    try {
      await update.mutateAsync({
        id: template.id,
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success("Plantilla actualizada");
      setDirty(false);
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const toggleActive = async (v: boolean) => {
    try {
      await update.mutateAsync({ id: template.id, is_active: v });
      toast.success(v ? "Plantilla activada" : "Plantilla desactivada");
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const move = async (siblings: ProjectTemplateTask[], index: number, dir: -1 | 1) => {
    const a = siblings[index];
    const b = siblings[index + dir];
    if (!a || !b) return;
    try {
      await reorder.mutateAsync({
        template_id: template.id,
        a: { id: a.id, position: a.position },
        b: { id: b.id, position: b.position },
      });
    } catch (e: any) {
      toast.error("No se pudo reordenar", { description: e?.message });
    }
  };

  const handleDelete = async (t: ProjectTemplateTask) => {
    if (!confirm(`¿Eliminar "${t.title}" de la plantilla?`)) return;
    try {
      await remove.mutateAsync({ id: t.id, template_id: template.id });
      toast.success("Tarea eliminada");
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-md border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Plantilla activa</p>
            <p className="text-xs text-muted-foreground">
              {template.is_active
                ? "Se generan tareas al crear un proyecto de este tipo."
                : "No se generan tareas automáticas para este tipo."}
            </p>
          </div>
          <Switch checked={template.is_active} onCheckedChange={toggleActive} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Nombre</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-desc">Descripción</Label>
          <Textarea
            id="tpl-desc"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
            rows={2}
          />
        </div>

        {dirty && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setName(template.name);
                setDescription(template.description ?? "");
                setDirty(false);
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={saveMeta} disabled={!name.trim() || update.isPending}>
              Guardar
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tareas de la plantilla</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Agregar tarea
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin tareas todavía. Agregá la primera para automatizar el onboarding.
        </div>
      ) : (
        <div className="space-y-2">
          {parents.map((t, i) => {
            const subs = childrenByParent.get(t.id) ?? [];
            return (
              <div key={t.id} className="rounded-md border p-3">
                <TemplateTaskRow
                  task={t}
                  index={i}
                  siblings={parents}
                  reorderPending={reorder.isPending}
                  onMove={(idx, dir) => move(parents, idx, dir)}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
                {subs.length > 0 && (
                  <div className="mt-2 space-y-2 border-l-2 border-muted pl-3">
                    {subs.map((s, j) => (
                      <div key={s.id} className="rounded-md bg-muted/40 p-2.5">
                        <TemplateTaskRow
                          task={s}
                          index={j}
                          siblings={subs}
                          reorderPending={reorder.isPending}
                          onMove={(idx, dir) => move(subs, idx, dir)}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => openCreateSub(t)}
                >
                  <Plus className="mr-1 h-3 w-3" /> Subtarea
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <TemplateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templateId={template.id}
        task={editingTask}
        parentTask={parentTask}
      />
    </div>
  );
}

function TemplateTaskRow({
  task: t,
  index: i,
  siblings,
  reorderPending,
  onMove,
  onEdit,
  onDelete,
}: {
  task: ProjectTemplateTask;
  index: number;
  siblings: ProjectTemplateTask[];
  reorderPending: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onEdit: (t: ProjectTemplateTask) => void;
  onDelete: (t: ProjectTemplateTask) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{t.title}</p>
        </div>
        {t.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {TYPE_LABEL[t.type]}
          </Badge>
          <Badge className={cn("text-[10px]", PRIORITY_CLASS[t.priority])}>
            {PRIORITY_LABEL[t.priority]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            +{t.offset_days} {t.offset_days === 1 ? "día" : "días"}
          </Badge>
          {t.estimated_hours != null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Timer className="h-3 w-3" /> {t.estimated_hours}h
            </span>
          )}
          {t.checklist_items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ListChecks className="h-3 w-3" /> {t.checklist_items.length}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={i === 0 || reorderPending}
            onClick={() => onMove(i, -1)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={i === siblings.length - 1 || reorderPending}
            onClick={() => onMove(i, 1)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(t)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(t)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
