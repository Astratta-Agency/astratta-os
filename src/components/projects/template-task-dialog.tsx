import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_LABEL,
  TYPE_LABEL,
} from "@/lib/task-labels";
import type { TaskPriority, TaskType } from "@/hooks/useTasks";
import {
  useCreateTemplateTask,
  useUpdateTemplateTask,
  type ProjectTemplateTask,
  type TemplateTaskInput,
} from "@/hooks/useProjectTemplates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  task?: ProjectTemplateTask | null;
  /** Si se pasa, la tarea nueva se crea como subtarea de esta tarea padre. */
  parentTask?: ProjectTemplateTask | null;
}

const TYPES: TaskType[] = ["produccion", "revision", "aprobacion", "reunion", "admin"];
const PRIORITIES: TaskPriority[] = ["p0", "p1", "p2", "p3"];

export function TemplateTaskDialog({ open, onOpenChange, templateId, task, parentTask }: Props) {
  const create = useCreateTemplateTask();
  const update = useUpdateTemplateTask();
  const editing = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("produccion");
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [offsetDays, setOffsetDays] = useState<string>("0");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkInput, setCheckInput] = useState("");

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setType(task.type);
      setPriority(task.priority);
      setOffsetDays(String(task.offset_days));
      setEstimatedHours(task.estimated_hours != null ? String(task.estimated_hours) : "");
      setChecklist(task.checklist_items ?? []);
    } else {
      setTitle("");
      setDescription("");
      setType("produccion");
      setPriority("p2");
      setOffsetDays("0");
      setEstimatedHours("");
      setChecklist([]);
    }
    setCheckInput("");
  }, [open, task]);

  const addCheck = () => {
    const t = checkInput.trim();
    if (!t || checklist.includes(t)) return;
    setChecklist([...checklist, t]);
    setCheckInput("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const payload: TemplateTaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      priority,
      offset_days: Number.isFinite(parseInt(offsetDays, 10)) ? parseInt(offsetDays, 10) : 0,
      estimated_hours: estimatedHours.trim() === "" ? null : Number(estimatedHours),
      checklist_items: checklist,
      parent_id: editing && task ? task.parent_id : (parentTask?.id ?? null),
    };
    try {
      if (editing && task) {
        await update.mutateAsync({ id: task.id, template_id: task.template_id, ...payload });
        toast.success("Tarea actualizada");
      } else {
        await create.mutateAsync({ template_id: templateId, ...payload });
        toast.success("Tarea agregada");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? task?.parent_id
                ? "Editar subtarea de plantilla"
                : "Editar tarea de plantilla"
              : parentTask
                ? "Nueva subtarea de plantilla"
                : "Nueva tarea de plantilla"}
          </DialogTitle>
          {!editing && parentTask && (
            <p className="text-sm text-muted-foreground">
              Subtarea de: <span className="font-medium text-foreground">{parentTask.title}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tt-title">Título *</Label>
            <Input
              id="tt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Kickoff con el cliente"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-desc">Descripción</Label>
            <Textarea
              id="tt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tt-offset">Días desde inicio</Label>
              <Input
                id="tt-offset"
                type="number"
                value={offsetDays}
                onChange={(e) => setOffsetDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                0 = mismo día que arranca el proyecto
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-hours">Horas estimadas</Label>
              <Input
                id="tt-hours"
                type="number"
                step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Checklist</Label>
            <div className="flex gap-2">
              <Input
                value={checkInput}
                onChange={(e) => setCheckInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCheck();
                  }
                }}
                placeholder="Escribir ítem y enter"
              />
              <Button type="button" variant="outline" onClick={addCheck}>
                Añadir
              </Button>
            </div>
            {checklist.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {checklist.map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1">
                    {c}
                    <button
                      type="button"
                      onClick={() => setChecklist(checklist.filter((x) => x !== c))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || pending}>
            {pending ? "Guardando…" : editing ? "Guardar cambios" : "Agregar tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
