import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  useCreateTask,
  useDeleteTask,
  useSubtasks,
  useUpdateTask,
  type Task,
} from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_CLASS, PRIORITY_LABEL } from "@/lib/task-labels";
import { Badge } from "@/components/ui/badge";

interface Props {
  parent: Task;
  members: WorkspaceMember[];
  onOpenSubtask?: (id: string) => void;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TaskSubtasks({ parent, members, onOpenSubtask }: Props) {
  const { data: subtasks = [] } = useSubtasks(parent.id);
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [dueDate, setDueDate] = useState<Date | undefined>();

  const done = subtasks.filter((s) => s.status === "done").length;
  const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;

  const resetForm = () => {
    setTitle("");
    setAssignedTo("none");
    setDueDate(undefined);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        workspace_id: parent.workspace_id,
        title: title.trim(),
        parent_task_id: parent.id,
        project_id: parent.project_id,
        client_id: parent.client_id,
        lead_id: parent.lead_id,
        assigned_to: assignedTo !== "none" ? assignedTo : null,
        due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        priority: parent.priority,
        type: parent.type,
      });
      resetForm();
    } catch (e: any) {
      toast.error("No se pudo crear la subtarea", { description: e?.message });
    }
  };

  const toggleDone = (s: Task, checked: boolean) => {
    update.mutate({
      id: s.id,
      patch: { status: checked ? "done" : "todo" },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Subtareas</h3>
          {subtasks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {done}/{subtasks.length} completadas
            </span>
          )}
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar subtarea
          </Button>
        )}
      </div>

      {subtasks.length > 0 && <Progress value={pct} className="h-1.5" />}

      <div className="space-y-1">
        {subtasks.map((s) => {
          const assigned = s.assigned_to
            ? members.find((m) => m.user_id === s.assigned_to)
            : null;
          const name = assigned?.full_name || assigned?.email || "";
          return (
            <div
              key={s.id}
              className="group flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 transition hover:bg-muted/40"
            >
              <Checkbox
                checked={s.status === "done"}
                onCheckedChange={(v) => toggleDone(s, !!v)}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => onOpenSubtask?.(s.id)}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm",
                  s.status === "done" && "text-muted-foreground line-through",
                )}
              >
                {s.title}
              </button>

              <Badge
                className={cn("hidden rounded text-[10px] sm:inline-flex", PRIORITY_CLASS[s.priority])}
              >
                {PRIORITY_LABEL[s.priority]}
              </Badge>

              {s.due_date && (
                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                  {format(parseISO(s.due_date), "dd MMM", { locale: es })}
                </span>
              )}

              {assigned && (
                <Avatar className="h-5 w-5">
                  {assigned.avatar_url && <AvatarImage src={assigned.avatar_url} alt={name} />}
                  <AvatarFallback className="text-[9px]">{initialsOf(name)}</AvatarFallback>
                </Avatar>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={() => onOpenSubtask?.(s.id)}
                title="Abrir detalle"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100"
                onClick={() => del.mutate(s.id)}
                title="Eliminar subtarea"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") resetForm();
            }}
            placeholder="Título de la subtarea…"
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder="Responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 justify-start gap-1.5 text-xs font-normal",
                    !dueDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dueDate ? format(dueDate, "dd MMM yyyy", { locale: es }) : "Fecha límite"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm} disabled={create.isPending}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!title.trim() || create.isPending}
              >
                {create.isPending ? "Creando…" : "Crear"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {subtasks.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">
          Divide esta tarea en pasos más pequeños agregando subtareas.
        </p>
      )}
    </div>
  );
}
